import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const COLS = 120;
const ROWS = 40;
const CELL_W = 16;
const CELL_H = 32;
const WIDTH = COLS * CELL_W;
const HEIGHT = ROWS * CELL_H;

const colors = {
  terminal: "#050a10",
  terminalMuted: "#7f8b99",
  fg: "#d8e1ed",
  muted: "#8998a8",
  panel: "#0a1219",
  panelSoft: "#0f1922",
  panelStrong: "#17212b",
  userBubble: "#202a34",
  input: "#1f2832",
  toolbar: "#151f28",
  button: "#26313d",
  buttonOn: "#294238",
  accent: "#8fb7ff",
  success: "#97d39d",
  warning: "#e9c46a",
  scrollbarTrack: "#16202a",
  scrollbarThumb: "#718091",
};

type FontWeight = "400" | "500" | "600";

interface TextRun {
  row: number;
  col: number;
  text: string;
  fill?: string;
  weight?: FontWeight;
  size?: number;
}

interface RectRun {
  row: number;
  col: number;
  rows: number;
  cols: number;
  fill: string;
  rx?: number;
  opacity?: number;
}

interface ReferenceScene {
  name: string;
  title: string;
  note: string;
  rects: RectRun[];
  text: TextRun[];
  grid: string[];
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function blankGrid() {
  return Array.from({ length: ROWS }, () => "");
}

function put(grid: string[], row: number, col: number, text: string) {
  const line = grid[row] ?? "";
  const prefix = line.padEnd(col, " ").slice(0, col);
  grid[row] = `${prefix}${text}`;
}

function text(row: number, col: number, value: string, fill = colors.fg, weight: FontWeight = "400"): TextRun {
  return { row, col, text: value, fill, weight };
}

function rect(row: number, col: number, rows: number, cols: number, fill: string, rx = 0, opacity = 1): RectRun {
  return { row, col, rows, cols, fill, rx, opacity };
}

function shellContent(grid: string[], runs: TextRun[], maxCol = COLS) {
  const lines: Array<[number, string, string?]> = [
    [0, "$ agenter shell"],
    [1, "shell-1:~/project $ pnpm test --filter agenter-app-shell"],
    [2, "packages/cli-shell test: Feature: ChatTUI terminal projection"],
    [3, "packages/cli-shell test: Scenario: Given terminal-2 When chat opens Then one app surface is shared"],
    [4, "packages/terminal-system test: Feature: backend-owned viewport"],
    [6, "PASS packages/cli-shell/test/cli-shell-tui.test.ts"],
    [7, "PASS packages/terminal-system/test/control-plane.test.ts"],
    [9, "shell-1:~/project $ git status --short"],
    [10, " M openspec/changes/separate-cli-shell-app-from-terminal-view-components/design.md"],
    [11, "?? openspec/changes/separate-cli-shell-app-from-terminal-view-components/assets/"],
    [13, "shell-1:~/project $ _"],
  ];

  for (const [row, value, fill] of lines) {
    const clipped = value.length > maxCol ? value.slice(0, maxCol - 1) : value;
    put(grid, row, 0, clipped);
    runs.push(text(row, 0, clipped, fill ?? colors.fg));
  }
}

function bottomToolbar(grid: string[], rects: RectRun[], runs: TextRun[], active = false) {
  rects.push(rect(39, 0, 1, COLS, colors.toolbar));
  rects.push(rect(39, 100, 1, 9, active ? colors.buttonOn : colors.button, 4));
  rects.push(rect(39, 111, 1, 5, active ? "#31445a" : colors.button, 4));

  put(grid, 39, 0, "🛠");
  put(grid, 39, 3, "运行 cli-shell TUI 回归：已更新 Chat 面板滚动契约，等待人工效果确认…");
  put(grid, 39, 101, "托管 on");
  put(grid, 39, 112, "✉ 3");

  runs.push(text(39, 0, "🛠", colors.warning, "600"));
  runs.push(text(39, 3, "运行 cli-shell TUI 回归：已更新 Chat 面板滚动契约，等待人工效果确认…", colors.fg));
  runs.push(text(39, 101, "托管 on", colors.success, "500"));
  runs.push(text(39, 112, "✉ 3", colors.accent, "600"));
}

function chatPanelBase(grid: string[], rects: RectRun[], runs: TextRun[]) {
  rects.push(rect(0, 75, 39, 45, colors.panel));
  rects.push(rect(0, 75, 39, 1, "#16222c"));
  rects.push(rect(0, 76, 1, 43, colors.panelStrong));
  rects.push(rect(1, 76, 34, 43, colors.panelSoft));
  rects.push(rect(35, 76, 1, 43, "#26313b"));
  rects.push(rect(36, 76, 3, 43, colors.input));

  put(grid, 0, 76, "←  →  ◇  ▾");
  put(grid, 0, 94, "Chat");
  put(grid, 0, 118, "×");
  put(grid, 35, 76, "───────────────────────────────────────────");
  put(grid, 37, 78, "> ");

  runs.push(text(0, 76, "←  →  ◇  ▾", colors.muted, "600"));
  runs.push(text(0, 94, "Chat", colors.fg, "600"));
  runs.push(text(0, 118, "×", colors.fg, "600"));
  runs.push(text(35, 76, "───────────────────────────────────────────", colors.muted));
  runs.push(text(37, 78, "> ", colors.fg, "600"));
}

function chatMessages(grid: string[], rects: RectRun[], runs: TextRun[], pinned: boolean) {
  put(grid, 2, 86, "──────── 2026-05-17 ────────");
  runs.push(text(2, 86, "──────── 2026-05-17 ────────", colors.muted));

  rects.push(rect(4, 77, 3, 40, colors.userBubble, 4));
  put(grid, 4, 78, ">");
  put(grid, 4, 81, "底部状态栏按最初设计改：");
  put(grid, 5, 81, "只要状态、当前片段、托管和 Chat。");
  runs.push(text(4, 78, ">", colors.fg, "600"));
  runs.push(text(4, 81, "底部状态栏按最初设计改：", colors.fg));
  runs.push(text(5, 81, "只要状态、当前片段、托管和 Chat。", colors.fg));

  put(grid, 8, 79, "@shell-assistant");
  put(grid, 9, 79, "已收敛到一行状态栏：");
  put(grid, 10, 79, "- 状态 emoji 放最左侧");
  put(grid, 11, 79, "- 当前流式片段居中延展");
  put(grid, 12, 79, "- 右侧只保留托管与 Chat 入口");
  runs.push(text(8, 79, "@shell-assistant", colors.accent, "500"));
  runs.push(text(9, 79, "已收敛到一行状态栏：", colors.fg));
  runs.push(text(10, 79, "- 状态 emoji 放最左侧", colors.fg));
  runs.push(text(11, 79, "- 当前流式片段居中延展", colors.fg));
  runs.push(text(12, 79, "- 右侧只保留托管与 Chat 入口", colors.fg));

  rects.push(rect(16, 77, 3, 40, colors.userBubble, 4));
  put(grid, 16, 78, ">");
  put(grid, 16, 81, "Chat 要像传统聊天室一样贴底。");
  put(grid, 17, 81, "用户上滚时不要抢回底部。");
  runs.push(text(16, 78, ">", colors.fg, "600"));
  runs.push(text(16, 81, "Chat 要像传统聊天室一样贴底。", colors.fg));
  runs.push(text(17, 81, "用户上滚时不要抢回底部。", colors.fg));

  put(grid, 21, 79, "@shell-assistant");
  put(grid, 22, 79, "贴底规则会这样落：");
  put(grid, 23, 79, "1. 已在底部：新消息和流式输出自动跟随");
  put(grid, 24, 79, "2. 用户上滚：锁定当前锚点并显示 ↓ 按钮");
  put(grid, 25, 79, "3. 发送自己的消息：回到底部继续跟随");
  runs.push(text(21, 79, "@shell-assistant", colors.accent, "500"));
  runs.push(text(22, 79, "贴底规则会这样落：", colors.fg));
  runs.push(text(23, 79, "1. 已在底部：新消息和流式输出自动跟随", colors.fg));
  runs.push(text(24, 79, "2. 用户上滚：锁定当前锚点并显示 ↓ 按钮", colors.fg));
  runs.push(text(25, 79, "3. 发送自己的消息：回到底部继续跟随", colors.fg));

  if (pinned) {
    put(grid, 31, 79, "当前在底部，继续接收流式输出…");
    put(grid, 37, 81, "继续写 Chat 面板验收项_");
    runs.push(text(31, 79, "当前在底部，继续接收流式输出…", colors.muted));
    runs.push(text(37, 81, "继续写 Chat 面板验收项_"));
  } else {
    rects.push(rect(31, 108, 1, 6, colors.button, 4));
    put(grid, 31, 109, "↓ 3");
    put(grid, 32, 79, "用户正在看历史，新消息不强制滚动。");
    put(grid, 37, 81, "补充贴底按钮验收_");
    runs.push(text(31, 109, "↓ 3", colors.accent, "600"));
    runs.push(text(32, 79, "用户正在看历史，新消息不强制滚动。", colors.muted));
    runs.push(text(37, 81, "补充贴底按钮验收_"));
  }
}

function scrollbar(rects: RectRun[], pinned: boolean) {
  rects.push(rect(2, 119, 32, 1, colors.scrollbarTrack));
  if (pinned) {
    rects.push(rect(23, 119, 10, 1, colors.scrollbarThumb));
  } else {
    rects.push(rect(8, 119, 10, 1, colors.scrollbarThumb));
  }
}

function collapsedScene(): ReferenceScene {
  const grid = blankGrid();
  const rects: RectRun[] = [];
  const runs: TextRun[] = [];
  shellContent(grid, runs);
  bottomToolbar(grid, rects, runs);
  return {
    name: "cli-shell-chat-tui-reference-v9-toolbar-grid",
    title: "Agenter cli-shell v9 one-line status toolbar",
    note: "Collapsed shell-first state. Bottom row is status icon, current streaming part, managed toggle, and Chat entry only.",
    rects,
    text: runs,
    grid,
  };
}

function chatScene(pinned: boolean): ReferenceScene {
  const grid = blankGrid();
  const rects: RectRun[] = [];
  const runs: TextRun[] = [];
  shellContent(grid, runs, 73);
  chatPanelBase(grid, rects, runs);
  chatMessages(grid, rects, runs, pinned);
  scrollbar(rects, pinned);
  bottomToolbar(grid, rects, runs, true);
  return {
    name: pinned
      ? "cli-shell-chat-tui-reference-v9-chat-right-pinned-grid"
      : "cli-shell-chat-tui-reference-v9-chat-right-scrolled-grid",
    title: pinned ? "Agenter cli-shell v9 Chat panel pinned" : "Agenter cli-shell v9 Chat panel scrolled up",
    note: pinned
      ? "Chat panel is at bottom. New message-parts continue to follow the latest row."
      : "Chat panel is scrolled up. Scrollbar thumb leaves the bottom and a compact stick-to-bottom button appears.",
    rects,
    text: runs,
    grid,
  };
}

function renderSvg(scene: ReferenceScene) {
  const rectSvg = [
    `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${colors.terminal}"/>`,
    ...scene.rects.map((item) => {
      const attrs = [
        `x="${item.col * CELL_W}"`,
        `y="${item.row * CELL_H}"`,
        `width="${item.cols * CELL_W}"`,
        `height="${item.rows * CELL_H}"`,
        `fill="${item.fill}"`,
      ];
      if (item.rx) attrs.push(`rx="${item.rx}"`);
      if (item.opacity !== undefined && item.opacity < 1) attrs.push(`opacity="${item.opacity}"`);
      return `<rect ${attrs.join(" ")}/>`;
    }),
  ].join("\n");

  const textSvg = scene.text
    .map((item) => {
      const size = item.size ?? 23;
      return `<text x="${item.col * CELL_W}" y="${item.row * CELL_H + 24}" font-family="Menlo, Monaco, 'Apple Color Emoji', 'Noto Color Emoji', monospace" font-size="${size}" font-weight="${item.weight ?? "400"}" fill="${item.fill ?? colors.fg}">${escapeXml(item.text)}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<title>${escapeXml(scene.title)}</title>
<desc>${escapeXml(scene.note)} Generated from paired TXT grid; terminal cells are ${COLS} columns by ${ROWS} rows.</desc>
${rectSvg}
${textSvg}
</svg>
`;
}

function renderTxt(scene: ReferenceScene) {
  const header = [`${COLS} cols x ${ROWS} rows terminal-grid reference.`, scene.note, ""];
  const rows = scene.grid.map((line, index) => `${String(index).padStart(2, "0")}  ${line}`.trimEnd());
  return `${[...header, ...rows].join("\n")}\n`;
}

async function writeScene(outDir: string, scene: ReferenceScene) {
  const svg = renderSvg(scene);
  await writeFile(path.join(outDir, `${scene.name}.svg`), svg, "utf8");
  await writeFile(path.join(outDir, `${scene.name}.txt`), renderTxt(scene), "utf8");
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(outDir, `${scene.name}.png`));
}

async function main() {
  const outDir = path.resolve(import.meta.dir);
  await mkdir(outDir, { recursive: true });
  const scenes = [collapsedScene(), chatScene(true), chatScene(false)];
  for (const scene of scenes) {
    await writeScene(outDir, scene);
  }
  await writeFile(
    path.join(outDir, "README.md"),
    `# Cli-shell ChatTUI v9 References

This directory contains deterministic terminal-grid references for the revised ChatTUI direction in \`separate-cli-shell-app-from-terminal-view-components\`.

## Final v9 design references

- \`cli-shell-chat-tui-reference-v9-toolbar-grid.png\`
- \`cli-shell-chat-tui-reference-v9-chat-right-pinned-grid.png\`
- \`cli-shell-chat-tui-reference-v9-chat-right-scrolled-grid.png\`

The paired \`.svg\` files are deterministic vector companions. The paired \`.txt\` files are terminal-cell contracts for row/column review.

## What changed from archived v8

- The bottom row no longer prints labels such as "Heartbeat" or visible shortcut help.
- The bottom row is exactly: status icon, current streaming part, managed toggle, Chat entry with unread count.
- The user-visible panel is named Chat, stays frameless, and separates regions with background, color, whitespace, one input divider, and a scrollbar column.
- Chat scrolling follows traditional chat-room behavior: pinned-at-bottom follows new streaming output; user scroll-up freezes position and shows a compact stick-to-bottom button.
`,
    "utf8",
  );
}

await main();
