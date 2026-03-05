import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import type { ArgumentsCamelCase, Argv } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { AgenticTerminal } from "../agentic-terminal";
import type { TerminalColorMode, TerminalColorOption, TerminalGitLogMode, TerminalLogStyle } from "../types";
import { resolveOutputRoot } from "../workspace";
import { startAtiTui } from "./ati-tui";
import { normalizeAtiRunLayout } from "./normalize-command";
import {
  parseColorOption,
  parseGitLogOption,
  parseLogStyleOption,
  parseSizeOption,
  resolveColorOption,
  resolveSizeOption,
  resolveSizeWithFallback,
  type ResolvedSizeOption,
} from "./option-parser";

interface RunArgs {
  program: string;
  args: string[];
  outputDir?: string;
  size?: string;
  color?: string;
  logStyle?: string;
  keepStyle?: boolean;
  debugCursor?: boolean;
  gitLog?: string;
}

interface ResolvedRunArgs {
  program: string;
  args: string[];
  outputRoot: string;
  size: ResolvedSizeOption;
  requestedColor: TerminalColorOption;
  color: TerminalColorMode;
  logStyle: TerminalLogStyle;
  debugCursor: boolean;
  gitLog: TerminalGitLogMode;
}

interface CommandArgsShape {
  outputDir?: string;
  size?: string;
  color?: string;
  logStyle?: string;
  keepStyle?: boolean;
  debugCursor?: boolean;
  gitLog?: string;
  program: string;
  args?: string[];
}

const STARTUP_VIEWPORT_SETTLE_MS = 120;
const STARTUP_VIEWPORT_MAX_WAIT_MS = 1500;
const GIT_LOG_VALUE_TOKENS = new Set(["normal", "verbose", "off", "true", "false", "on", "yes", "no", "none"]);

const normalizeGitLogArgs = (argv: string[]): string[] => {
  const out: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--") {
      out.push(...argv.slice(index));
      break;
    }
    if (token === "--git-log") {
      const next = argv[index + 1];
      if (next && !next.startsWith("-") && GIT_LOG_VALUE_TOKENS.has(next.trim().toLowerCase())) {
        out.push(`--git-log=${next}`);
        index += 1;
      } else {
        out.push("--git-log=");
      }
      continue;
    }
    out.push(token);
  }
  return out;
};

const toStringArray = (input: unknown): string[] => {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((item) => String(item));
};

const extractRunArgs = (argv: ArgumentsCamelCase<CommandArgsShape>): string[] => {
  const fromPositional = toStringArray(argv.args);
  const fromUnderscore = toStringArray(argv._).slice(1);
  return [...fromPositional, ...fromUnderscore];
};

const resolveRunArgs = (input: RunArgs): ResolvedRunArgs => {
  const outputRoot = resolveOutputRoot(input.outputDir);
  const size = resolveSizeOption(parseSizeOption(input.size));
  const requestedColor = parseColorOption(input.color);
  const color = resolveColorOption(requestedColor);
  const logStyle = parseLogStyleOption(input.logStyle, input.keepStyle);
  const gitLog = parseGitLogOption(input.gitLog);
  return {
    program: input.program,
    args: input.args,
    outputRoot,
    size,
    requestedColor,
    color,
    logStyle,
    debugCursor: Boolean(input.debugCursor),
    gitLog,
  };
};

const printSessionMeta = (resolved: ResolvedRunArgs): string => {
  const requestedSize = resolved.size.requested.normalized;
  const effectiveSize = `${resolved.size.rows}:${resolved.size.cols}`;
  return `[ati-meta] size=${requestedSize} (effective ${effectiveSize}) color=${resolved.requestedColor} (effective ${resolved.color}) log-style=${resolved.logStyle} git-log=${resolved.gitLog} output-dir=${resolved.outputRoot}`;
};

