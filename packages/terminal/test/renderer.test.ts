import { expect, test } from "bun:test";

import {
  compactRenderForPersistence,
  renderSemanticBuffer,
  renderStructuredBuffer,
  serializeRenderLinesForLog,
  stripHtmlTags,
} from "../src/renderer";
import type { RenderResult } from "../src/types";
import { XtermBridge } from "../src/xterm-bridge";

test("renderer maps strong semantic colors", async () => {
  const bridge = new XtermBridge(24, 6);
  await bridge.write("\u001b[31mERR\u001b[0m done\r\n");
  const rendered = renderSemanticBuffer(bridge);
  const hasRed = rendered.lines.some((line) => line.includes("<red>ERR</red>"));
  expect(hasRed).toBe(true);
  bridge.dispose();
});

test("structured renderer is the single source for style spans", async () => {
  const bridge = new XtermBridge(24, 6);
  await bridge.write("\u001b[31mERR\u001b[0m\r\n");
  const structured = renderStructuredBuffer(bridge);
  expect(structured.richLines.some((line) => line.spans.some((span) => span.text.includes("ERR")))).toBe(true);
  expect(structured.rows).toBe(6);
  expect(structured.cols).toBe(24);
  bridge.dispose();
});

test("renderer preserves inverse style for app-drawn focus", async () => {
  const bridge = new XtermBridge(40, 4);
  await bridge.write("> \u001b[7m \u001b[27mType\r\n");
  const rendered = renderSemanticBuffer(bridge);
  const spans = rendered.richLines[0]?.spans ?? [];
  expect(spans.some((span) => span.inverse === true)).toBe(true);
  bridge.dispose();
});

test("renderer keeps trailing inverse cursor cell", async () => {
  const bridge = new XtermBridge(40, 4);
  await bridge.write("input\u001b[7m \u001b[27m");
  const rendered = renderSemanticBuffer(bridge);
  const line = rendered.richLines.find((item) => item.spans.length > 0);
  expect(line?.spans.some((span) => span.inverse === true)).toBe(true);
  bridge.dispose();
});

test("persistence compaction trims trailing styled whitespace at final stage", async () => {
  const bridge = new XtermBridge(40, 4);
  await bridge.write("input\u001b[7m \u001b[27m");
  const rendered = renderSemanticBuffer(bridge);
  const compacted = compactRenderForPersistence(rendered);
  const before = rendered.richLines.find((item) => item.spans.length > 0);
  const after = compacted.richLines.find((item) => item.spans.length > 0);
  expect(before?.spans.some((span) => span.inverse === true)).toBe(true);
  expect(after?.spans.some((span) => span.inverse === true)).toBe(false);
  bridge.dispose();
});

test("renderer maps rgb colors to semantic tags", async () => {
  const bridge = new XtermBridge(24, 6);
  await bridge.write("\u001b[38;2;250;80;80mRGB\u001b[0m\r\n");
  const rendered = renderSemanticBuffer(bridge);
  const hasSemanticColor = rendered.lines.some(
    (line) => line.includes("<red>RGB</red>") || line.includes("<bright-red>RGB</bright-red>"),
  );
  expect(hasSemanticColor).toBe(true);
  bridge.dispose();
});

test("renderer injects cursor tag and keeps raw trailing spaces before compaction", async () => {
  const bridge = new XtermBridge(16, 4);
  await bridge.write("abc   ");
  const rendered = renderSemanticBuffer(bridge);
  const compacted = compactRenderForPersistence(rendered);
  const target = rendered.lines.find((line) => line.includes("abc"));
  expect(target).toContain("<cursor/>");
  expect(target?.includes("abc   ")).toBe(true);
  expect(compacted.plainLines.some((line) => line === "abc")).toBe(true);
  bridge.dispose();
});

test("renderer uses raw xterm cursor without placeholder-specific relocation", async () => {
  const bridge = new XtermBridge(80, 8);
  await bridge.write(">   Type your message or @path/to/file\r\n");
  await bridge.write("model: smart mode\r\n");
  await bridge.write("cwd: ~/workspace/project\r\n");
  await bridge.write("\r\n");
  const rendered = renderSemanticBuffer(bridge);
  const line = rendered.lines.find((it) => it.includes("Type your message"));
  expect(line?.includes("<cursor/>")).toBe(false);
  expect(rendered.cursorAbsRow).toBe(bridge.baseY + bridge.cursorY);
  expect(rendered.cursorCol).toBe(bridge.cursorX);
  expect(rendered.cursorVisible).toBe(true);
  bridge.dispose();
});

test("renderer does not inject cursor tag when xterm cursor is hidden", async () => {
  const bridge = new XtermBridge(60, 4);
  await bridge.write("\u001b[?25l> \u001b[7m \u001b[27mType your message\r\n");
  const rendered = renderSemanticBuffer(bridge);
  expect(rendered.cursorVisible).toBe(false);
  expect(rendered.lines.some((line) => line.includes("<cursor/>"))).toBe(false);
  bridge.dispose();
});

test("plain log serialization stays html but removes style wrappers", () => {
  const render: RenderResult = {
    lines: ["<red>&lt;x&gt;</red><cursor/>"],
    plainLines: ["<x>"],
    richLines: [
      {
        spans: [{ text: "<x>", fg: "#ff0000" }],
      },
    ],
    cursorAbsRow: 0,
    cursorCol: 1,
    cursorVisible: true,
  };
  const plain = serializeRenderLinesForLog(render, "plain");
  expect(plain[0]).toBe("&lt;<cursor/>x&gt;");
  expect(plain[0]).not.toContain("<red>");
});

test("rich log serialization keeps style wrappers and cursor", () => {
  const render: RenderResult = {
    lines: [],
    plainLines: [],
    richLines: [
      {
        spans: [{ text: "ERR", fg: "#f14c4c" }],
      },
    ],
    cursorAbsRow: 0,
    cursorCol: 2,
    cursorVisible: true,
  };
  const rich = serializeRenderLinesForLog(render, "rich");
  expect(rich[0].includes("<red>") || rich[0].includes("<bright-red>")).toBe(true);
  expect(rich[0]).toContain("<cursor/>");
});

test("stripHtmlTags keeps plain text", () => {
  expect(stripHtmlTags("<red>ERR</red> <cursor/>")).toBe("ERR ");
});
