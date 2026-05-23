import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { BoxRenderable, CliRenderEvents, createCliRenderer, type CliRenderer, type KeyEvent } from "@opentui/core";
import { assertTerminalBackendKind, type TerminalBackendKind } from "@agenter/termless-core";

import { TerminalControlPlane } from "../../terminal-system/src/index.ts";
import {
  BackendTerminalFrameRenderable,
  type BackendTerminalFrameState,
} from "../src/tui/backend-terminal-frame.ts";
import { createCliShellLiveTerminalMirror } from "../src/tui/live-terminal-mirror.ts";
import type { CliShellLiveTerminalMirror } from "../src/tui/live-terminal-mirror.ts";
import { readCliShellPasteText } from "../src/tui/paste-input.ts";
import { createCliShellPerfTracer } from "../src/tui/perf-trace.ts";
import { encodeCliShellTerminalKey } from "../src/tui/terminal-input.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const TRACE_PATH = join(
  REPO_ROOT,
  ".chat/rebuild-cli-shell-terminal-projection-law/terminal1-framebuffer-trace.ndjson",
);
const DISPOSE_TIMEOUT_MS = 500;

interface ExperimentOptions {
  debug: boolean;
  fps: number;
  backend: TerminalBackendKind;
  command: string[];
  cwd: string;
  exitAfterMs: number | null;
  printOptions: boolean;
}

