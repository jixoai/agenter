import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, test } from "bun:test";

import {
  buildTmuxStatusBarMouseBinding,
  buildTmuxStatusBarOptionCommands,
  installTmuxStatusBar,
  paneListFormat,
  quoteShellArg,
  readTmuxStatusUserRangeId,
  renderTmuxStatusBar,
  sessionListFormat,
  TmuxClient,
  TmuxCommandError,
  tmuxFormatEquals,
  tmuxStatusButton,
  tmuxStatusStyleValue,
  tmuxStatusText,
  type TmuxCommand,
  type TmuxExecResult,
  type TmuxExecutor,
} from "../src";

class RecordingExecutor implements TmuxExecutor {
  readonly commands: TmuxCommand[] = [];
  responses: TmuxExecResult[] = [];

  async exec(command: TmuxCommand): Promise<TmuxExecResult> {
    this.commands.push(command);
    return this.responses.shift() ?? { stdout: "", stderr: "", exitCode: 0 };
  }

  async which(executable: string): Promise<string | null> {
    return executable === "missing-tmux" ? null : executable;
  }
}

const createClient = (executor: RecordingExecutor): TmuxClient =>
  new TmuxClient({
    executable: "tmux-test",
    socketName: "socket-a",
    executor,
  });

describe("Feature: generic tmux client command API", () => {
  test("Scenario: Given a socket-scoped client When setting an option Then argv is tokenized without shell glue", async () => {
    const executor = new RecordingExecutor();
    const client = createClient(executor);

    await client.setOption({ target: "shell-1", name: "@product_state", value: "ready" });

    expect(executor.commands).toEqual([
      {
        executable: "tmux-test",
        args: ["-L", "socket-a", "set-option", "-t", "shell-1", "@product_state", "ready"],
      },
    ]);
  });

  test("Scenario: Given an unset tmux option When reading it Then null is returned without throwing", async () => {
    const executor = new RecordingExecutor();
    executor.responses.push({ stdout: "", stderr: "invalid option", exitCode: 1 });
    const client = createClient(executor);

    await expect(client.getOption({ target: "shell-1", name: "@missing" })).resolves.toBeNull();
    expect(executor.commands[0]?.args).toEqual(["-L", "socket-a", "show-options", "-qv", "-t", "shell-1", "@missing"]);
  });

  test("Scenario: Given tmux list output When listing panes Then stable pane facts are parsed", async () => {
    const executor = new RecordingExecutor();
    executor.responses.push({
      stdout: `%1\u001fshell-1\u001f@0\u001f0\u001f0\u001f1\u001fzsh\u001fbun room --session shell-1\u001f/repo\u001ftitle\n`,
      stderr: "",
      exitCode: 0,
    });
    const client = createClient(executor);

    const panes = await client.listPanes({ target: "shell-1" });

    expect(executor.commands[0]?.args).toEqual(["-L", "socket-a", "list-panes", "-t", "shell-1", "-F", paneListFormat]);
    expect(panes).toEqual([
      {
        paneId: "%1",
        sessionName: "shell-1",
        windowId: "@0",
        windowIndex: 0,
        paneIndex: 0,
        active: true,
        currentCommand: "zsh",
        startCommand: "bun room --session shell-1",
        currentPath: "/repo",
        title: "title",
      },
    ]);
  });

  test("Scenario: Given a split request When the pane starts a command Then tmux receives one shell-command argument only where tmux requires it", async () => {
    const executor = new RecordingExecutor();
    executor.responses.push({ stdout: "%2\n", stderr: "", exitCode: 0 });
    const client = createClient(executor);

    await expect(
      client.splitPane({
        target: "%1",
        direction: "left",
        cwd: "/repo",
        size: "42%",
        detached: true,
        command: ["bun", "room", "--session=shell-1"],
      }),
    ).resolves.toBe("%2");

    expect(executor.commands[0]?.args).toEqual([
      "-L",
      "socket-a",
      "split-window",
      "-P",
      "-F",
      "#{pane_id}",
      "-h",
      "-b",
      "-d",
      "-c",
      "/repo",
      "-l",
      "42%",
      "-t",
      "%1",
      "'bun' 'room' '--session=shell-1'",
    ]);
  });

  test("Scenario: Given an existing pane When moving it left Then tmux move-pane is argv-based", async () => {
    const executor = new RecordingExecutor();
    const client = createClient(executor);

    await client.movePane({ source: "%2", target: "%1", direction: "left", size: "42%", detached: true });

    expect(executor.commands[0]?.args).toEqual([
      "-L",
      "socket-a",
      "move-pane",
      "-d",
      "-h",
      "-b",
      "-s",
      "%2",
      "-t",
      "%1",
      "-l",
      "42%",
    ]);
  });

  test("Scenario: Given a popup request When opening it Then popup options stay typed and command quoting is contained", async () => {
    const executor = new RecordingExecutor();
    const client = createClient(executor);

    await client.displayPopup({
      target: "%1",
      title: "Help",
      width: "80%",
      height: "70%",
      closeOnExit: true,
      command: ["printf", "hello world"],
    });

    expect(executor.commands[0]?.args).toEqual([
      "-L",
      "socket-a",
      "display-popup",
      "-t",
      "%1",
      "-E",
      "-w",
      "80%",
      "-h",
      "70%",
      "-T",
      "Help",
      "'printf' 'hello world'",
    ]);
  });

  test("Scenario: Given a target client When closing a popup Then tmux receives the client identity on the close command", async () => {
    const executor = new RecordingExecutor();
    const client = createClient(executor);

    await client.closePopup({
      targetClient: "client-1",
    });

    expect(executor.commands[0]?.args).toEqual(["-L", "socket-a", "display-popup", "-c", "client-1", "-C"]);
  });

  test("Scenario: Given a target client When opening a popup Then tmux receives client identity separately from the pane target", async () => {
    const executor = new RecordingExecutor();
    const client = createClient(executor);

    await client.displayPopup({
      targetClient: "client-1",
      target: "%1",
      title: "Help",
      closeOnExit: true,
      command: ["printf", "hello"],
    });

    expect(executor.commands[0]?.args).toEqual([
      "-L",
      "socket-a",
      "display-popup",
      "-c",
      "client-1",
      "-t",
      "%1",
      "-E",
      "-T",
      "Help",
      "'printf' 'hello'",
    ]);
  });

  test("Scenario: Given tmux returns a failure When executing a command Then the typed error keeps command evidence", async () => {
    const executor = new RecordingExecutor();
    executor.responses.push({ stdout: "", stderr: "bad target", exitCode: 1 });
    const client = createClient(executor);

    await expect(client.killPane("%missing")).rejects.toBeInstanceOf(TmuxCommandError);
  });

  test("Scenario: Given shell arguments contain quotes When converting a command Then POSIX quoting is deterministic", () => {
    expect(quoteShellArg("can't")).toBe("'can'\\''t'");
  });

  test("Scenario: Given tmux is unavailable When asserting availability Then a clear error is raised", async () => {
    const executor = new RecordingExecutor();
    const client = new TmuxClient({ executable: "missing-tmux", executor });

    await expect(client.assertAvailable()).rejects.toThrow("tmux executable not found");
  });

  test("Scenario: Given sessions are listed When parsing output Then numeric and boolean fields are normalized", async () => {
    const executor = new RecordingExecutor();
    executor.responses.push({ stdout: "shell-1\u001f2\u001f1\u001f123\n", stderr: "", exitCode: 0 });
    const client = createClient(executor);

    await expect(client.listSessions()).resolves.toEqual([
      {
        sessionName: "shell-1",
        windows: 2,
        attached: true,
        createdAt: 123,
      },
    ]);
    expect(executor.commands[0]?.args).toEqual(["-L", "socket-a", "list-sessions", "-F", sessionListFormat]);
  });
});

