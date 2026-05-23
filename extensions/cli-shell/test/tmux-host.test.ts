import { describe, expect, test } from "bun:test";

import {
  CLI_SHELL_TMUX_SOCKET_NAME,
  buildCliShellTmuxPlan,
  findCliShellTmuxBinding,
  findCliShellTmuxHelpText,
  findCliShellTmuxMouseDispatch,
  findCliShellTmuxMouseStep,
  findCliShellTmuxStatusLeftStep,
  findCliShellTmuxStatusStep,
  findCliShellTmuxShellPaneStep,
  resolveCliShellCommandFromArgv,
  runCliShellTmuxAction,
  runCliShellTmuxHost,
  type CliShellTmuxStep,
} from "../src/tmux-host";
import { formatCliShellHeartbeatStatus } from "../src/heartbeat-status";

const findTmuxCommandIndex = (step: CliShellTmuxStep): number =>
  step.args.findIndex((arg) => !arg.startsWith("-") && arg !== CLI_SHELL_TMUX_SOCKET_NAME);

const readTmuxCommand = (step: CliShellTmuxStep): string => {
  const commandIndex = findTmuxCommandIndex(step);
  if (commandIndex < 0) {
    throw new Error(`tmux command not found in args: ${step.args.join(" ")}`);
  }
  return step.args[commandIndex] ?? "";
};

const readTmuxCommandArgs = (step: CliShellTmuxStep): string[] => {
  const commandIndex = findTmuxCommandIndex(step);
  if (commandIndex < 0) {
    throw new Error(`tmux command not found in args: ${step.args.join(" ")}`);
  }
  return step.args.slice(commandIndex);
};