const readFlagValue = (args: readonly string[], flag: string): string | null => {
  const prefix = `${flag}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = args.indexOf(flag);
  if (index >= 0) {
    const value = args[index + 1] ?? null;
    return value && !value.startsWith("--") ? value : null;
  }
  return null;
};

const parseOptions = (args: readonly string[]): ExperimentOptions => {
  const fpsValue = Number.parseInt(readFlagValue(args, "--fps") ?? "30", 10);
  const backendValue = readFlagValue(args, "--backend") ?? "xterm";
  const shellValue = readFlagValue(args, "--shell");
  const cwdValue = readFlagValue(args, "--cwd");
  const exitAfterMsValue = Number.parseInt(readFlagValue(args, "--exit-after-ms") ?? "", 10);
  return {
    debug: args.includes("--debug"),
    fps: Number.isFinite(fpsValue) && fpsValue > 0 ? fpsValue : 30,
    backend: assertTerminalBackendKind(backendValue),
    command: shellValue ? ["sh", "-lc", shellValue] : ["sh", "-lc", "exec ${SHELL:-/bin/zsh} -l"],
    cwd: cwdValue && cwdValue.length > 0 ? cwdValue : process.cwd(),
    exitAfterMs: Number.isFinite(exitAfterMsValue) && exitAfterMsValue > 0 ? exitAfterMsValue : null,
    printOptions: args.includes("--print-options"),
  };
};

const resolveShellRows = (renderer: CliRenderer): number => Math.max(1, renderer.height);

const resolveShellCols = (renderer: CliRenderer): number => Math.max(1, renderer.width);

const resolveTracePath = (): string => {
  const existing = process.env.AGENTER_CLI_SHELL_TRACE?.trim();
  const resolved =
    existing && existing !== "1" && existing.toLowerCase() !== "true"
      ? isAbsolute(existing)
        ? existing
        : resolve(existing)
      : TRACE_PATH;
  mkdirSync(dirname(resolved), { recursive: true });
  return resolved;
};

const frameStateFromText = (text: string, cols: number, rows: number): BackendTerminalFrameState => ({
  lines: Array.from({ length: rows }, (_, row) => ({
    spans: row === 0 ? [{ text }] : [],
  })),
  cursorCol: 0,
  cursorAbsRow: 0,
  cursorVisible: false,
  viewportStart: 0,
  scrollbackRows: rows,
});

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> =>
  await Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);

const isCopyShortcut = (key: KeyEvent): boolean =>
  ((key.meta || key.super) && key.name === "c") || (key.ctrl && key.shift && key.name === "c");

const main = async (): Promise<void> => {
  const options = parseOptions(Bun.argv.slice(2));
  if (options.printOptions) {
    console.log(JSON.stringify(options));
    return;
  }
  if (options.debug) {
    process.env.AGENTER_CLI_SHELL_TRACE = resolveTracePath();
  }

  const outputRoot = mkdtempSync(join(tmpdir(), "agenter-terminal1-framebuffer-"));
  const plane = new TerminalControlPlane({
    dbPath: join(outputRoot, "terminal.db"),
    outputRoot,
    defaultShellCommand: options.command,
    initialConfig: {
      defaults: {
        cols: 120,
        rows: 30,
        cwd: options.cwd,
        gitLog: false,
        logStyle: "rich",
      },
      transport: {
        port: null,
        framePatchMode: "rowCache",
      },
    },
  });

  const created = await plane.create({
    terminalId: "terminal-1",
    backend: options.backend,
    profile: {
      title: "Terminal-1 FrameBuffer Experiment",
    },
  });
  let requestFinish: (() => void) | null = null;
  let terminalExitObserved = false;
  let releaseTerminalStatus = plane.onStatus((payload) => {
    if (payload.terminalId !== created.terminalId || payload.running || terminalExitObserved) {
      return;
    }
    terminalExitObserved = true;
    requestFinish?.();
  });
  if (!plane.isRunning(created.terminalId)) {
    terminalExitObserved = true;
  }
  await plane.startTransport({ port: 0 });
  const endpoint = plane.getTransportEndpoint(created.terminalId);
  if (!endpoint) {
    throw new Error("terminal transport endpoint was not created");
  }

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
    targetFps: options.fps,
    maxFps: options.fps,
    gatherStats: options.debug,
  });
  const tracer = createCliShellPerfTracer({ enabled: options.debug });
  let disposed = false;
  let resolveFinished = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  const root = new BoxRenderable(renderer, {
    id: "terminal1-framebuffer-root",
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  });

  let mirror: CliShellLiveTerminalMirror;
  const terminalFrame = new BackendTerminalFrameRenderable(renderer, {
    id: "terminal1-framebuffer",
    position: "absolute",
    top: 0,
    left: 0,
    width: resolveShellCols(renderer),
    height: resolveShellRows(renderer),
    state: frameStateFromText(
      "terminal-1 experiment: waiting for shell frame...",
      resolveShellCols(renderer),
      resolveShellRows(renderer),
    ),
    bridge: {
      sendInputText: (text) => mirror.sendInputBytes(new TextEncoder().encode(text)),
      handleUnsupportedMediaPaste: () => false,
      scrollViewport: (deltaRows) => mirror.scrollViewport(deltaRows),
      setViewportStart: (viewportStart) => mirror.setViewportStart(viewportStart),
      followCursor: () => mirror.followCursor(),
    },
  });
  root.add(terminalFrame);
  renderer.root.add(root);
  terminalFrame.focusTerminal();
  renderer.setCursorPosition(1, 1, false);
  renderer.requestRender();
  tracer.record({
    kind: "experiment-status-painted",
    detail: {
      phase: "waiting",
      rows: resolveShellRows(renderer),
      cols: resolveShellCols(renderer),
    },
  });

  const paintStatus = (text: string): void => {
    terminalFrame.updateBackendState(frameStateFromText(text, resolveShellCols(renderer), resolveShellRows(renderer)));
    renderer.setCursorPosition(1, 1, false);
    renderer.requestRender();
    tracer.record({
      kind: "experiment-status-painted",
      detail: {
        phase: text,
        rows: resolveShellRows(renderer),
        cols: resolveShellCols(renderer),
      },
    });
  };

  mirror = createCliShellLiveTerminalMirror({
    terminalId: created.terminalId,
    transportUrl: endpoint.url,
    geometryRole: "authority",
    debugTrace: options.debug,
    pacing: {
      mode: "fixed",
      fixedFps: options.fps,
    },
    trace: {
      enabled: options.debug,
      record: (event) => tracer.record(event),
    },
    requestPaint: () => {
      if (disposed) {
        return;
      }
      const view = mirror.getView();
      const paintStartedAt = performance.now();
      const paintStats = terminalFrame.updateBackendState({
        lines: view.richLines,
        cursorCol: view.cursorCol,
        cursorAbsRow: view.cursorAbsRow,
        cursorVisible: view.cursorVisible,
        viewportStart: view.viewportStart,
        scrollbackRows: view.scrollbackRows,
      });
      const terminalPaintMs = Number((performance.now() - paintStartedAt).toFixed(2));
      const cursor = terminalFrame.resolveCursorPosition();
      renderer.setCursorPosition(cursor.x, cursor.y, cursor.visible);
      tracer.record({
        kind: "render-applied",
        detail: {
          frameSource: "terminal1-framebuffer-experiment",
          elapsedMs: terminalPaintMs,
          terminalPaintMs: paintStats.terminalPaintMs,
          terminalPaintRows: paintStats.terminalPaintRows,
          terminalPaintSpans: paintStats.terminalPaintSpans,
          terminalPaintGlyphs: paintStats.terminalPaintGlyphs,
          viewportStart: view.viewportStart,
          scrollbackRows: view.scrollbackRows,
          visibleLineCount: view.richLines.length,
          estimatedFps: null,
        },
      });
      renderer.requestRender();
      mirror.notifyPaintCommitted();
    },
  });

  const resizeBackend = (): void => {
    const cols = resolveShellCols(renderer);
    const rows = resolveShellRows(renderer);
    root.width = cols;
    root.height = rows;
    terminalFrame.syncSize(cols, rows);
    mirror.setPullGeometry(cols, rows);
    mirror.resize(cols, rows);
    renderer.requestRender();
  };

  const destroy = async (): Promise<void> => {
    if (disposed) {
      return;
    }
    disposed = true;
    releaseTerminalStatus();
    releaseTerminalStatus = () => {};
    renderer.keyInput.off("keypress", handleKeypress);
    renderer.keyInput.off("paste", handlePaste);
    renderer.off(CliRenderEvents.RESIZE, handleResize);
    mirror.disconnect();
    tracer.dispose();
    renderer.destroy();
    await withTimeout(plane.dispose(), DISPOSE_TIMEOUT_MS);
  };

  const finish = async (): Promise<void> => {
    await destroy();
    resolveFinished();
  };
  requestFinish = () => {
    void finish();
  };

  const handleKeypress = (key: KeyEvent): void => {
    if (key.ctrl && key.name === "q") {
      key.preventDefault();
      void finish();
      return;
    }
    if (isCopyShortcut(key) && terminalFrame.copySelectionViaOsc52()) {
      key.preventDefault();
      return;
    }
    const encoded = encodeCliShellTerminalKey(key);
    if (!encoded) {
      return;
    }
    mirror.sendInputBytes(new TextEncoder().encode(encoded));
    mirror.followCursor();
    key.preventDefault();
  };

  const handlePaste = (value: unknown): void => {
    const text = readCliShellPasteText(value);
    if (text !== null && terminalFrame.pasteText(text)) {
      const event = value as { preventDefault?: unknown };
      if (typeof event.preventDefault === "function") {
        event.preventDefault();
      }
    }
  };

  const handleResize = (): void => {
    resizeBackend();
  };

  renderer.keyInput.on("keypress", handleKeypress);
  renderer.keyInput.on("paste", handlePaste);
  renderer.on(CliRenderEvents.RESIZE, handleResize);
  process.once("SIGINT", () => {
    void finish();
  });
  process.once("SIGTERM", () => {
    void finish();
  });
  if (options.exitAfterMs !== null) {
    setTimeout(() => {
      void finish();
    }, options.exitAfterMs);
  }
  if (terminalExitObserved) {
    await finish();
    return;
  }

  try {
    paintStatus("terminal-1 experiment: connecting shell backend...");
    await mirror.connect();
    resizeBackend();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    paintStatus(`terminal-1 experiment: backend connect failed: ${message}`);
    throw error;
  }

  await finished;
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