const runTerminalSession = async (input: RunArgs): Promise<number> => {
  const resolved = resolveRunArgs(input);
  const useTui = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  let finalized = false;
  let sigintCount = 0;

  let resolveExit: (code: number) => void = () => undefined;
  const exitPromise = new Promise<number>((resolveCode) => {
    resolveExit = resolveCode;
  });

  let terminal: AgenticTerminal | null = null;
  let runResolved: ResolvedRunArgs | null = null;
  const pendingInputs: string[] = [];
  const pendingDebugLines: string[] = [];
  let debugLogPath: string | null = null;

  let tui: Awaited<ReturnType<typeof startAtiTui>> | null = null;
  let stopOutput: (() => void) | null = null;
  let stopExit: (() => void) | null = null;
  let stopRender: (() => void) | null = null;

  const writeDebugLine = (line: string): void => {
    if (debugLogPath) {
      appendFileSync(debugLogPath, `${line}\n`, "utf8");
      return;
    }
    pendingDebugLines.push(line);
  };
  const logDebug = (event: string, payload: Record<string, unknown> = {}): void => {
    writeDebugLine(
      JSON.stringify({
        ts: new Date().toISOString(),
        source: "ati-cli",
        event,
        ...payload,
      }),
    );
  };
  const bindDebugLog = (workspace: string): void => {
    const dir = join(workspace, "debug");
    mkdirSync(dir, { recursive: true });
    debugLogPath = join(dir, "ati-cli.ndjson");
    for (const line of pendingDebugLines.splice(0, pendingDebugLines.length)) {
      writeDebugLine(line);
    }
  };

  let pendingStartupViewport: { rows: number; cols: number } | null = null;
  let startupViewportResolved = false;
  let startupViewportTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveInitialViewport: ((value: { rows: number; cols: number }) => void) | null = null;
  const initialViewportPromise = new Promise<{ rows: number; cols: number }>((resolveViewport) => {
    resolveInitialViewport = resolveViewport;
  });
  const tryResolveStartupViewport = (): void => {
    if (startupViewportResolved || !pendingStartupViewport) {
      return;
    }
    startupViewportResolved = true;
    logDebug("startup.viewport.stabilized", pendingStartupViewport);
    resolveInitialViewport?.(pendingStartupViewport);
  };
  const scheduleStartupViewportResolve = (): void => {
    if (startupViewportTimer !== null) {
      clearTimeout(startupViewportTimer);
    }
    startupViewportTimer = setTimeout(() => {
      startupViewportTimer = null;
      tryResolveStartupViewport();
    }, STARTUP_VIEWPORT_SETTLE_MS);
  };
  const markInitialViewport = (cols: number, rows: number): void => {
    pendingStartupViewport = { cols, rows };
    logDebug("startup.viewport.event", { cols, rows });
    scheduleStartupViewportResolve();
  };

  let lastResizeSize = {
    rows: 0,
    cols: 0,
  };
  let pendingResize: { rows: number; cols: number } | null = null;

  const flushPendingResize = async (): Promise<void> => {
    if (finalized || pendingResize === null || !terminal || !runResolved) {
      return;
    }
    const next = pendingResize;
    pendingResize = null;

    if (next.rows === lastResizeSize.rows && next.cols === lastResizeSize.cols) {
      logDebug("resize.skip.same", { next, last: lastResizeSize });
      return;
    }

    logDebug("resize.apply", { next, last: lastResizeSize });
    lastResizeSize = next;
    await terminal.resize(next.cols, next.rows);
    logDebug("resize.applied", { next });
    tui?.updateMeta(
      `[ati-meta] size=${runResolved.size.requested.normalized} (effective ${next.rows}:${next.cols}) color=${runResolved.requestedColor} (effective ${runResolved.color}) log-style=${runResolved.logStyle} git-log=${runResolved.gitLog} output-dir=${runResolved.outputRoot}`,
    );
  };

  const requestResize = (cols: number, rows: number): void => {
    if (finalized) {
      return;
    }
    if (!runResolved || !terminal) {
      logDebug("resize.before-start", { cols, rows });
      markInitialViewport(cols, rows);
      return;
    }
    const next = resolveSizeWithFallback(runResolved.size.requested, { cols, rows });
    logDebug("resize.request", {
      rawViewport: { cols, rows },
      resolved: next,
      last: lastResizeSize,
    });
    if (next.rows === lastResizeSize.rows && next.cols === lastResizeSize.cols) {
      pendingResize = null;
      logDebug("resize.skip.same", { next, last: lastResizeSize });
      return;
    }
    pendingResize = { rows: next.rows, cols: next.cols };
    void flushPendingResize().catch((error) => {
      logDebug("resize.error", { message: error instanceof Error ? error.message : String(error) });
    });
  };

  const cleanup = (): void => {
    if (stopRender) {
      stopRender();
      stopRender = null;
    }
    if (stopExit) {
      stopExit();
      stopExit = null;
    }
    if (stopOutput) {
      stopOutput();
      stopOutput = null;
    }
    process.stdin.off("data", onStdinData);
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    if (startupViewportTimer !== null) {
      clearTimeout(startupViewportTimer);
      startupViewportTimer = null;
    }
    if (tui) {
      tui.destroy();
      tui = null;
    }
  };

  const finalize = async (code: number): Promise<void> => {
    if (finalized) {
      return;
    }
    finalized = true;
    logDebug("session.finalize", { code });
    cleanup();

    if (terminal) {
      try {
        await terminal.forceCommit();
      } catch {
        // ignore final commit errors during shutdown
      }
      try {
        await terminal.destroy(true);
      } catch {
        // ignore destroy errors during shutdown
      }
    }
    resolveExit(code);
  };

  const bindTerminalListeners = (): void => {
    if (!terminal) {
      return;
    }
    stopExit = terminal.onExit((code) => {
      void finalize(code ?? 0);
    });
    stopRender = terminal.onRender((render) => {
      if (!terminal) {
        return;
      }
      tui?.updateRender(render, terminal.getStatus());
    });
  };

  const onStdinData = (data: Buffer | string): void => {
    const chunk = typeof data === "string" ? data : data.toString("utf8");
    terminal?.writeRaw(chunk);
  };

  const onSigint = (): void => {
    if (finalized) {
      return;
    }
    sigintCount += 1;
    if (sigintCount === 1) {
      if (terminal) {
        terminal.writeRaw("\u0003");
      } else {
        pendingInputs.push("\u0003");
      }
      return;
    }
    void finalize(130);
  };

  const onSigterm = (): void => {
    void finalize(143);
  };

  try {
    logDebug("session.init", {
      useTui,
      requestedSize: resolved.size.requested.normalized,
      resolvedSize: `${resolved.size.rows}:${resolved.size.cols}`,
      requestedColor: resolved.requestedColor,
      resolvedColor: resolved.color,
      logStyle: resolved.logStyle,
      gitLog: resolved.gitLog,
      outputRoot: resolved.outputRoot,
      program: resolved.program,
      args: resolved.args,
    });
    if (useTui) {
      let metaLine = `[ati-meta] size=${resolved.size.requested.normalized} (pending box) color=${resolved.requestedColor} (effective ${resolved.color}) log-style=${resolved.logStyle} git-log=${resolved.gitLog} output-dir=${resolved.outputRoot}`;
      tui = await startAtiTui({
        metaLine,
        onInput: (data) => {
          if (terminal) {
            terminal.writeRaw(data);
          } else {
            pendingInputs.push(data);
          }
        },
        onQuit: () => {
          void finalize(0);
        },
        onResize: (cols, rows) => {
          if (!terminal) {
            markInitialViewport(cols, rows);
            return;
          }
          requestResize(cols, rows);
        },
      });

      const initialViewport = await Promise.race([
        initialViewportPromise,
        Bun.sleep(STARTUP_VIEWPORT_MAX_WAIT_MS).then(() => {
          throw new Error("Timed out waiting for startup viewport stabilization.");
        }),
      ]);
      if (!initialViewport) {
        throw new Error("Failed to resolve initial ATI-TUI viewport size.");
      }
      logDebug("startup.viewport.resolved", { initialViewport });
      const effectiveSize = resolveSizeWithFallback(resolved.size.requested, {
        rows: initialViewport.rows,
        cols: initialViewport.cols,
      });
      runResolved = {
        ...resolved,
        size: effectiveSize,
      };
      metaLine = printSessionMeta(runResolved);
      tui.updateMeta(metaLine);

      terminal = new AgenticTerminal(runResolved.program, runResolved.args, {
        outputRoot: runResolved.outputRoot,
        rows: runResolved.size.rows,
        cols: runResolved.size.cols,
        color: runResolved.color,
        logStyle: runResolved.logStyle,
        cwd: process.cwd(),
        debugCursor: runResolved.debugCursor,
        gitLog: runResolved.gitLog,
      });
      lastResizeSize = {
        rows: runResolved.size.rows,
        cols: runResolved.size.cols,
      };
      bindTerminalListeners();
      terminal.start();
      bindDebugLog(terminal.workspace);
      logDebug("workspace.ready", { workspace: terminal.workspace });
      logDebug("terminal.start", {
        mode: "tui",
        rows: runResolved.size.rows,
        cols: runResolved.size.cols,
      });
      tui.updateRender(terminal.getLatestRender(), terminal.getStatus());
      for (const pending of pendingInputs.splice(0, pendingInputs.length)) {
        terminal.writeRaw(pending);
      }
    } else {
      const effectiveSize = resolveSizeWithFallback(resolved.size.requested, {
        rows: resolved.size.rows,
        cols: resolved.size.cols,
      });
      runResolved = {
        ...resolved,
        size: effectiveSize,
      };
      const metaLine = printSessionMeta(runResolved);
      terminal = new AgenticTerminal(runResolved.program, runResolved.args, {
        outputRoot: runResolved.outputRoot,
        rows: runResolved.size.rows,
        cols: runResolved.size.cols,
        color: runResolved.color,
        logStyle: runResolved.logStyle,
        cwd: process.cwd(),
        debugCursor: runResolved.debugCursor,
        gitLog: runResolved.gitLog,
      });
      lastResizeSize = {
        rows: runResolved.size.rows,
        cols: runResolved.size.cols,
      };
      bindTerminalListeners();
      terminal.start();
      bindDebugLog(terminal.workspace);
      logDebug("workspace.ready", { workspace: terminal.workspace });
      logDebug("terminal.start", {
        mode: "stdio",
        rows: runResolved.size.rows,
        cols: runResolved.size.cols,
      });
      process.stdout.write(`${metaLine}\n`);
      stopOutput = terminal.onOutput((chunk) => {
        process.stdout.write(chunk);
      });
      process.stdin.on("data", onStdinData);
      process.stdin.resume();
    }
  } catch (error) {
    logDebug("session.error", { message: error instanceof Error ? error.message : String(error) });
    cleanup();
    throw error;
  }

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  const code = await exitPromise;
  process.stdin.off("data", onStdinData);
  return code;
};

