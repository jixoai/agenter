import { useEffect, useMemo, useRef, useState } from "react";
import type { TextRenderable } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";

import { readTerminalOutput } from "../../../packages/terminal/src";
import type { RuntimeConfig } from "../app/runtime-config";
import { createEmptySnapshot, type DebugLogLine, type TerminalSnapshot } from "../core/protocol";
import { TerminalAdapter } from "../core/terminal-adapter";
import { DebugLogger } from "../infra/logger";
import { TerminalPanel } from "../ui/panels/TerminalPanel";
import { ArtifactStore } from "./artifact-store";
import { encodeTerminalKey } from "./terminal-input";

type FocusTarget = "terminal" | "devtools";

const clamp = (value: number, min: number): number => Math.max(min, value);

const formatMeta = (line: DebugLogLine): string => {
  if (!line.meta) {
    return "";
  }
  const parts = Object.entries(line.meta).map(([key, value]) => `${key}=${String(value)}`);
  return parts.length === 0 ? "" : ` | ${parts.join(" ")}`;
};

const formatLogLine = (line: DebugLogLine): string => {
  const time = new Date(line.timestamp).toISOString().slice(11, 23);
  return `${time} [${line.channel}/${line.level}] ${line.message}${formatMeta(line)}`;
};

const decoder = new TextDecoder();

