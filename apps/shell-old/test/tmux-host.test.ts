import { describe, expect, test } from "bun:test";
import { TmuxCommandError, type TmuxCommand, type TmuxExecResult, type TmuxExecutor } from "@agenter/tmux-client";

import { formatCliShellHeartbeatStatus } from "../src/heartbeat-status";
import { CLI_SHELL_TMUX_STATUS_RIGHT_LENGTH } from "../src/tmux-statusbar";
import {
  CLI_SHELL_TMUX_SOCKET_NAME,
  buildCliShellTmuxPlan,
  findCliShellTmuxBinding,
  findCliShellTmuxHelpText,
  findCliShellTmuxMouseDispatch,
  findCliShellTmuxMouseStep,
  findCliShellTmuxShellPaneStep,
  findCliShellTmuxStatusLeftStep,
  findCliShellTmuxStatusStep,
  resolveCliShellCommandFromArgv,
  runCliShellTmuxAction,
  runCliShellTmuxHost,
  type CliShellTmuxStep,
} from "../src/tmux-host";

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

class FakeTmuxExecutor implements TmuxExecutor {
  readonly commands: TmuxCommand[] = [];
  private options = new Map<string, string>();
  private panes: Array<{ paneId: string; startCommand: string }> = [{ paneId: "%0", startCommand: "shell" }];
  private nextPaneIndex = 1;
  failRunShell = false;

  constructor(input?: { options?: Record<string, string>; panes?: Array<{ paneId: string; startCommand: string }> }) {
    for (const [key, value] of Object.entries(input?.options ?? {})) {
      this.options.set(key, value);
    }
    if (input?.panes) {
      this.panes = input.panes;
      this.nextPaneIndex = input.panes.length;
    }
  }