describe("Feature: generic tmux status bar model", () => {
  test("Scenario: Given text and buttons When rendering a status bar Then tmux status format is generated without product semantics", () => {
    const rendered = renderTmuxStatusBar({
      defaultStyle: {
        fg: "colour252",
        bg: "colour234",
      },
      left: {
        gap: " ",
        items: [
          tmuxStatusText("host", { fg: "colour51", bold: true }),
          tmuxStatusButton({
            id: "run",
            label: "Run",
            active: "#{==:#{@mode},run}",
            style: { fg: "colour159", bg: "colour234" },
            activeStyle: { fg: "colour16", bg: "colour220", bold: true },
          }),
        ],
      },
      right: {
        items: [
          tmuxStatusButton({ id: "help", label: "Help", style: { fg: "colour159" } }),
          tmuxStatusButton({ id: "chat", label: "Chat", active: true, activeStyle: { fg: "colour16", bg: "colour220" } }),
        ],
      },
    });

    expect(rendered.buttonIds).toEqual(["run", "help", "chat"]);
    expect(rendered.statusLeft.includes("host")).toBe(true);
    expect(rendered.statusLeft.includes("#[range=user|run]")).toBe(true);
    expect(rendered.statusLeft.includes("#{?#{==:#{@mode},run},")).toBe(true);
    expect(rendered.statusLeft.includes("fg=colour16#,bg=colour220#,bold")).toBe(true);
    expect(rendered.statusLeft.includes("fg=colour159#,bg=colour234")).toBe(true);
    expect(rendered.statusLeft.includes("Run")).toBe(true);
    expect(rendered.statusLeft.includes("#[norange]")).toBe(true);
    expect(rendered.statusRight.includes("#[range=user|help]")).toBe(true);
    expect(rendered.statusRight.includes("#[range=user|chat]")).toBe(true);
    expect(rendered.statusRight.includes("product")).toBe(false);
    expect(rendered.statusRight.includes("domain")).toBe(false);
  });

  test("Scenario: Given a format equality expression When comparing values Then tmux conditional separators are escaped", () => {
    expect(tmuxFormatEquals("#{@mode}", "run")).toBe("#{==:#{@mode},run}");
    expect(tmuxFormatEquals("#{@mode}", "left,right")).toBe("#{==:#{@mode},left#,right}");
  });

  test("Scenario: Given a range id exceeds tmux limits When creating a button Then the model rejects it before rendering", () => {
    expect(() => tmuxStatusButton({ id: "this-id-is-too-long", label: "Bad" })).toThrow(
      "tmux status range id must be at most 15 bytes",
    );
  });

  test("Scenario: Given a range id contains a separator When creating a button Then the model rejects ambiguous ids", () => {
    expect(() => tmuxStatusButton({ id: "bad|id", label: "Bad" })).toThrow('tmux status range id cannot contain "|"');
  });

  test("Scenario: Given tmux status option input When building commands Then the model emits generic set-option argv", () => {
    const commands = buildTmuxStatusBarOptionCommands({
      target: "session-a",
      enabled: true,
      position: "bottom",
      style: { fg: "colour252", bg: "colour234" },
      leftStyle: "fg=white,bg=black",
      rightStyle: { fg: "colour252", bg: "colour234" },
      leftLength: 40,
      rightLength: "80",
      windowStatusFormat: "",
      windowStatusCurrentFormat: "",
      definition: {
        defaultStyle: { fg: "colour252", bg: "colour234" },
        left: {
          items: [tmuxStatusText("host")],
        },
        right: {
          items: [tmuxStatusButton({ id: "run", label: "Run" })],
        },
      },
    });

    expect(commands.map((command) => command.args.slice(0, 4))).toEqual([
      ["set-option", "-t", "session-a", "status"],
      ["set-option", "-t", "session-a", "status-position"],
      ["set-option", "-t", "session-a", "status-style"],
      ["set-option", "-t", "session-a", "status-left-style"],
      ["set-option", "-t", "session-a", "status-right-style"],
      ["set-option", "-t", "session-a", "status-left"],
      ["set-option", "-t", "session-a", "status-left-length"],
      ["set-option", "-t", "session-a", "status-right-length"],
      ["set-option", "-t", "session-a", "status-right"],
      ["set-option", "-t", "session-a", "window-status-format"],
      ["set-option", "-t", "session-a", "window-status-current-format"],
    ]);
    expect(commands[2]?.args.at(-1)).toBe("fg=colour252,bg=colour234,nobold,noitalics,nounderscore,noreverse,nodim,noblink");
    expect((commands[5]?.args.at(-1) ?? "").includes("host")).toBe(true);
    expect((commands[8]?.args.at(-1) ?? "").includes("range=user|run")).toBe(true);
  });

  test("Scenario: Given a status bar targets a minimum client width When left and right lengths exceed that budget Then configuration fails before tmux misroutes mouse ranges", () => {
    expect(() =>
      buildTmuxStatusBarOptionCommands({
        target: "session-a",
        minClientColumns: 80,
        leftLength: 80,
        rightLength: 120,
        definition: {
          left: { items: [tmuxStatusButton({ id: "left", label: "Left" })] },
          right: { items: [tmuxStatusButton({ id: "right", label: "Right" })] },
        },
      }),
    ).toThrow("tmux status bar length budget exceeds minimum client columns");
  });

  test("Scenario: Given a status bar targets a minimum client width When left and right lengths fit Then options are emitted normally", () => {
    const commands = buildTmuxStatusBarOptionCommands({
      target: "session-a",
      minClientColumns: 80,
      leftLength: 54,
      rightLength: 24,
      definition: {
        left: { items: [tmuxStatusButton({ id: "left", label: "Left" })] },
        right: { items: [tmuxStatusButton({ id: "right", label: "Right" })] },
      },
    });

    expect(commands.some((command) => command.args.includes("status-left-length") && command.args.includes("54"))).toBe(
      true,
    );
    expect(
      commands.some((command) => command.args.includes("status-right-length") && command.args.includes("24")),
    ).toBe(true);
  });

  test("Scenario: Given a status bar installer When installing Then a generic client receives only tmux argv", async () => {
    const executor = new RecordingExecutor();
    const client = createClient(executor);

    const rendered = await installTmuxStatusBar(client, {
      target: "session-a",
      position: "bottom",
      definition: {
        left: { items: [tmuxStatusText("host")] },
        right: { items: [tmuxStatusButton({ id: "run", label: "Run" })] },
      },
    });

    expect(rendered.buttonIds).toEqual(["run"]);
    expect(executor.commands.map((command) => command.args.slice(0, 5))).toEqual([
      ["-L", "socket-a", "set-option", "-t", "session-a"],
      ["-L", "socket-a", "set-option", "-t", "session-a"],
      ["-L", "socket-a", "set-option", "-t", "session-a"],
      ["-L", "socket-a", "set-option", "-t", "session-a"],
    ]);
    expect(executor.commands.map((command) => command.args.at(-2))).toEqual([
      "status",
      "status-position",
      "status-left",
      "status-right",
    ]);
  });

  test("Scenario: Given tmux status range payloads When reading user range ids Then reserved ranges are ignored and user ids are normalized", () => {
    expect(readTmuxStatusUserRangeId("user|help")).toBe("help");
    expect(readTmuxStatusUserRangeId(" chat ")).toBe("chat");
    expect(readTmuxStatusUserRangeId("left")).toBeNull();
    expect(readTmuxStatusUserRangeId("pane")).toBeNull();
    expect(() => readTmuxStatusUserRangeId("user|bad|id")).toThrow('tmux status range id cannot contain "|"');
  });

  test("Scenario: Given a click dispatcher command When binding status mouse Then tmux receives a generic mouse binding", () => {
    const binding = buildTmuxStatusBarMouseBinding({
      table: "root",
      event: "MouseUp1Status",
      command: [
        "env",
        "BUTTON=#{q:mouse_status_range}",
        "CLIENT=#{q:client_name}",
        "PANE=#{q:pane_id}",
        "handler",
      ],
    });

    expect(binding).toEqual([
      "bind-key",
      "-T",
      "root",
      "MouseUp1Status",
      "run-shell",
      "env BUTTON=#{q:mouse_status_range} CLIENT=#{q:client_name} PANE=#{q:pane_id} handler",
    ]);
  });

  test("Scenario: Given a fallback command When binding status mouse Then non-user ranges can be ignored explicitly", () => {
    const binding = buildTmuxStatusBarMouseBinding({
      command: "handler --button #{q:mouse_status_range}",
      unknownRangeCommand: "display-message ignored-status-range",
    });

    expect(binding).toEqual([
      "bind-key",
      "MouseDown1Status",
      "run-shell",
      'case "#{mouse_status_range}" in ""|left|right|session|window|pane) display-message ignored-status-range ;; *) handler --button #{q:mouse_status_range} ;; esac',
    ]);
  });

  test("Scenario: Given an active button format When tmux expands it Then conditional style branches remain parseable", async () => {
    const tmuxPath = Bun.which("tmux");
    if (!tmuxPath) {
      return;
    }
    const socketName = `agenter-tmux-status-format-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sessionName = "status-format-test";
    const client = new TmuxClient({ executable: tmuxPath, socketName });
    const rendered = renderTmuxStatusBar({
      defaultStyle: { fg: "colour252", bg: "colour234" },
      right: {
        items: [
          tmuxStatusButton({
            id: "help",
            label: " Help ",
            active: "#{==:1,1}",
            style: { fg: "colour159", bg: "colour234", bold: false },
            activeStyle: { fg: "colour16", bg: "colour220", bold: true },
          }),
        ],
      },
    });

    try {
      await client.newSession({ sessionName, detached: true, command: ["sh", "-lc", "sleep 60"] });
      const expanded = await client.capture(["display-message", "-p", "-t", sessionName, rendered.statusRight]);

      expect(expanded.includes("bg=colour220")).toBe(true);
      expect(expanded.includes("Help")).toBe(true);
      expect(expanded.trim().length > 0).toBe(true);
    } finally {
      await client.killSession(sessionName).catch(() => undefined);
    }
  });
});

describe("Feature: tmux client isolated integration", () => {
  const tempDirs: string[] = [];

  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("Scenario: Given tmux is installed When using an isolated socket Then session and pane operations do not touch user sessions", async () => {
    const tmuxPath = Bun.which("tmux");
    if (!tmuxPath) {
      return;
    }
    const cwd = mkdtempSync(join(tmpdir(), "tmux-client-"));
    tempDirs.push(cwd);
    const socketName = `agenter-tmux-client-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sessionName = "sdk-test";
    const client = new TmuxClient({ executable: tmuxPath, socketName });

    try {
      await client.newSession({ sessionName, detached: true, cwd, command: ["sh", "-lc", "sleep 60"] });
      await expect(client.hasSession(sessionName)).resolves.toBe(true);
      await client.setOption({ target: sessionName, name: "@sdk_test", value: "ok" });
      await expect(client.getOption({ target: sessionName, name: "@sdk_test" })).resolves.toBe("ok");
      const firstPanes = await client.listPanes({ target: sessionName });
      expect(firstPanes).toHaveLength(1);
      const newPaneId = await client.splitPane({
        target: firstPanes[0]?.paneId,
        direction: "right",
        detached: true,
        command: ["sh", "-lc", "sleep 60"],
      });
      expect(newPaneId.startsWith("%")).toBe(true);
      const panes = await client.listPanes({ target: sessionName });
      expect(panes.length).toBeGreaterThanOrEqual(2);
    } finally {
      await client.killSession(sessionName).catch(() => undefined);
    }
  });

  test(
    "Scenario: Given generic left and right status actions When clicked in an 80-column tmux client Then user range ids stay isolated",
    async () => {
      const tmuxPath = Bun.which("tmux");
      const expectPath = Bun.which("expect");
      if (!tmuxPath || !expectPath) {
        return;
      }
      const cwd = mkdtempSync(join(tmpdir(), "tmux-client-status-"));
      tempDirs.push(cwd);
      const outputPath = join(cwd, "ranges.txt");
      const socketName = `agenter-tmux-status-range-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const sessionName = "status-range-test";
      const client = new TmuxClient({ executable: tmuxPath, socketName });
      const rendered = renderTmuxStatusBar({
        defaultStyle: { fg: "colour252", bg: "colour234" },
        left: {
          gap: "  ",
          items: [
            tmuxStatusText("generic-host"),
            tmuxStatusButton({ id: "left-action", label: " managed " }),
            tmuxStatusText("heartbeat heartbeat heartbeat heartbeat heartbeat"),
          ],
        },
        right: {
          gap: "  ",
          items: [
            tmuxStatusButton({ id: "help", label: " Help " }),
            tmuxStatusButton({ id: "chat", label: " Chat " }),
          ],
        },
      });
      const statusStyle = tmuxStatusStyleValue({ fg: "colour252", bg: "colour234" });

      try {
        await client.newSession({ sessionName, detached: true, cwd, command: ["sh", "-lc", "sleep 60"] });
        await client.setOption({ target: sessionName, name: "mouse", value: "on" });
        await client.setOption({ target: sessionName, name: "status", value: "on" });
        await client.setOption({ target: sessionName, name: "status-position", value: "bottom" });
        await client.setOption({ target: sessionName, name: "status-style", value: statusStyle });
        await client.setOption({ target: sessionName, name: "status-left-style", value: statusStyle });
        await client.setOption({ target: sessionName, name: "status-right-style", value: statusStyle });
        await client.setOption({ target: sessionName, name: "status-left", value: rendered.statusLeft });
        await client.setOption({ target: sessionName, name: "status-left-length", value: "54" });
        await client.setOption({ target: sessionName, name: "status-right-length", value: "24" });
        await client.setOption({ target: sessionName, name: "status-right", value: rendered.statusRight });
        await client.exec([
          "bind-key",
          "-T",
          "root",
          "MouseDown1Status",
          "run-shell",
          `printf '%s:%s:%s\\n' '#{mouse_x}' '#{mouse_y}' '#{mouse_status_range}' >> ${quoteShellArg(outputPath)}`,
        ]);

        await runExpectMouseClicks({
          expectPath,
          tmuxPath,
          socketName,
          sessionName,
          columns: 80,
          rows: 24,
          xCoordinates: [24, 66, 68, 69, 70, 72, 74, 75, 76, 78],
        });

        const ranges = await waitForStatusRanges(outputPath, ["left-action", "help", "chat"]);

        expect(ranges.includes("left-action")).toBe(true);
        expect(ranges.includes("help")).toBe(true);
        expect(ranges.includes("chat")).toBe(true);
      } finally {
        await client.killSession(sessionName).catch(() => undefined);
      }
    },
    10_000,
  );
});

const runExpectMouseClicks = async (input: {
  expectPath: string;
  tmuxPath: string;
  socketName: string;
  sessionName: string;
  columns: number;
  rows: number;
  xCoordinates: readonly number[];
}): Promise<void> => {
  const clickScript = input.xCoordinates
    .map((x) => `send "\\033\\[<0;${x};${input.rows}M"; after 20; send "\\033\\[<0;${x};${input.rows}m"; after 40`)
    .join("; ");
  const script = [
    "set timeout 4",
    `spawn -noecho env TERM=xterm-256color ${input.tmuxPath} -L ${input.socketName} attach -t ${input.sessionName}`,
    `stty rows ${input.rows} columns ${input.columns}`,
    "after 400",
    clickScript,
    "after 400",
    'send "\\002d"',
    "expect eof",
  ].join("; ");
  const proc = Bun.spawn([input.expectPath, "-c", script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`expect tmux mouse probe failed with ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
};

const readStatusRangeOutput = (path: string): string[] => {
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .map((line: string) => line.trim().split(":").at(-1)?.trim() ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
};

const waitForStatusRanges = async (path: string, expected: readonly string[]): Promise<string[]> => {
  const deadline = Date.now() + 2_000;
  let ranges: string[] = [];
  do {
    ranges = readStatusRangeOutput(path);
    if (expected.every((range) => ranges.includes(range))) {
      return ranges;
    }
    await delay(50);
  } while (Date.now() < deadline);
  return ranges;
};

const delay = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};