const runGitCommand = (cwd: string, args: string[]): { ok: boolean; code: number; stdout: string; stderr: string } => {
  const result = Bun.spawnSync({
    cmd: ["git", ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    ok: result.exitCode === 0,
    code: result.exitCode,
    stdout: decoder.decode(result.stdout).trimEnd(),
    stderr: decoder.decode(result.stderr).trimEnd(),
  };
};

const ensureGitHead = (cwd: string): { ok: true; hash: string } | { ok: false; error: string } => {
  const head = runGitCommand(cwd, ["rev-parse", "HEAD"]);
  if (head.ok && head.stdout) {
    return { ok: true, hash: head.stdout };
  }

  const add = runGitCommand(cwd, ["add", "-A"]);
  if (!add.ok) {
    return {
      ok: false,
      error: `git add failed: ${add.stderr || add.stdout || `code=${add.code}`}`,
    };
  }

  const commit = runGitCommand(cwd, ["commit", "--allow-empty", "-m", "devtools(mark): baseline"]);
  if (!commit.ok) {
    return {
      ok: false,
      error: `git commit failed: ${commit.stderr || commit.stdout || `code=${commit.code}`}`,
    };
  }

  const nextHead = runGitCommand(cwd, ["rev-parse", "HEAD"]);
  if (!nextHead.ok || !nextHead.stdout) {
    return {
      ok: false,
      error: `git rev-parse failed after baseline commit: ${nextHead.stderr || nextHead.stdout || `code=${nextHead.code}`}`,
    };
  }
  return { ok: true, hash: nextHead.stdout };
};

interface TerminalDevtoolsAppProps {
  runtimeConfig: RuntimeConfig;
}

export const TerminalDevtoolsApp = ({ runtimeConfig }: TerminalDevtoolsAppProps) => {
  const renderer = useRenderer();
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const logger = useMemo(() => new DebugLogger("logs/terminal-devtools", 3200), []);
  const artifacts = useMemo(() => new ArtifactStore("logs/terminal-devtools"), []);
  const adapter = useMemo(
    () =>
      new TerminalAdapter(logger, {
        terminalId: runtimeConfig.terminal.terminalId,
        command: runtimeConfig.terminal.command,
        commandLabel: runtimeConfig.terminal.commandLabel,
        cwd: runtimeConfig.agentCwd,
        cols: 80,
        rows: 20,
        outputRoot: runtimeConfig.terminal.outputRoot,
        gitLog: runtimeConfig.terminal.gitLog,
      }),
    [logger, runtimeConfig.agentCwd, runtimeConfig.terminal],
  );

  const [focus, setFocus] = useState<FocusTarget>("terminal");
  const [logs, setLogs] = useState<DebugLogLine[]>(() => logger.getRecent(240));
  const [snapshot, setSnapshot] = useState<TerminalSnapshot>(createEmptySnapshot());
  const [displaySeq, setDisplaySeq] = useState<number | null>(null);
  const [processState, setProcessState] = useState<"running" | "stopped">("stopped");
  const [scrollOffset, setScrollOffset] = useState(0);
  const [terminalSize, setTerminalSize] = useState<{ cols: number; rows: number } | null>(null);
  const startedRef = useRef(false);
  const [dirtyState, setDirtyState] = useState({
    active: false,
    markHash: "none",
    releaseHash: "none",
    diffBytes: 0,
  });

  const terminalContentRef = useRef<TextRenderable | null>(null);
  const logsContentRef = useRef<TextRenderable | null>(null);
  const historyRef = useRef<TerminalSnapshot[]>([]);
  const markCommitRef = useRef<{ hash: string; timestamp: number } | null>(null);

  useEffect(() => {
    const stopLogs = logger.subscribe((line) => {
      setLogs((prev) => [...prev.slice(-3199), line]);
    });
    const stopSnapshot = adapter.onSnapshot((next) => {
      setSnapshot(next);
      historyRef.current.push(next);
      if (historyRef.current.length > 500) {
        historyRef.current.shift();
      }
    });
    const stopStatus = adapter.onStatus((running, status) => {
      setProcessState(running ? "running" : "stopped");
      logger.log({
        channel: "ui",
        level: "debug",
        message: "devtools.terminal.status",
        meta: { running, status },
      });
    });

    return () => {
      startedRef.current = false;
      stopStatus();
      stopSnapshot();
      stopLogs();
      void adapter.stop();
      setProcessState("stopped");
    };
  }, [adapter, logger, runtimeConfig.agentCwd, runtimeConfig.terminal]);

  useEffect(() => {
    const innerWidth = clamp(termWidth - 2, 20);
    const innerHeight = clamp(termHeight - 3, 8);
    const leftWidth = clamp(Math.floor(innerWidth * 0.6), 24);
    const leftInnerWidth = clamp(leftWidth - 4, 12);
    const leftInnerHeight = clamp(innerHeight - 4, 6);
    const cols = leftInnerWidth;
    const rows = clamp(leftInnerHeight - 2, 4);
    setTerminalSize((prev) => {
      if (prev && prev.cols === cols && prev.rows === rows) {
        return prev;
      }
      return { cols, rows };
    });
  }, [termHeight, termWidth]);

  useEffect(() => {
    if (!terminalSize) {
      return;
    }
    if (!startedRef.current) {
      try {
        // Set desired size before start so the first PTY/xterm init uses panel size directly.
        adapter.resize(terminalSize.cols, terminalSize.rows);
        adapter.start();
        startedRef.current = true;
        logger.log({
          channel: "ui",
          level: "info",
          message: "devtools.started",
          meta: {
            cwd: runtimeConfig.agentCwd,
            terminal: runtimeConfig.terminal.commandLabel,
            logsFile: logger.getFilePath(),
            workspace: adapter.getWorkspace() ?? "none",
            outputDir: adapter.getOutputDir() ?? "none",
            cols: terminalSize.cols,
            rows: terminalSize.rows,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.log({ channel: "error", level: "error", message: `devtools start failed: ${message}` });
      }
      return;
    }
    adapter.resize(terminalSize.cols, terminalSize.rows);
  }, [adapter, logger, runtimeConfig.agentCwd, runtimeConfig.terminal.commandLabel, terminalSize]);

  const resolveDisplaySnapshot = (): TerminalSnapshot => {
    if (displaySeq === null) {
      return snapshot;
    }
    const hit = [...historyRef.current].reverse().find((item) => item.seq === displaySeq);
    return hit ?? snapshot;
  };

  const markDirty = async (): Promise<void> => {
    if (!runtimeConfig.terminal.gitLog) {
      logger.log({
        channel: "error",
        level: "error",
        message: "devtools.action.markDirty failed: git-log is disabled",
      });
      return;
    }
    const workspace = adapter.getWorkspace();
    if (!workspace) {
      logger.log({ channel: "error", level: "error", message: "devtools.action.markDirty failed: workspace not ready" });
      return;
    }

    await adapter.forceCommit();
    const head = ensureGitHead(workspace);
    if (!head.ok) {
      logger.log({
        channel: "error",
        level: "error",
        message: "devtools.action.markDirty failed: git HEAD unavailable",
        meta: { error: head.error },
      });
      return;
    }

    markCommitRef.current = { hash: head.hash, timestamp: Date.now() };
    setDirtyState((prev) => ({
      active: true,
      markHash: head.hash,
      releaseHash: prev.releaseHash,
      diffBytes: prev.diffBytes,
    }));
    logger.log({
      channel: "ui",
      level: "info",
      message: "devtools.action.markDirty",
      meta: { markHash: head.hash },
    });
  };

  const releaseDirty = async (): Promise<void> => {
    if (!runtimeConfig.terminal.gitLog) {
      logger.log({
        channel: "error",
        level: "error",
        message: "devtools.action.releaseDirty failed: git-log is disabled",
      });
      return;
    }
    const mark = markCommitRef.current;
    if (!mark) {
      logger.log({ channel: "ui", level: "warn", message: "devtools.action.releaseDirty skipped: mark missing" });
      return;
    }

    const workspace = adapter.getWorkspace();
    if (!workspace) {
      logger.log({ channel: "error", level: "error", message: "devtools.action.releaseDirty failed: workspace not ready" });
      return;
    }

    await adapter.forceCommit();
    const head = ensureGitHead(workspace);
    if (!head.ok) {
      logger.log({
        channel: "error",
        level: "error",
        message: "devtools.action.releaseDirty failed: git HEAD unavailable",
        meta: { error: head.error },
      });
      return;
    }

    const diff = runGitCommand(workspace, ["diff", "--no-color", "--patience", mark.hash, "--", "output"]);
    if (!diff.ok) {
      logger.log({
        channel: "error",
        level: "error",
        message: "devtools.action.releaseDirty failed: git diff error",
        meta: { code: diff.code, stderr: diff.stderr || "empty" },
      });
      return;
    }

    if (diff.stdout.length === 0) {
      logger.log({
        channel: "error",
        level: "error",
        message: "devtools.action.releaseDirty failed: diff is empty since mark",
        meta: { markHash: mark.hash, releaseHash: head.hash },
      });
      return;
    }

    const patchPath = artifacts.saveText("dirty-release", diff.stdout, "patch");
    const metaPath = artifacts.save("dirty-release-meta", {
      markHash: mark.hash,
      releaseHash: head.hash,
      markTimestamp: mark.timestamp,
      releaseTimestamp: Date.now(),
      patchPath,
      strategy: "git-diff-patience",
    });

    markCommitRef.current = null;
    setDirtyState({
      active: false,
      markHash: mark.hash,
      releaseHash: head.hash,
      diffBytes: diff.stdout.length,
    });
    logger.log({
      channel: "ui",
      level: "info",
      message: "devtools.action.releaseDirty",
      meta: {
        patchPath,
        metaPath,
        markHash: mark.hash,
        releaseHash: head.hash,
        bytes: diff.stdout.length,
      },
    });
  };

  const releaseDirtyWithGuard = (): void => {
    if (!markCommitRef.current) {
      logger.log({ channel: "ui", level: "warn", message: "devtools.action.releaseDirty blocked: mark first (Ctrl+1)" });
      return;
    }
    void releaseDirty();
  };

  const saveSnapshot = async (): Promise<void> => {
    const outputDir = adapter.getOutputDir();
    if (!outputDir) {
      logger.log({ channel: "error", level: "error", message: "devtools.action.snapshot failed: output dir not ready" });
      return;
    }

    try {
      const html = await readTerminalOutput({ outputDir, offset: 0, limit: -1 });
      const path = artifacts.saveText("snapshot", html, "html");
      logger.log({
        channel: "ui",
        level: "info",
        message: "devtools.action.snapshot",
        meta: {
          path,
          outputDir,
          lines: html.length === 0 ? 0 : html.split("\n").length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.log({ channel: "error", level: "error", message: `devtools.action.snapshot failed: ${message}` });
    }
  };

  const getTerminalInfo = (): void => {
    logger.log({
      channel: "ui",
      level: "info",
      message: "devtools.action.getTerminalInfo",
      meta: {
        running: adapter.isRunning(),
        workspace: adapter.getWorkspace() ?? "none",
        outputDir: adapter.getOutputDir() ?? "none",
        cols: snapshot.cols,
        rows: snapshot.rows,
        seq: snapshot.seq,
        cursorX: snapshot.cursor.x,
        cursorY: snapshot.cursor.y,
        gitLog: runtimeConfig.terminal.gitLog ?? "none",
      },
    });
  };

  const scrollToPrev = (): void => {
    const history = historyRef.current;
    if (history.length < 2) {
      return;
    }
    const currentSeq = displaySeq ?? history[history.length - 1]?.seq ?? 0;
    const idx = history.findIndex((item) => item.seq === currentSeq);
    const target = history[Math.max(0, idx - 1)] ?? history[history.length - 2];
    if (!target) {
      return;
    }
    setDisplaySeq(target.seq);
    logger.log({
      channel: "ui",
      level: "info",
      message: "devtools.action.scrollTo",
      meta: { mode: "prev", seq: target.seq },
    });
  };

  const scrollToLatest = (): void => {
    setDisplaySeq(null);
    logger.log({
      channel: "ui",
      level: "info",
      message: "devtools.action.scrollTo",
      meta: { mode: "latest", seq: snapshot.seq },
    });
  };

  const copyLogsSelection = (): void => {
    const selected = logsContentRef.current?.getSelectedText() ?? "";
    if (!selected) {
      return;
    }
    const ok = renderer.copyToClipboardOSC52(selected);
    logger.log({
      channel: "ui",
      level: ok ? "info" : "warn",
      message: ok ? "devtools.copy.logs" : "devtools.copy.failed",
    });
  };

  useKeyboard((key) => {
    if (key.ctrl && key.name === "q") {
      void adapter.stop();
      renderer.destroy();
      return true;
    }
    if (key.name === "tab") {
      setFocus((prev) => (prev === "terminal" ? "devtools" : "terminal"));
      return true;
    }
    if (key.ctrl && key.name === "1") {
      void markDirty();
      return true;
    }
    if (key.ctrl && key.name === "2") {
      releaseDirtyWithGuard();
      return true;
    }
    if (key.ctrl && key.name === "3") {
      void saveSnapshot();
      return true;
    }
    if (key.ctrl && key.name === "4") {
      getTerminalInfo();
      return true;
    }
    if (key.ctrl && key.name === "5") {
      scrollToPrev();
      return true;
    }
    if (key.ctrl && key.name === "6") {
      scrollToLatest();
      return true;
    }
    if ((key.ctrl && key.shift && key.name === "c") || (key.meta && key.name === "c")) {
      copyLogsSelection();
      return true;
    }
    if (focus === "devtools") {
      if (key.name === "up") {
        setScrollOffset((prev) => prev + 1);
        return true;
      }
      if (key.name === "down") {
        setScrollOffset((prev) => Math.max(0, prev - 1));
        return true;
      }
      return false;
    }
    if (focus === "terminal") {
      if (key.ctrl && key.name === "c") {
        adapter.interrupt();
        logger.log({ channel: "ui", level: "warn", message: "devtools.interrupt" });
        return true;
      }
      const encoded = encodeTerminalKey(key);
      if (!encoded) {
        return false;
      }
      adapter.write(encoded);
      return true;
    }
    return false;
  });

  const renderSnapshot = resolveDisplaySnapshot();
  const end = Math.max(0, logs.length - scrollOffset);
  const start = Math.max(0, end - 18);
  const visibleLogs = logs.slice(start, end);
  const focusText = focus === "terminal" ? "terminal" : "devtools";

  return (
    <box flexDirection="column" width="100%" height="100%" padding={1}>
      <box border borderColor="gray" padding={1} flexDirection="row" justifyContent="space-between">
        <text>
          mode=<strong>terminal-devtools</strong> focus=<strong>{focusText}</strong> process=<strong>{processState}</strong> cwd=
          <strong>{runtimeConfig.agentCwd}</strong> terminal=<strong>{runtimeConfig.terminal.commandLabel}</strong>
        </text>
        <text>{logger.getFilePath()}</text>
      </box>
      <box flexDirection="row" flexGrow={1}>
        <TerminalPanel snapshot={renderSnapshot} focused={focus === "terminal"} contentRef={terminalContentRef} />
        <box border borderColor={focus === "devtools" ? "cyan" : "gray"} flexDirection="column" padding={1} width="40%" height="100%">
          <text>{focus === "devtools" ? "devtools *" : "devtools"}</text>
          <box border borderColor="gray" padding={1} flexDirection="column" marginTop={1}>
            <box flexDirection="row">
              <box border padding={1} minWidth={22} onMouseDown={() => void markDirty()}>
                <text>[Ctrl+1] markDirty</text>
              </box>
              <box
                border
                borderColor={markCommitRef.current ? "gray" : "yellow"}
                padding={1}
                minWidth={24}
                marginLeft={1}
                onMouseDown={releaseDirtyWithGuard}
              >
                <text>[Ctrl+2] releaseDirty</text>
              </box>
            </box>
            <box flexDirection="row" marginTop={1}>
              <box border padding={1} minWidth={22} onMouseDown={() => void saveSnapshot()}>
                <text>[Ctrl+3] snapshot</text>
              </box>
              <box border padding={1} minWidth={24} marginLeft={1} onMouseDown={getTerminalInfo}>
                <text>[Ctrl+4] getTerminalInfo</text>
              </box>
            </box>
            <box flexDirection="row" marginTop={1}>
              <box border padding={1} minWidth={22} onMouseDown={scrollToPrev}>
                <text>[Ctrl+5] scrollTo(prev)</text>
              </box>
              <box border padding={1} minWidth={24} marginLeft={1} onMouseDown={scrollToLatest}>
                <text>[Ctrl+6] scrollTo(latest)</text>
              </box>
            </box>
          </box>
          <text marginTop={1}>
            dirty={dirtyState.active ? "true" : "false"} mark={dirtyState.markHash} release={dirtyState.releaseHash} bytes={dirtyState.diffBytes}
          </text>
          <text>{markCommitRef.current ? "release ready" : "release blocked: mark first"}</text>
          <text>viewSeq={displaySeq ?? snapshot.seq} | Tab 切焦点 | Ctrl+C(terminal)=interrupt | Ctrl+Q=quit</text>
          <scrollbox border borderColor="gray" padding={1} marginTop={1} flexGrow={1}>
            <text ref={logsContentRef} selectable>
              {visibleLogs.length === 0 ? "(no logs)" : visibleLogs.map((line) => formatLogLine(line)).join("\n")}
            </text>
          </scrollbox>
        </box>
      </box>
    </box>
  );
};

export const IfowDevtoolsApp = TerminalDevtoolsApp;
