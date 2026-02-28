#!/usr/bin/env bun

type Mode = "idle" | "select" | "spinner" | "progress" | "redraw";

const ESC = "\u001b";
const CLEAR_SCREEN = `${ESC}[2J${ESC}[H`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

const SELECT_OPTIONS = [
  "Snake",
  "Breakout",
  "Memory Match",
  "Typing Racer",
  "Tower Defense Lite",
];

let mode: Mode = "idle";
let selectIndex = 0;
let spinnerTick = 0;
let progress = 0;
let redrawTick = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const logs: string[] = [];

const now = (): string => new Date().toISOString().slice(11, 19);

const pushLog = (message: string): void => {
  logs.push(`[${now()}] ${message}`);
  if (logs.length > 200) {
    logs.splice(0, logs.length - 200);
  }
};

const stopTimer = (): void => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
};

const setMode = (next: Mode): void => {
  stopTimer();
  mode = next;
  if (next === "spinner") {
    spinnerTick = 0;
    timer = setInterval(() => {
      spinnerTick += 1;
      render();
    }, 90);
  } else if (next === "progress") {
    progress = 0;
    timer = setInterval(() => {
      progress = Math.min(100, progress + 2);
      if (progress >= 100) {
        pushLog("progress completed");
        setMode("idle");
        return;
      }
      render();
    }, 90);
  } else if (next === "redraw") {
    redrawTick = 0;
    timer = setInterval(() => {
      redrawTick += 1;
      render();
    }, 60);
  }
  pushLog(`mode -> ${next}`);
  render();
};

const spinnerFrame = (): string => {
  const frames = ["-", "\\", "|", "/"];
  return frames[spinnerTick % frames.length] ?? "-";
};

const buildBar = (value: number, width: number): string => {
  const safeWidth = Math.max(10, width);
  const filled = Math.round((value / 100) * safeWidth);
  return `[${"#".repeat(filled)}${"-".repeat(Math.max(0, safeWidth - filled))}] ${value}%`;
};

const render = (): void => {
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const lines: string[] = [];

  lines.push("Demo CLI (for ATI resize experiments)");
  lines.push(`size=${cols}x${rows} mode=${mode}`);
  lines.push("keys: 1=select 2=spinner 3=progress 4=redraw c=clear h=help q=quit");
  lines.push("select mode: up/down or j/k + enter, esc to cancel");
  lines.push("-".repeat(Math.max(16, Math.min(cols, 80))));

  if (mode === "select") {
    lines.push("TUI Select:");
    for (let index = 0; index < SELECT_OPTIONS.length; index += 1) {
      const prefix = index === selectIndex ? " > " : "   ";
      lines.push(`${prefix}${SELECT_OPTIONS[index]}`);
    }
  } else if (mode === "spinner") {
    lines.push(`Loading ${spinnerFrame()} Press 'q' to quit or 'h' for help.`);
  } else if (mode === "progress") {
    const barWidth = Math.min(40, Math.max(10, cols - 20));
    lines.push(`Progress ${buildBar(progress, barWidth)}`);
  } else if (mode === "redraw") {
    const width = Math.max(8, Math.min(cols - 4, 42));
    const border = `+${"-".repeat(width)}+`;
    const body = ".".repeat(Math.max(0, redrawTick % width));
    lines.push("Redraw storm:");
    lines.push(border);
    lines.push(`|${body.padEnd(width, " ")}|`);
    lines.push(border);
  } else {
    lines.push("Idle. Press 1/2/3/4 to start a demo.");
  }

  lines.push("-".repeat(Math.max(16, Math.min(cols, 80))));
  lines.push("Logs:");

  const fixedCount = lines.length;
  const logCapacity = Math.max(1, rows - fixedCount - 1);
  const visibleLogs = logs.slice(-logCapacity);
  lines.push(...visibleLogs);

  process.stdout.write(`${CLEAR_SCREEN}${lines.join("\n")}`);
};

const shutdown = (code: number): void => {
  stopTimer();
  process.stdout.write(`${SHOW_CURSOR}${ESC}[0m\n`);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode?.(false);
  }
  process.stdin.pause();
  process.exit(code);
};

const handleSelectInput = (input: string): boolean => {
  if (input === `${ESC}[A` || input === "k") {
    selectIndex = (selectIndex - 1 + SELECT_OPTIONS.length) % SELECT_OPTIONS.length;
    render();
    return true;
  }
  if (input === `${ESC}[B` || input === "j") {
    selectIndex = (selectIndex + 1) % SELECT_OPTIONS.length;
    render();
    return true;
  }
  if (input === "\r") {
    pushLog(`selected: ${SELECT_OPTIONS[selectIndex]}`);
    setMode("idle");
    return true;
  }
  if (input === ESC) {
    pushLog("select canceled");
    setMode("idle");
    return true;
  }
  return false;
};

const handleInput = (input: string): void => {
  if (input === "\u0003") {
    shutdown(130);
    return;
  }

  if (mode === "select" && handleSelectInput(input)) {
    return;
  }

  switch (input) {
    case "1":
      setMode("select");
      return;
    case "2":
      setMode("spinner");
      return;
    case "3":
      setMode("progress");
      return;
    case "4":
      setMode("redraw");
      return;
    case "c":
      logs.length = 0;
      pushLog("logs cleared");
      render();
      return;
    case "h":
    case "?":
      pushLog("help: 1 select, 2 spinner, 3 progress, 4 redraw, q quit");
      render();
      return;
    case "q":
    case "Q":
      shutdown(0);
      return;
    case ESC:
      setMode("idle");
      return;
    default:
      break;
  }
};

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stderr.write("demo-cli requires a TTY.\n");
  process.exit(1);
}

process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdout.write(HIDE_CURSOR);
pushLog("demo-cli started");
pushLog("resize terminal or press 1/2/3/4 to generate TUI patterns");
render();

process.stdin.on("data", (chunk: Buffer | string) => {
  const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  handleInput(text);
});

process.stdout.on("resize", () => {
  const cols = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;
  pushLog(`stdout resize event -> ${cols}x${rows}`);
  render();
});

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