describe("Feature: cli-shell tmux host", () => {
  test("Scenario: Given a cli-shell session When planning tmux host Then shell starts as the primary pane without a permanent Chat split", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      daemonHost: "127.0.0.1",
      daemonPort: 4580,
      cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
    });

    expect(plan.sessionName).toBe("shell-5");
    expect(plan.socketName).toBe(CLI_SHELL_TMUX_SOCKET_NAME);
    expect(plan.steps.every((step) => step.args[0] === "-L" && step.args[1] === CLI_SHELL_TMUX_SOCKET_NAME)).toBe(true);
    expect(plan.steps.map(readTmuxCommand)).toEqual([
      "has-session",
      "new-session",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "set-option",
      "bind-key",
      "bind-key",
      "bind-key",
      "bind-key",
      "bind-key",
      "bind-key",
      "bind-key",
      "select-pane",
      "attach-session",
    ]);
    expect(plan.steps[1]?.args).toContain("shell-5");
    expect(plan.steps[1]?.args.join(" ")).toContain("agenter-cli-shell.ts");
    expect(plan.steps[1]?.args.join(" ")).toContain("'shell'");
    expect(findCliShellTmuxShellPaneStep(plan)?.args.join(" ")).toContain("shell");
    expect(plan.steps.some((step) => readTmuxCommand(step) === "split-window")).toBe(false);
    expect(plan.steps.at(-1)?.foreground).toBe(true);
  });

  test("Scenario: Given multiple cli-shell sessions When planning tmux host Then product bindings stay inside the cli-shell tmux socket and read session-local options", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      daemonHost: "127.0.0.1",
      daemonPort: 4580,
    });
    const chat = findCliShellTmuxBinding(plan, "chat-popup");
    const refresh = findCliShellTmuxBinding(plan, "refresh-status");

    expect(plan.steps.every((step) => step.args.slice(0, 2).join(" ") === "-L agenter-cli-shell")).toBe(true);
    expect(chat?.args.join(" ")).toContain("--session #{q:session_name}");
    expect(chat?.args.join(" ")).toContain("--avatar #{q:@agenter_cli_shell_avatar}");
    expect(chat?.args.join(" ")).toContain("AGENTER_DAEMON_PORT=#{q:@agenter_cli_shell_daemon_port}");
    expect(chat ? readTmuxCommandArgs(chat).slice(2, 3) : undefined).toEqual(["run-shell"]);
    expect(chat?.args.join(" ")).toContain("tmux-action");
    expect(chat?.args.join(" ")).toContain("--action chat");
    expect(refresh?.args.join(" ")).toContain("tmux-action");
    expect(refresh?.args.join(" ")).toContain("--action refresh");
  });

  test("Scenario: Given a cli-shell session When planning tmux host Then the bottom status bar exposes product shell state and Chat entry", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      managed: true,
      chatDefaultLayout: "left",
    });
    const statusLeft = findCliShellTmuxStatusLeftStep(plan);
    const statusRight = findCliShellTmuxStatusStep(plan);

    expect(statusLeft?.args).toContain("status-left");
    expect(statusLeft?.args.join(" ")).toContain("cli-shell");
    expect(statusLeft?.args.join(" ")).toContain("shell-5");
    expect(statusLeft?.args.join(" ")).toContain("@bangeel");
    expect(statusLeft?.args.join(" ")).toContain("@agenter_cli_shell_heartbeat_status");
    expect(statusLeft?.args.join(" ")).toContain("range=user|managed");
    expect(statusLeft?.args.join(" ")).toContain("managed:#{@agenter_cli_shell_managed}");
    expect(statusRight?.args).toContain("status-right");
    expect(statusRight?.args.join(" ")).toContain("Help");
    expect(statusRight?.args.join(" ")).toContain("Chat");
    expect(statusRight?.args.join(" ")).not.toContain("Dock");
    expect(statusRight?.args.join(" ")).not.toContain("Mouse:#{mouse}");
    expect(statusRight?.args.join(" ")).not.toContain("Shell");
    expect(statusRight?.args.join(" ")).not.toContain("Ctrl+b");
    expect(statusLeft?.args.join(" ")).not.toContain("#[default]");
    expect(statusRight?.args.join(" ")).not.toContain("#[default]");
    expect(statusRight?.args.join(" ")).toContain("@agenter_cli_shell_active_action");
    expect(plan.steps.some((step) => step.args.join(" ").includes("@agenter_cli_shell_chat_default_layout left"))).toBe(true);
    expect(statusRight?.args.join(" ")).toContain("#[fg=colour159 bg=colour234 nobold]");
    expect(statusRight?.args.join(" ")).not.toContain("#[fg=colour159,bg=colour234,nobold]}");
    expect(plan.steps.some((step) => step.args.join(" ").includes("status-style fg=colour252,bg=colour234"))).toBe(true);
    expect(plan.steps.some((step) => step.args.join(" ").includes("status-left-style fg=colour252,bg=colour234"))).toBe(true);
    expect(plan.steps.some((step) => step.args.join(" ").includes("status-right-style fg=colour252,bg=colour234"))).toBe(true);
    expect(plan.steps.some((step) => step.args.join(" ").includes("status-right-length 120"))).toBe(true);
    expect(plan.steps.some((step) => step.args.join(" ").includes("window-status-current-format"))).toBe(true);
  });

  test("Scenario: Given Avatar Heartbeat has a preview When planning tmux host Then the bottom status bar keeps it in session-local state", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      runtimeSessionId: "session:/repo:bangeel",
      heartbeatStatus: "⌘ 终端工具 write 处理中",
      tmux: "tmux-test",
    });
    const heartbeatOption = plan.steps.find(
      (step) => step.productRole === "session-option" && step.args.includes("@agenter_cli_shell_heartbeat_status"),
    );
    const runtimeOption = plan.steps.find(
      (step) => step.productRole === "session-option" && step.args.includes("@agenter_cli_shell_runtime_session_id"),
    );
    const statusLeft = findCliShellTmuxStatusLeftStep(plan);
    const refresh = findCliShellTmuxBinding(plan, "refresh-status");

    expect(heartbeatOption?.args).toContain("⌘ 终端工具 write 处理中");
    expect(runtimeOption?.args).toContain("session:/repo:bangeel");
    expect(statusLeft?.args.join(" ")).toContain("@agenter_cli_shell_heartbeat_status");
    expect(statusLeft?.args.join(" ")).toContain("managed:#{@agenter_cli_shell_managed}");
    expect(refresh?.args.join(" ")).toContain("--action refresh");
    expect(refresh?.args.join(" ")).toContain("--runtime-session-id #{q:@agenter_cli_shell_runtime_session_id}");
  });

  test("Scenario: Given a long heartbeat preview When formatted Then the status bar keeps it short and single-line", () => {
    const preview = formatCliShellHeartbeatStatus({
      groups: [
        {
          groupId: "heartbeat-group:call:1",
          kind: "call",
          id: 1,
          createdAt: 1,
          updatedAt: 1,
          aiCallId: 1,
          isComplete: true,
          items: [
            {
              id: 1,
              createdAt: 1,
              updatedAt: 1,
              role: "assistant",
              isComplete: true,
              text:
                "AttentionContext.background yaml background-attention-context contextId ctx-workspace-runtime owner bangeel",
              windowId: null,
              messageId: "heartbeat-message-1",
              aiCallId: 1,
              roundIndex: 1,
              scope: "heartbeat_part",
              parts: [
                {
                  partId: 1,
                  partIndex: 0,
                  messageId: "heartbeat-message-1",
                  windowId: null,
                  aiCallId: 1,
                  roundIndex: 1,
                  scope: "heartbeat_part",
                  role: "assistant",
                  partType: "text",
                  mimeType: null,
                  isComplete: true,
                  createdAt: 1,
                  updatedAt: 1,
                  payload: {
                    content:
                      "AttentionContext.background yaml background-attention-context contextId ctx-workspace-runtime owner bangeel updatedAt 2026-05-22T12:38:22.887Z headCommitId commit-6639ac16-d3e9-4f0e-9ece-b82ec8279728 contentPreview very long preview very long preview very long preview very long preview very long preview very long preview",
                  },
                },
              ],
            },
          ],
        },
      ],
      shellName: "shell-5",
      connected: true,
      observationReady: true,
    });

    expect(preview).toContain("AttentionContext.background");
    expect(preview.length).toBeLessThan(80);
    expect(preview.includes("\n")).toBe(false);
  });

  test("Scenario: Given a new cli-shell user clicks the status bar When planning tmux host Then Mouse is enabled by default and visible status actions stay minimal", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
    });
    const mouse = findCliShellTmuxMouseStep(plan);
    const status = findCliShellTmuxStatusStep(plan);
    const dispatch = findCliShellTmuxMouseDispatch(plan);
    const toggle = findCliShellTmuxBinding(plan, "mouse-toggle");

    expect(mouse ? readTmuxCommandArgs(mouse) : undefined).toEqual(["set-option", "-t", "shell-5", "mouse", "on"]);
    expect(toggle ? readTmuxCommandArgs(toggle)[1] : undefined).toBe("m");
    expect(toggle?.args.join(" ")).toContain("tmux-action");
    expect(toggle?.args.join(" ")).toContain("--action mouse");
    expect(status?.args.join(" ")).toContain("range=user|help");
    expect(status?.args.join(" ")).toContain("range=user|chat");
    expect(status?.args.join(" ")).not.toContain("range=user|pane");
    expect(status?.args.join(" ")).not.toContain("range=user|mouse");
    expect(status?.args.join(" ")).not.toContain("range=user|shell");
    expect(dispatch?.args).toContain("MouseDown1Status");
    expect(dispatch?.args.join(" ")).toContain("mouse_status_range");
    expect(readTmuxCommandArgs(dispatch as CliShellTmuxStep).slice(4, 5)).toEqual(["run-shell"]);
    expect(readTmuxCommandArgs(dispatch as CliShellTmuxStep).join(" ")).toContain("tmux-action");
    expect(readTmuxCommandArgs(dispatch as CliShellTmuxStep).join(" ")).toContain("--action #{q:mouse_status_range}");
  });

  test("Scenario: Given managed is shown in the status bar When planning tmux host Then managed clicks route to the runtime product action", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
    });
    const statusLeft = findCliShellTmuxStatusLeftStep(plan);
    const dispatch = findCliShellTmuxMouseDispatch(plan);

    expect(statusLeft?.args.join(" ")).toContain("range=user|managed");
    expect(dispatch?.args.join(" ")).toContain("--action #{q:mouse_status_range}");
    expect(dispatch?.args.join(" ")).toContain("tmux-action");
  });

  test("Scenario: Given a new user needs orientation When planning tmux host Then shortcut help is available by key and click", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
    });
    const binding = findCliShellTmuxBinding(plan, "help-popup");
    const dispatch = findCliShellTmuxMouseDispatch(plan);
    const helpText = findCliShellTmuxHelpText(plan);

    expect(binding ? readTmuxCommandArgs(binding)[1] : undefined).toBe("?");
    expect(binding?.args.join(" ")).toContain("tmux-action");
    expect(binding?.args.join(" ")).toContain("--action help");
    expect(dispatch?.args.join(" ")).toContain("--action #{q:mouse_status_range}");
    expect(dispatch?.args.join(" ")).toContain("tmux-action");
    expect(helpText).toContain("Press Ctrl+b, release both keys");
    expect(helpText).toContain("Ctrl+b, then c");
    expect(helpText).toContain("Ctrl+b, then [");
    expect(helpText).toContain("Click managed:on/off, Help, or Chat");
    expect(helpText).toContain("Hidden expert keys still provide Dock, Mouse, Shell, and Refresh");
    expect(helpText).toContain("Esc");
  });

  test("Scenario: Given Chat is opened from the product shell When planning tmux host Then the Chat binding routes through the persisted default layout", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
    });
    const binding = findCliShellTmuxBinding(plan, "chat-popup");

    expect(binding ? readTmuxCommandArgs(binding)[1] : undefined).toBe("c");
    expect(binding ? readTmuxCommandArgs(binding).slice(2, 3) : undefined).toEqual(["run-shell"]);
    expect(binding?.args.join(" ")).toContain("tmux-action");
    expect(binding?.args.join(" ")).toContain("--action chat");
    expect(binding?.args.join(" ")).toContain("--session #{q:session_name}");
    expect(binding?.args.join(" ")).toContain("--avatar #{q:@agenter_cli_shell_avatar}");
    expect(binding?.args.join(" ")).toContain("agenter-cli-shell.ts");
    expect(
      plan.steps.some((step) =>
        step.productRole === "session-option" &&
        step.args.includes("@agenter_cli_shell_chat_default_layout"),
      ),
    ).toBe(true);
  });

  test("Scenario: Given Chat command needs tmux session facts When planning the popup Then the binding delegates a short action command", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
    });
    const binding = findCliShellTmuxBinding(plan, "chat-popup");
    const args = binding ? readTmuxCommandArgs(binding) : [];

    expect(args.slice(0, 3)).toEqual(["bind-key", "c", "run-shell"]);
    expect(args[3]).toContain("tmux-action");
    expect(args[3]).toContain("AGENTER_DAEMON_HOST=#{q:@agenter_cli_shell_daemon_host}");
    expect(args[3]).toContain("--session #{q:session_name}");
    expect(args[3]).not.toContain("<redacted>");
    expect(args.join(" ").length).toBeLessThan(900);
  });

  test("Scenario: Given the shell surface is requested When tmux action runs Then the action enters the product shell pane instead of a shell builtin", async () => {
    const executed: CliShellTmuxStep[] = [];
    await runCliShellTmuxAction({
      input: {
        action: "shell",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor: {
        which: async () => "/bin/tmux-test",
        run: async (step) => {
          executed.push(step);
        },
      },
    });

    expect(executed.map(readTmuxCommand)).toEqual(["set-option", "refresh-client", "select-pane", "set-option", "refresh-client"]);
  });

  test("Scenario: Given agenter shell launches cli-shell in-process When Chat opens later Then the room command reuses the launcher-provided bin argv", () => {
    const cliShellCommand = resolveCliShellCommandFromArgv([
      "/usr/local/bin/bun",
      "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts",
      "--session=5",
    ]);
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      cliShellCommand,
    });
    const binding = findCliShellTmuxBinding(plan, "chat-popup");

    expect(cliShellCommand).toEqual(["/usr/local/bin/bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"]);
    expect(binding?.args.join(" ")).toContain("/usr/local/bin/bun");
    expect(binding?.args.join(" ")).toContain("/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts");
    expect(binding?.args.join(" ")).not.toContain("<redacted>");
  });

  test("Scenario: Given product actions are wrapped for active highlighting When tmux receives the binding Then command groups use tmux command separators", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
    });
    const help = findCliShellTmuxBinding(plan, "help-popup");
    const chat = findCliShellTmuxBinding(plan, "chat-popup");
    const dispatch = findCliShellTmuxMouseDispatch(plan);

    expect(help?.args.join(" ")).toContain("--action help");
    expect(chat?.args.join(" ")).toContain("--action chat");
    expect(help?.args.join(" ")).not.toContain("'-t' '#{session_name}'");
    expect(chat?.args.join(" ")).not.toContain("'-t' '#{session_name}'");
    expect(dispatch?.args.join(" ")).toContain("--action #{q:mouse_status_range}");
    expect(help?.args.join(" ")).not.toContain("\\;");
    expect(chat?.args.join(" ")).not.toContain("\\;");
    expect(dispatch?.args.join(" ")).not.toContain("\\;");
  });

  test("Scenario: Given popup is not enough When planning tmux host Then Chat pane fallback is bound but not executed during attach", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
    });
    const binding = findCliShellTmuxBinding(plan, "chat-pane");

    expect(binding ? readTmuxCommandArgs(binding)[1] : undefined).toBe("C");
    expect(binding?.args.join(" ")).toContain("tmux-action");
    expect(binding?.args.join(" ")).toContain("--action pane");
    expect(plan.steps.filter((step) => readTmuxCommand(step) === "split-window")).toEqual([]);
  });

  test("Scenario: Given tmux product shell controls When planning tmux host Then product-local key bindings are installed", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
    });

    expect(readTmuxCommandArgs(findCliShellTmuxBinding(plan, "chat-popup") as CliShellTmuxStep)[1]).toBe("c");
    expect(readTmuxCommandArgs(findCliShellTmuxBinding(plan, "chat-pane") as CliShellTmuxStep)[1]).toBe("C");
    expect(readTmuxCommandArgs(findCliShellTmuxBinding(plan, "mouse-toggle") as CliShellTmuxStep)[1]).toBe("m");
    expect(readTmuxCommandArgs(findCliShellTmuxBinding(plan, "focus-shell") as CliShellTmuxStep)[1]).toBe("s");
    expect(readTmuxCommandArgs(findCliShellTmuxBinding(plan, "refresh-status") as CliShellTmuxStep)[1]).toBe("r");
    expect(readTmuxCommandArgs(findCliShellTmuxBinding(plan, "help-popup") as CliShellTmuxStep)[1]).toBe("?");
  });

  test("Scenario: Given tmux host executes the plan When bindings run Then tmux receives tokenized product-shell commands", async () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
    });
    const executed: CliShellTmuxStep[] = [];

    await runCliShellTmuxHost({
      plan,
      executor: {
        which: async () => "/bin/tmux-test",
        run: async (step) => {
          executed.push(step);
        },
      },
    });

    const popup = executed.find((step) => step.productRole === "chat-popup");
    const pane = executed.find((step) => step.productRole === "chat-pane");
    expect(popup?.command).toBe("/bin/tmux-test");
    expect(popup ? readTmuxCommandArgs(popup).slice(0, 3) : undefined).toEqual(["bind-key", "c", "run-shell"]);
    expect(popup?.args.join(" ")).toContain("tmux-action");
    expect(pane ? readTmuxCommandArgs(pane).slice(0, 3) : undefined).toEqual(["bind-key", "C", "run-shell"]);
    expect(pane?.args.join(" ")).toContain("tmux-action");
    expect(pane?.args.join(" ")).toContain("--action pane");
  });

  test("Scenario: Given a product action command runs When Chat is selected Then cli-shell opens the room through tmux instead of leaking formats to shell", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    await runCliShellTmuxAction({
      input: {
        action: "chat",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    expect(executed.map(readTmuxCommand)).toEqual(["run-shell"]);
    expect(executed[0]?.args.join(" ")).toContain("list-panes");
    expect(executed[0]?.args.join(" ")).toContain("show-options -qv");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_default_layout");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_pane");
    expect(executed[0]?.args.join(" ")).toContain("select-pane -t \"$chat_pane\"");
    expect(executed[0]?.args.join(" ")).toContain("set-option -t 'shell-5' @agenter_cli_shell_active_action 'chat'");
    expect(executed[0]?.args.join(" ")).toContain("display-popup");
    expect(executed[0]?.args.join(" ")).toContain("set-option -t 'shell-5' @agenter_cli_shell_active_action 'shell'");
    expect(executed[0]?.args.join(" ")).toContain("room");
    expect(executed[0]?.args.join(" ")).toContain("--session=shell-5");
    expect(executed[0]?.args.join(" ")).toContain("--avatar=bangeel");
    expect(executed[0]?.args.join(" ")).toContain("AGENTER_CLI_SHELL_TMUX_SESSION=shell-5");
    expect(executed[0]?.args.join(" ")).toContain("AGENTER_CLI_SHELL_TMUX_TARGET_PANE=%0");
    expect(executed[0]?.args.join(" ")).toContain('if [ "$code" -ne 0 ]; then');
    expect(executed[0]?.args.join(" ")).toContain("Chat exited unexpectedly");
    expect(executed[0]?.args.join(" ")).toContain("##{pane_id}|##{pane_start_command}");
    expect(executed[0]?.args.join(" ")).toContain("grep -F -- 'room'");
    expect(executed[0]?.args.join(" ")).toContain("grep -F -- '--session'");
    expect(executed[0]?.args.join(" ")).toContain("grep -F -- 'shell-5'");
    expect(executed[0]?.args.join(" ")).toContain("grep -F -- '--avatar'");
    expect(executed[0]?.args.join(" ")).toContain("grep -F -- 'bangeel'");
    expect(executed[0]?.args.join(" ")).not.toContain("grep -F -- '--session=shell-5'");
    expect(executed[0]?.args.join(" ")).not.toContain("--session=#{");
  });

  test("Scenario: Given a Chat dock already exists When Chat is selected Then the action focuses the singleton pane before opening another surface", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    await runCliShellTmuxAction({
      input: {
        action: "chat",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain("if [ -n \"$chat_pane\" ]; then");
    expect(shell).toContain("select-pane -t \"$chat_pane\"");
    expect(shell).toContain("@agenter_cli_shell_chat_surface pane");
    expect(shell).toContain("@agenter_cli_shell_chat_pane \"$chat_pane\"");
    expect(shell).toContain("exit 0");
    expect(shell).toContain("display-popup");
  });

  test("Scenario: Given Chat popup is already visible When Chat is selected again Then the product action closes the popup instead of opening a second surface", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    await runCliShellTmuxAction({
      input: {
        action: "chat",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain("@agenter_cli_shell_chat_surface");
    expect(shell).toContain('if [ "$chat_surface" = "popup" ]; then');
    expect(shell).toContain("display-popup -C");
    expect(shell).toContain("@agenter_cli_shell_active_action 'shell'");
    expect(shell).toContain("exit 0");
  });

  test("Scenario: Given Chat pane is already visible When Chat is selected again Then the product action closes the pane and restores shell focus", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    await runCliShellTmuxAction({
      input: {
        action: "chat",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain('if [ "$chat_surface" = "pane" ] && [ -n "$chat_pane" ]; then');
    expect(shell).toContain("fallback_pane=");
    expect(shell).toContain("grep -vFx \"$chat_pane\"");
    expect(shell).toContain("kill-pane -t \"$chat_pane\"");
    expect(shell).toContain("select-pane -t \"$fallback_pane\"");
    expect(shell).toContain("@agenter_cli_shell_active_action 'shell'");
    expect(shell).toContain("exit 0");
  });

  test("Scenario: Given OpenTUI Chat requests left layout When product action runs Then tmux owns the layout through a left dock pane", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    const result = await runCliShellTmuxAction({
      input: {
        action: "layout-left",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    expect(result).toEqual({ ok: true, action: "layout-left", closeCurrentSurface: false });
    expect(executed.map(readTmuxCommand)).toEqual(["run-shell"]);
    expect(executed[0]?.args.join(" ")).toContain("move-pane");
    expect(executed[0]?.args.join(" ")).toContain('-s "$chat_pane"');
    expect(executed[0]?.args.join(" ")).toContain(" -b ");
    expect(executed[0]?.args.join(" ")).toContain("-l 42%");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_default_layout 'left'");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_surface");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_pane \"$chat_pane\"");
    expect(executed[0]?.args.join(" ")).not.toContain("kill-pane -t \"$chat_pane\"");
    expect(executed[0]?.args.join(" ").indexOf("move-pane")).toBeLessThan(
      executed[0]?.args.join(" ").indexOf("split-window"),
    );
  });

  test("Scenario: Given OpenTUI Chat requests right layout When product action runs Then tmux owns the layout through a right dock pane", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    const result = await runCliShellTmuxAction({
      input: {
        action: "layout-right",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    expect(result).toEqual({ ok: true, action: "layout-right", closeCurrentSurface: false });
    expect(executed.map(readTmuxCommand)).toEqual(["run-shell"]);
    expect(executed[0]?.args.join(" ")).toContain("move-pane");
    expect(executed[0]?.args.join(" ")).toContain('-s "$chat_pane"');
    expect(executed[0]?.args.join(" ")).not.toContain(" -b ");
    expect(executed[0]?.args.join(" ")).toContain("-l 42%");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_default_layout 'right'");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_pane \"$chat_pane\"");
    expect(executed[0]?.args.join(" ")).not.toContain("kill-pane -t \"$chat_pane\"");
    expect(executed[0]?.args.join(" ").indexOf("move-pane")).toBeLessThan(
      executed[0]?.args.join(" ").indexOf("split-window"),
    );
  });

  test("Scenario: Given a top-layer notification is needed When product action runs Then cli-shell opens the shell top OpenTUI popup", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    const result = await runCliShellTmuxAction({
      input: {
        action: "top",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    expect(result).toEqual({ ok: true, action: "top" });
    expect(executed.map(readTmuxCommand)).toEqual(["run-shell"]);
    expect(executed[0]?.args.join(" ")).toContain("display-popup");
    expect(executed[0]?.args.join(" ")).toContain("cli-shell-top");
    expect(executed[0]?.args.join(" ")).toContain("top");
    expect(executed[0]?.args.join(" ")).toContain("--session=shell-5");
    expect(executed[0]?.args.join(" ")).toContain("--avatar=bangeel");
  });

  test("Scenario: Given OpenTUI Chat requests cover layout When product action runs Then tmux owns the layout through a popup", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    const result = await runCliShellTmuxAction({
      input: {
        action: "layout-cover",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    expect(result).toEqual({ ok: true, action: "layout-cover" });
    expect(executed.map(readTmuxCommand)).toEqual(["run-shell"]);
    expect(executed[0]?.args.join(" ")).toContain("kill-pane -t \"$chat_pane\"");
    expect(executed[0]?.args.join(" ")).toContain("display-popup");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_default_layout 'cover'");
    expect(executed[0]?.args.join(" ")).toContain("'-t' '%0'");
    expect(executed[0]?.args.join(" ")).toContain("AGENTER_CLI_SHELL_TMUX_TARGET_PANE=%0");
  });

  test("Scenario: Given the status bar is refreshed When product action runs Then cli-shell updates the Heartbeat option before refreshing tmux", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    await runCliShellTmuxAction({
      input: {
        action: "refresh",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    expect(executed.map(readTmuxCommand)).toEqual(["run-shell", "refresh-client"]);
    expect(executed[0]?.args.join(" ")).toContain("heartbeat-status");
    expect(executed[0]?.args.join(" ")).toContain("--runtime-session-id");
    expect(executed[0]?.args.join(" ")).toContain("session:/repo:bangeel");
    expect(executed[0]?.args.join(" ")).toContain('status="$(');
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_heartbeat_status");
  });

  test("Scenario: Given tmux is missing When running tmux host Then no legacy host fallback is attempted", async () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "missing-tmux",
    });
    const executed: CliShellTmuxStep[] = [];

    await expect(
      runCliShellTmuxHost({
        plan,
        executor: {
          which: async () => null,
          run: async (step) => {
            executed.push(step);
          },
        },
      }),
    ).rejects.toThrow("requires tmux");
    expect(executed).toEqual([]);
  });
});
