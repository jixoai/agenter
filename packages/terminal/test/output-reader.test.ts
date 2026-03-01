import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "bun:test";

import { readTerminalOutput, readTerminalOutputLines, streamTerminalOutput } from "../src/output-reader";

const writeLog = (outputDir: string, fileName: string, preFile: string | null, lines: string[], includeStatus = false): void => {
  const statusLine = includeStatus ? `\n  status: \"BUSY\"` : "";
  const content = [
    "<!--",
    "meta:",
    `  pre-file: ${JSON.stringify(preFile ?? "none")}`,
    `  viewport-base: 0${statusLine}`,
    "ati-source:",
    `  file: ${JSON.stringify(fileName)}`,
    `  pre-file: ${JSON.stringify(preFile ?? "none")}`,
    "  updated-at: \"2026-03-01T00:00:00.000Z\"",
    "-->",
    ...lines,
    "",
  ].join("\n");
  writeFileSync(join(outputDir, fileName), content, "utf8");
};

test("output reader follows pre-file chain and returns body lines in chronological order", () => {
  const root = mkdtempSync(join(tmpdir(), "ati-output-reader-"));
  const outputDir = join(root, "output");
  mkdirSync(outputDir, { recursive: true });

  writeLog(outputDir, "1~2.log.html", null, ["a1", "a2"]);
  writeLog(outputDir, "3~4.log.html", "1~2.log.html", ["b3", "b4"]);
  writeLog(outputDir, "latest.log.html", "3~4.log.html", ["c5", "c6"], true);

  const lines = readTerminalOutputLines({ outputDir, offset: 0, limit: -1 });
  expect(lines).toEqual(["a1", "a2", "b3", "b4", "c5", "c6"]);
});

test("output reader supports tail window by offset and limit", () => {
  const root = mkdtempSync(join(tmpdir(), "ati-output-window-"));
  const outputDir = join(root, "output");
  mkdirSync(outputDir, { recursive: true });

  writeLog(outputDir, "1~2.log.html", null, ["1", "2"]);
  writeLog(outputDir, "latest.log.html", "1~2.log.html", ["3", "4", "5", "6"], true);

  expect(readTerminalOutputLines({ outputDir, offset: 0, limit: 3 })).toEqual(["4", "5", "6"]);
  expect(readTerminalOutputLines({ outputDir, offset: 2, limit: 3 })).toEqual(["2", "3", "4"]);
  expect(readTerminalOutputLines({ outputDir, offset: 99, limit: -1 })).toEqual([]);
  expect(() => readTerminalOutputLines({ outputDir, offset: -1, limit: -1 })).toThrow();
  expect(() => readTerminalOutputLines({ outputDir, offset: 0, limit: -2 })).toThrow();
});

test("readTerminalOutput and streamTerminalOutput produce the same payload", async () => {
  const root = mkdtempSync(join(tmpdir(), "ati-output-stream-"));
  const outputDir = join(root, "output");
  mkdirSync(outputDir, { recursive: true });

  writeLog(outputDir, "latest.log.html", null, ["line-1", "line-2"], true);

  const content = await readTerminalOutput({ outputDir, offset: 0, limit: -1 });

  const chunks: string[] = [];
  const reader = streamTerminalOutput({ outputDir, offset: 0, limit: -1 }).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value ?? "");
  }

  expect(content).toBe("line-1\nline-2");
  expect(chunks.join("")).toBe(content);
});