  async exec(command: TmuxCommand): Promise<TmuxExecResult> {
    this.commands.push(command);
    const args = command.args[0] === "-L" ? command.args.slice(2) : command.args;
    const verb = args[0];
    if (verb === "show-options") {
      const name = args.at(-1) ?? "";
      const value = this.options.get(name);
      return value === undefined
        ? { stdout: "", stderr: "missing option", exitCode: 1 }
        : { stdout: `${value}\n`, stderr: "", exitCode: 0 };
    }
    if (verb === "set-option") {
      const name = args.at(-2) ?? "";
      const value = args.at(-1) ?? "";
      this.options.set(name, value);
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (verb === "list-panes") {
      return {
        stdout: this.panes
          .map((pane, index) =>
            [
              pane.paneId,
              "shell-5",
              "@0",
              "0",
              String(index),
              index === 0 ? "1" : "0",
              "zsh",
              pane.startCommand,
              "/repo",
              pane.paneId,
            ].join("\u001f"),
          )
          .join("\n"),
        stderr: "",
        exitCode: 0,
      };
    }
    if (verb === "split-window") {
      const paneId = `%${this.nextPaneIndex++}`;
      this.panes.push({ paneId, startCommand: String(args.at(-1) ?? "") });
      return { stdout: `${paneId}\n`, stderr: "", exitCode: 0 };
    }
    if (verb === "move-pane") {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (verb === "kill-pane") {
      const target = args.at(-1) ?? "";
      this.panes = this.panes.filter((pane) => pane.paneId !== target);
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (verb === "run-shell") {
      return this.failRunShell
        ? { stdout: "run-shell failed\n", stderr: "", exitCode: 1 }
        : { stdout: "", stderr: "", exitCode: 0 };
    }
    if (verb === "display-popup" || verb === "select-pane" || verb === "refresh-client") {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async which(executable: string): Promise<string | null> {
    return executable;
  }
}

describe("Feature: cli-shell tmux host", () => {
  test("Scenario: Given a cli-shell session When planning tmux host Then shell starts with Chat open on the right", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      daemonHost: "127.0.0.1",
      daemonPort: 4580,
      cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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
      "run-shell",
      "select-pane",
      "attach-session",
    ]);
    expect(plan.steps[1]?.args).toContain("shell-5");
    expect(plan.steps[1]?.args.join(" ")).toContain("agenter-cli-shell.ts");
    expect(plan.steps[1]?.args.join(" ")).toContain("'shell'");
    expect(findCliShellTmuxShellPaneStep(plan)?.args.join(" ")).toContain("shell");
    const autoChatPane = plan.steps.find(
      (step) => step.productRole === "chat-pane" && readTmuxCommand(step) === "run-shell" && step.args.join(" ").includes("split-window"),
    );
    expect(autoChatPane?.args.join(" ")).toContain("-h");
    expect(autoChatPane?.args.join(" ")).toContain("-l 42%");
    expect(autoChatPane?.args.join(" ")).toContain("'room'");
    expect(autoChatPane?.args.join(" ")).toContain("'--session=shell-5'");
    expect(autoChatPane?.args.join(" ")).toContain("'--avatar=bangeel'");
    expect(autoChatPane?.args.join(" ")).toContain("@agenter_cli_shell_chat_surface 'pane'");
    expect(autoChatPane?.args.join(" ")).toContain("@agenter_cli_shell_active_action 'chat'");
    expect(plan.steps.at(-1)?.foreground).toBe(true);
  });

  test("Scenario: Given multiple cli-shell sessions When planning tmux host Then app bindings stay inside the cli-shell tmux socket and read session-local options", () => {
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

  test("Scenario: Given a cli-shell session When planning tmux host Then the bottom status bar exposes app shell state and Chat entry", () => {
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
    expect(plan.steps.some((step) => step.args.join(" ").includes("@agenter_cli_shell_chat_default_layout left"))).toBe(
      true,
    );
    expect(statusRight?.args.join(" ")).toContain("fg=colour159#,bg=colour234#,nobold");
    expect(statusRight?.args.join(" ")).toContain("fg=colour16#,bg=colour220#,bold");
    expect(plan.steps.some((step) => step.args.join(" ").includes("status-style fg=colour252,bg=colour234"))).toBe(
      true,
    );
    expect(plan.steps.some((step) => step.args.join(" ").includes("status-left-style fg=colour252,bg=colour234"))).toBe(
      true,
    );
    expect(
      plan.steps.some((step) => step.args.join(" ").includes("status-right-style fg=colour252,bg=colour234")),
    ).toBe(true);
    expect(
      plan.steps.some((step) =>
        step.args.join(" ").includes(`status-right-length ${CLI_SHELL_TMUX_STATUS_RIGHT_LENGTH}`),
      ),
    ).toBe(true);
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
    expect(refresh?.args.join(" ")).toContain("--target-client #{q:client_name}");
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
              text: "AttentionContext.background yaml background-attention-context contextId ctx-workspace-runtime owner bangeel",
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

  test("Scenario: Given managed is shown in the status bar When planning tmux host Then managed clicks route to the runtime app action", () => {
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
    expect(helpText).toContain("Ctrl+b, then c  toggle Chat");
    expect(helpText).toContain("Ctrl+b, then [");
    expect(helpText).toContain("Click managed:on/off, Help, or Chat");
    expect(helpText).toContain("Hidden expert keys still provide Dock, Mouse, Shell, and Refresh");
    expect(helpText).toContain("Esc");
  });

  test("Scenario: Given Chat is opened from the app shell When planning tmux host Then the Chat binding routes through the persisted default layout", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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
      plan.steps.some(
        (step) => step.productRole === "session-option" && step.args.includes("@agenter_cli_shell_chat_default_layout"),
      ),
    ).toBe(true);
  });

  test("Scenario: Given Chat command needs tmux session facts When planning the popup Then the binding delegates a short action command", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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

  test("Scenario: Given the shell surface is requested When tmux action runs Then the action enters the app shell pane instead of a shell builtin", async () => {
    const executed: CliShellTmuxStep[] = [];
    await runCliShellTmuxAction({
      input: {
        action: "shell",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        targetClient: "client-1",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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

    expect(executed.map(readTmuxCommand)).toEqual([
      "set-option",
      "refresh-client",
      "select-pane",
      "set-option",
      "refresh-client",
    ]);
  });

  test("Scenario: Given agenter shell launches cli-shell in-process When Chat opens later Then the room command reuses the launcher-provided bin argv", () => {
    const cliShellCommand = resolveCliShellCommandFromArgv([
      "/usr/local/bin/bun",
      "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts",
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

    expect(cliShellCommand).toEqual(["/usr/local/bin/bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"]);
    expect(binding?.args.join(" ")).toContain("/usr/local/bin/bun");
    expect(binding?.args.join(" ")).toContain("/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts");
    expect(binding?.args.join(" ")).not.toContain("<redacted>");
  });

  test("Scenario: Given app actions are wrapped for active highlighting When tmux receives the binding Then command groups use tmux command separators", () => {
    const plan = buildCliShellTmuxPlan({
      shellName: "shell-5",
      avatarNickname: "bangeel",
      workspacePath: "/repo",
      tmux: "tmux-test",
      cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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

  test("Scenario: Given Chat opens by default When planning tmux host Then the explicit pane fallback remains a key binding", () => {
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
    expect(plan.steps.filter((step) => step.productRole === "chat-pane" && readTmuxCommand(step) === "run-shell")).toHaveLength(1);
  });

  test("Scenario: Given tmux app shell controls When planning tmux host Then app-local key bindings are installed", () => {
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

  test("Scenario: Given tmux host executes the plan When bindings run Then tmux receives tokenized app-shell commands", async () => {
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

  test("Scenario: Given a app action command runs without saved layout When Chat is selected Then cli-shell opens the room as the default right pane", async () => {
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
        targetClient: "client-1",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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
    expect(executed[0]?.args.join(" ")).toContain('if [ "$chat_surface" = "pane" ] && [ -n "$chat_pane" ]; then');
    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain("set-option -t 'shell-5' @agenter_cli_shell_active_action 'chat'");
    expect(shell).toContain('if [ "$default_layout" = "cover" ]; then');
    expect(shell).toContain("display-popup");
    expect(shell).toContain("split-window");
    expect(shell).toContain("-h");
    expect(shell).toContain("-l 42%");
    expect(shell).toContain("@agenter_cli_shell_chat_surface 'pane'");
    expect(shell.lastIndexOf("split-window")).toBeGreaterThan(shell.indexOf('if [ "$default_layout" = "cover" ]; then'));
    expect(executed[0]?.args.join(" ")).toContain("room");
    expect(executed[0]?.args.join(" ")).toContain("--session=shell-5");
    expect(executed[0]?.args.join(" ")).toContain("--avatar=bangeel");
    expect(executed[0]?.args.join(" ")).toContain("AGENTER_CLI_SHELL_TMUX_SESSION=shell-5");
    expect(executed[0]?.args.join(" ")).toContain("AGENTER_CLI_SHELL_TMUX_TARGET_PANE=%0");
    expect(executed[0]?.args.join(" ")).toContain("AGENTER_CLI_SHELL_TMUX_TARGET_CLIENT=client-1");
    expect(executed[0]?.args.join(" ")).toContain("'-c' 'client-1'");
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

  test("Scenario: Given no Chat tmux option exists When real Chat action runs Then cli-shell opens a right pane instead of cover popup", async () => {
    const tmuxExecutor = new FakeTmuxExecutor();

    const result = await runCliShellTmuxAction({
      input: {
        action: "chat",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      tmuxExecutor,
    });

    const verbs = tmuxExecutor.commands.map((command) => command.args[2] ?? command.args[0]);
    const split = tmuxExecutor.commands.find((command) => command.args.includes("split-window"));
    expect(result).toEqual({ ok: true, action: "chat" });
    expect(verbs).toContain("split-window");
    expect(verbs).not.toContain("display-popup");
    expect(split?.args).toContain("-h");
    expect(split?.args).not.toContain("-b");
    expect(split?.args).toContain("-l");
    expect(split?.args).toContain("42%");
  });

  test("Scenario: Given Chat pane already exists When Chat is selected Then the action toggles the singleton pane closed before opening another surface", async () => {
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
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain('if [ "$chat_surface" = "pane" ] && [ -n "$chat_pane" ]; then');
    expect(shell).toContain('kill-pane -t "$chat_pane"');
    expect(shell).toContain("@agenter_cli_shell_chat_surface 'none'");
    expect(shell).toContain("exit 0");
    expect(shell).toContain("split-window");
  });

  test("Scenario: Given tmux returns user range payloads When app action runs Then cli-shell normalizes known actions and rejects unknown payloads", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };
    const baseInput = {
      shellName: "shell-5",
      avatarNickname: "bangeel",
      runtimeSessionId: "session:/repo:bangeel",
      targetPane: "%0",
      tmux: "tmux-test",
      cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
      daemonHost: "127.0.0.1",
      daemonPort: 4580,
    };

    const help = await runCliShellTmuxAction({
      input: {
        ...baseInput,
        action: "user|help",
      },
      executor,
    });
    const chat = await runCliShellTmuxAction({
      input: {
        ...baseInput,
        action: "user|chat",
      },
      executor,
    });
    const unknown = await runCliShellTmuxAction({
      input: {
        ...baseInput,
        action: "user|unknown",
      },
      executor,
    });

    expect(help).toEqual({ ok: true, action: "help" });
    expect(chat).toEqual({ ok: true, action: "chat" });
    expect(unknown).toEqual({ ok: false, action: "user|unknown", reason: "unknown-action" });
    expect(executed.map(readTmuxCommand)).toEqual([
      "set-option",
      "refresh-client",
      "display-popup",
      "set-option",
      "refresh-client",
      "run-shell",
      "display-message",
    ]);
    expect(executed[2]?.args.join(" ")).toContain("cli-shell-help");
    expect(executed[2]?.args.join(" ")).toContain("help-panel");
    expect(executed[2]?.args.join(" ")).not.toContain("IFS= read");
    expect(executed[5]?.args.join(" ")).toContain("@agenter_cli_shell_chat_default_layout");
  });

  test("Scenario: Given Help popup is dismissed by the user When tmux reports 129 Then cli-shell restores shell highlight without failing", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
        if (readTmuxCommand(step) === "display-popup") {
          throw new TmuxCommandError(
            { executable: step.command, args: step.args },
            { stdout: "", stderr: "", exitCode: 129 },
          );
        }
      },
    };

    const result = await runCliShellTmuxAction({
      input: {
        action: "help",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        targetClient: "client-1",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    expect(result).toEqual({ ok: true, action: "help" });
    expect(executed.map(readTmuxCommand)).toEqual([
      "set-option",
      "refresh-client",
      "display-popup",
      "set-option",
      "refresh-client",
    ]);
    expect(executed[3]?.args).toContain("@agenter_cli_shell_active_action");
    expect(executed[3]?.args).toContain("shell");
  });

  test("Scenario: Given Chat popup is already visible When Help is selected Then cli-shell closes the existing popup before opening Help", async () => {
    const tmuxExecutor = new FakeTmuxExecutor({
      options: {
        "@agenter_cli_shell_chat_surface": "popup",
        "@agenter_cli_shell_chat_pane": "",
      },
    });

    const result = await runCliShellTmuxAction({
      input: {
        action: "help",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      tmuxExecutor,
    });

    const closePopup = tmuxExecutor.commands.find(
      (command) => command.args.includes("display-popup") && command.args.includes("-C"),
    );
    const helpPopup = tmuxExecutor.commands.find(
      (command) => command.args.includes("display-popup") && command.args.join(" ").includes("cli-shell-help"),
    );
    expect(result).toEqual({ ok: true, action: "help" });
    expect(closePopup?.args).toEqual(["-L", "agenter-cli-shell", "display-popup", "-c", "client-1", "-C"]);
    expect(helpPopup?.args).toContain("-E");
    expect(helpPopup?.args).toContain("-c");
    expect(helpPopup?.args).toContain("client-1");
    expect(helpPopup?.args).toContain("-t");
    expect(helpPopup?.args).toContain("%0");
    expect(helpPopup?.args.join(" ")).toContain("cli-shell-help");
    expect(helpPopup?.args.join(" ")).toContain("help-panel");
    expect(helpPopup?.args.join(" ")).toContain("Help exited unexpectedly");
    expect(helpPopup?.args.join(" ")).toContain("@agenter_cli_shell_active_action");
    expect(helpPopup?.args.join(" ")).not.toContain("run-shell -b");
    const closePopupIndex = tmuxExecutor.commands.findIndex(
      (command) => command.args.join(" ") === closePopup?.args.join(" "),
    );
    const helpPopupIndex = tmuxExecutor.commands.findIndex(
      (command) => command.args.join(" ") === helpPopup?.args.join(" "),
    );
    expect(closePopupIndex).toBeGreaterThan(-1);
    expect(helpPopupIndex).toBeGreaterThan(closePopupIndex);
    expect(tmuxExecutor.commands.map((command) => command.args.join(" "))).toContain(
      "-L agenter-cli-shell set-option -t shell-5 @agenter_cli_shell_chat_surface none",
    );
  });

  test("Scenario: Given Chat popup is already visible When Chat is selected again Then the app action closes the popup instead of opening a second surface", async () => {
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
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain("@agenter_cli_shell_chat_surface");
    expect(shell).toContain('if [ "$chat_surface" = "popup" ]; then');
    expect(shell).toContain("'display-popup' '-C'");
    expect(shell).toContain("@agenter_cli_shell_active_action 'shell'");
    expect(shell).toContain("exit 0");
  });

  test("Scenario: Given Chat pane is already visible When Chat is selected again Then the app action closes the pane and restores shell focus", async () => {
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
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain('if [ "$chat_surface" = "pane" ] && [ -n "$chat_pane" ]; then');
    expect(shell).toContain("fallback_pane=");
    expect(shell).toContain('grep -vFx "$chat_pane"');
    expect(shell).toContain('kill-pane -t "$chat_pane"');
    expect(shell).toContain('select-pane -t "$fallback_pane"');
    expect(shell).toContain("@agenter_cli_shell_active_action 'shell'");
    expect(shell).toContain("exit 0");
  });

  test("Scenario: Given Chat dock pane exits When the pane command cleans up Then tmux removes the stale Room pane", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    await runCliShellTmuxAction({
      input: {
        action: "pane",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    const shell = executed[0]?.args.join(" ") ?? "";
    const cleanupIndex = shell.indexOf('current_chat_pane="${TMUX_PANE:-}"');
    const resetIndex = shell.indexOf("@agenter_cli_shell_active_action", cleanupIndex);
    const killIndex = shell.indexOf('kill-pane -t "$current_chat_pane"', cleanupIndex);
    expect(shell).toContain('current_chat_pane="${TMUX_PANE:-}"');
    expect(shell).toContain('kill-pane -t "$current_chat_pane"');
    expect(cleanupIndex).toBeGreaterThan(-1);
    expect(resetIndex).toBeGreaterThan(-1);
    expect(killIndex).toBeGreaterThan(-1);
    expect(resetIndex).toBeLessThan(killIndex);
  });

  test("Scenario: Given OpenTUI Chat requests left layout When app action runs Then tmux owns the layout through a left dock pane", async () => {
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
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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
    expect(executed[0]?.args.join(" ")).toContain('@agenter_cli_shell_chat_pane "$chat_pane"');
    expect(executed[0]?.args.join(" ")).not.toContain('kill-pane -t "$chat_pane"');
    expect(executed[0]?.args.join(" ").indexOf("move-pane")).toBeLessThan(
      executed[0]?.args.join(" ").indexOf("split-window"),
    );
  });

  test("Scenario: Given OpenTUI Chat requests right layout When app action runs Then tmux owns the layout through a right dock pane", async () => {
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
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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
    expect(executed[0]?.args.join(" ")).toContain('@agenter_cli_shell_chat_pane "$chat_pane"');
    expect(executed[0]?.args.join(" ")).not.toContain('kill-pane -t "$chat_pane"');
    expect(executed[0]?.args.join(" ").indexOf("move-pane")).toBeLessThan(
      executed[0]?.args.join(" ").indexOf("split-window"),
    );
  });

  test("Scenario: Given Chat is already a right pane When real action state switches left Then cli-shell moves the singleton pane through tmux-client", async () => {
    const tmuxExecutor = new FakeTmuxExecutor({
      options: {
        "@agenter_cli_shell_chat_surface": "pane",
        "@agenter_cli_shell_chat_pane": "%1",
      },
      panes: [
        { paneId: "%0", startCommand: "shell" },
        { paneId: "%1", startCommand: "'bun' 'agenter-cli-shell.ts' 'room' '--session=shell-5' '--avatar=bangeel'" },
      ],
    });

    const result = await runCliShellTmuxAction({
      input: {
        action: "layout-left",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      tmuxExecutor,
    });

    const verbs = tmuxExecutor.commands.map((command) => command.args[2] ?? command.args[0]);
    const move = tmuxExecutor.commands.find((command) => command.args.includes("move-pane"));
    expect(result).toEqual({ ok: true, action: "layout-left", closeCurrentSurface: false });
    expect(verbs).toContain("move-pane");
    expect(verbs).not.toContain("split-window");
    expect(verbs).not.toContain("kill-pane");
    expect(move?.args).toContain("-b");
    expect(move?.args).toContain("%1");
  });

  test("Scenario: Given Chat is a popup When real Chat toggle closes it Then tmux-client targets the owning client", async () => {
    const tmuxExecutor = new FakeTmuxExecutor({
      options: {
        "@agenter_cli_shell_chat_surface": "popup",
        "@agenter_cli_shell_chat_pane": "",
      },
    });

    const result = await runCliShellTmuxAction({
      input: {
        action: "chat",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      tmuxExecutor,
    });

    const closePopup = tmuxExecutor.commands.find(
      (command) => command.args.includes("display-popup") && command.args.includes("-C"),
    );
    expect(result).toEqual({ ok: true, action: "chat" });
    expect(closePopup?.args).toEqual(["-L", "agenter-cli-shell", "display-popup", "-c", "client-1", "-C"]);
  });

  test("Scenario: Given Chat is a right pane When real action switches to cover from that pane Then cli-shell opens one popup via tmux server and lets the current pane close itself", async () => {
    const tmuxExecutor = new FakeTmuxExecutor({
      options: {
        "@agenter_cli_shell_chat_surface": "pane",
        "@agenter_cli_shell_chat_pane": "%1",
      },
      panes: [
        { paneId: "%0", startCommand: "shell" },
        { paneId: "%1", startCommand: "'bun' 'agenter-cli-shell.ts' 'room' '--session=shell-5' '--avatar=bangeel'" },
      ],
    });

    const result = await runCliShellTmuxAction({
      input: {
        action: "layout-cover",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        sourceSurface: "pane",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      tmuxExecutor,
    });

    const verbs = tmuxExecutor.commands.map((command) => command.args[2] ?? command.args[0]);
    expect(result).toEqual({ ok: true, action: "layout-cover", closeCurrentSurface: true });
    expect(verbs).toContain("run-shell");
    expect(verbs).not.toContain("split-window");
    expect(verbs).not.toContain("kill-pane");
    const popupCommand = tmuxExecutor.commands.find((command) => command.args.includes("run-shell"));
    expect(tmuxExecutor.commands.filter((command) => command.args.includes("run-shell"))).toHaveLength(1);
    expect(popupCommand?.args).toContain("-b");
    expect(popupCommand?.args.join(" ")).toContain("display-popup");
    expect(popupCommand?.args.join(" ")).toContain("-c");
    expect(popupCommand?.args.join(" ")).toContain("client-1");
    expect(popupCommand?.args.join(" ")).toContain("@agenter_cli_shell_chat_owner");
  });

  test("Scenario: Given tmux cannot open the cover popup When real action switches from pane Then cli-shell restores pane state instead of leaving a ghost popup", async () => {
    const tmuxExecutor = new FakeTmuxExecutor({
      options: {
        "@agenter_cli_shell_chat_surface": "pane",
        "@agenter_cli_shell_chat_pane": "%1",
      },
      panes: [
        { paneId: "%0", startCommand: "shell" },
        { paneId: "%1", startCommand: "'bun' 'agenter-cli-shell.ts' 'room' '--session=shell-5' '--avatar=bangeel'" },
      ],
    });
    tmuxExecutor.failRunShell = true;

    await expect(
      runCliShellTmuxAction({
        input: {
          action: "layout-cover",
          shellName: "shell-5",
          avatarNickname: "bangeel",
          runtimeSessionId: "session:/repo:bangeel",
          targetPane: "%0",
          socketName: "agenter-cli-shell",
          sourceSurface: "pane",
          tmux: "tmux-test",
          cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
          daemonHost: "127.0.0.1",
          daemonPort: 4580,
        },
        tmuxExecutor,
      }),
    ).rejects.toThrow();

    const commands = tmuxExecutor.commands.map((command) => command.args.join(" "));
    expect(commands).toContain(
      "-L agenter-cli-shell set-option -t shell-5 @agenter_cli_shell_chat_surface popup",
    );
    expect(commands).toContain(
      "-L agenter-cli-shell set-option -t shell-5 @agenter_cli_shell_chat_surface pane",
    );
    expect(commands).toContain("-L agenter-cli-shell set-option -t shell-5 @agenter_cli_shell_chat_pane %1");
    expect(commands).toContain("-L agenter-cli-shell set-option -t shell-5 @agenter_cli_shell_active_action chat");
    expect(commands).not.toContain("-L agenter-cli-shell kill-pane -t %1");
  });

  test("Scenario: Given a top-layer notification is needed When app action runs Then cli-shell opens the shell top OpenTUI popup", async () => {
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
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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

  test("Scenario: Given OpenTUI Chat requests cover layout When app action runs Then tmux owns the layout through a popup", async () => {
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
        targetClient: "client-1",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    expect(result).toEqual({ ok: true, action: "layout-cover", closeCurrentSurface: false });
    expect(executed.map(readTmuxCommand)).toEqual(["run-shell"]);
    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain('kill-pane -t "$chat_pane"');
    expect(shell.indexOf('kill-pane -t "$chat_pane"')).toBeLessThan(
      shell.indexOf('display-popup', shell.indexOf('kill-pane -t "$chat_pane"')),
    );
    expect(executed[0]?.args.join(" ")).toContain("display-popup");
    expect(executed[0]?.args.join(" ")).toContain("@agenter_cli_shell_chat_default_layout 'cover'");
    expect(executed[0]?.args.join(" ")).toContain("'-c' 'client-1'");
    expect(executed[0]?.args.join(" ")).toContain("'-t' '%0'");
    expect(executed[0]?.args.join(" ")).toContain("AGENTER_CLI_SHELL_TMUX_TARGET_PANE=%0");
    expect(executed[0]?.args.join(" ")).toContain("AGENTER_CLI_SHELL_TMUX_TARGET_CLIENT=client-1");
  });

  test("Scenario: Given popup state accidentally keeps a stale pane When Chat cover runs Then the stale pane is removed before tmux short-circuits on popup state", async () => {
    const executed: CliShellTmuxStep[] = [];
    const executor = {
      which: async () => "/bin/tmux-test",
      run: async (step: CliShellTmuxStep) => {
        executed.push(step);
      },
    };

    await runCliShellTmuxAction({
      input: {
        action: "layout-cover",
        shellName: "shell-5",
        avatarNickname: "bangeel",
        runtimeSessionId: "session:/repo:bangeel",
        targetPane: "%0",
        socketName: "agenter-cli-shell",
        tmux: "tmux-test",
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
        daemonHost: "127.0.0.1",
        daemonPort: 4580,
      },
      executor,
    });

    const shell = executed[0]?.args.join(" ") ?? "";
    expect(shell).toContain('if [ "$chat_surface" = "popup" ] && [ -n "$chat_pane" ]; then');
    expect(shell).toContain('kill-pane -t "$chat_pane"');
    expect(shell.indexOf('kill-pane -t "$chat_pane"')).toBeLessThan(shell.indexOf('if [ "$chat_surface" = "popup" ]; then'));
  });

  test("Scenario: Given the status bar is refreshed When app action runs Then cli-shell updates the Heartbeat option before refreshing tmux", async () => {
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
        cliShellCommand: ["bun", "/repo/apps/cli-shell/src/bin/agenter-cli-shell.ts"],
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