export const runAtiCli = async (argvInput?: string[]): Promise<number> => {
  const args = normalizeGitLogArgs(normalizeAtiRunLayout(argvInput ?? hideBin(process.argv)));
  let exitCode = 0;

  await yargs(args)
    .scriptName("ati")
    .usage("ati [options] [command] [args]")
    .parserConfiguration({
      "unknown-options-as-args": true,
    })
    .option("output-dir", {
      alias: "o",
      type: "string",
      describe: "Output root directory for workspace logs",
    })
    .option("size", {
      type: "string",
      default: "auto:auto",
      describe: "PTY size as rows:cols (supports auto, like 10, :120, auto:auto)",
    })
    .option("color", {
      type: "string",
      default: "auto",
      describe: "Terminal color capability (auto|16|256|truecolor|none)",
    })
    .option("log-style", {
      type: "string",
      describe: "Log file style mode (rich|plain). rich keeps style tags; plain writes minimal html with <cursor/>.",
    })
    .option("keep-style", {
      type: "boolean",
      describe: "Alias for --log-style (true=rich, false=plain). Ignored when --log-style is provided.",
    })
    .option("debug-cursor", {
      type: "boolean",
      default: false,
      describe: "Write raw cursor diagnostics to output/cursor-debug.ndjson",
    })
    .option("git-log", {
      type: "string",
      describe: "Enable workspace git history logging (none|normal|verbose). Bare flag defaults to normal.",
    })
    .command(
      "run <program> [args..]",
      "Run target program through ATI terminal wrapper",
      (cmd: Argv) =>
        cmd
          .positional("program", { type: "string", demandOption: true })
          .positional("args", { type: "string", array: true }),
      async (argv: ArgumentsCamelCase<CommandArgsShape>) => {
        const program = String(argv.program);
        const argsList = extractRunArgs(argv);
        const outputDir = typeof argv.outputDir === "string" ? argv.outputDir : undefined;
        const size = typeof argv.size === "string" ? argv.size : undefined;
        const color = typeof argv.color === "string" ? argv.color : undefined;
        const logStyle = typeof argv.logStyle === "string" ? argv.logStyle : undefined;
        const keepStyle = typeof argv.keepStyle === "boolean" ? argv.keepStyle : undefined;
        const debugCursor = Boolean(argv.debugCursor);
        const gitLog = typeof argv.gitLog === "string" ? argv.gitLog : undefined;
        exitCode = await runTerminalSession({
          program,
          args: argsList,
          outputDir,
          size,
          color,
          logStyle,
          keepStyle,
          debugCursor,
          gitLog,
        });
      },
    )
    .demandCommand(1, "Missing command or target program.")
    .strictCommands()
    .help()
    .version()
    .fail((message: string | undefined, error: Error | undefined) => {
      if (error) {
        throw error;
      }
      throw new Error(message);
    })
    .parseAsync();

  return exitCode;
};
