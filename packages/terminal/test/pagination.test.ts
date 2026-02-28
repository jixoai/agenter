import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "bun:test";

import { HtmlPaginationStore } from "../src/pagination";
import type { RenderResult } from "../src/types";

const makeRender = (count: number): RenderResult => {
  const lines = Array.from({ length: count }, (_, index) => `line-${index + 1}`);
  return {
    lines,
    plainLines: [...lines],
    richLines: lines.map((line) => ({
      spans: [{ text: line }],
    })),
    cursorAbsRow: Math.max(0, count - 1),
    cursorCol: 2,
    cursorVisible: true,
  };
};

test("pagination archives old lines and updates latest metadata", () => {
  const workspace = mkdtempSync(join(tmpdir(), "ati-pagination-"));
  const store = new HtmlPaginationStore(workspace, 3);
  store.write(makeRender(8), "BUSY", 5, 24, 80, "rich");

  const latest = readFileSync(join(workspace, "output", "latest.log.html"), "utf8");
  const archivedA = readFileSync(join(workspace, "output", "1~3.log.html"), "utf8");
  const archivedB = readFileSync(join(workspace, "output", "4~6.log.html"), "utf8");

  expect(archivedA).toContain("line-1");
  expect(archivedB).toContain("line-6");
  expect(archivedA).toContain("meta:");
  expect(archivedA).toContain('log-style: "rich"');
  expect(archivedA).toContain("size: \"24x80\"");
  expect(archivedA).not.toContain("\n  status:");
  expect(archivedA).toContain("ati-source:");
  expect(archivedA).toContain("file: \"1~3.log.html\"");
  expect(archivedA).toContain("next-file: \"4~6.log.html\"");
  expect(archivedB).toContain("next-file: \"latest.log.html\"");
  expect(archivedB).toContain("updated-at:");
  expect(latest).toContain("pre-file: \"4~6.log.html\"");
  expect(latest).toContain('log-style: "rich"');
  expect(latest).toContain("size: \"24x80\"");
  expect(latest).toContain("status: \"BUSY\"");
  expect(latest).toContain("file: \"latest.log.html\"");
  expect(latest).toContain("updated-at:");
  expect(latest).not.toContain("next-file:");
  expect(latest).toContain("line-7");
  expect(latest).toContain("line-8");
});

test("pagination resumes by archiving previous latest first", () => {
  const workspace = mkdtempSync(join(tmpdir(), "ati-pagination-resume-"));
  const first = new HtmlPaginationStore(workspace, 4);
  first.write(makeRender(5), "IDLE", 1, 20, 120, "rich");

  const resumed = new HtmlPaginationStore(workspace, 4);
  resumed.write(makeRender(2), "BUSY", 0, 20, 120, "rich");
  const latest = readFileSync(join(workspace, "output", "latest.log.html"), "utf8");
  expect(latest).toContain("pre-file:");
});

test("pagination chain is idempotent and does not create duplicate archive files", () => {
  const workspace = mkdtempSync(join(tmpdir(), "ati-pagination-chain-"));
  const store = new HtmlPaginationStore(workspace, 3);
  store.write(makeRender(8), "BUSY", 5, 30, 100, "rich");
  store.write(makeRender(8), "IDLE", 5, 30, 100, "rich");

  const archivedA = readFileSync(join(workspace, "output", "1~3.log.html"), "utf8");
  const archivedB = readFileSync(join(workspace, "output", "4~6.log.html"), "utf8");
  const latest = readFileSync(join(workspace, "output", "latest.log.html"), "utf8");

  expect(archivedA).toContain("next-file: \"4~6.log.html\"");
  expect(archivedB).toContain("pre-file: \"1~3.log.html\"");
  expect(archivedB).toContain("next-file: \"latest.log.html\"");
  expect(latest).toContain("pre-file: \"4~6.log.html\"");
});

test("resize split seals latest and starts a viewport snapshot epoch", () => {
  const workspace = mkdtempSync(join(tmpdir(), "ati-pagination-resize-"));
  const store = new HtmlPaginationStore(workspace, 20);
  const before = makeRender(10);
  store.write(before, "BUSY", 4, 25, 90, "rich");

  const sealed = store.sealForResize(before.lines.length, {
    cursorRow: before.cursorAbsRow + 1,
    cursorCol: before.cursorCol + 1,
    viewportBase: 4,
    logStyle: "rich",
    rows: 25,
    cols: 90,
  });
  expect(sealed).toBe("1~10.log.html");
  expect(existsSync(join(workspace, "output", "latest.log.html"))).toBe(false);

  const sealedContent = readFileSync(join(workspace, "output", "1~10.log.html"), "utf8");
  expect(sealedContent).toContain("size: \"25x90\"");
  expect(sealedContent).not.toContain("\n  status:");
  expect(sealedContent).toContain("split-reason: TERMINAL_RESIZED");
  expect(sealedContent).toContain("next-file: \"latest.log.html\"");

  const after = makeRender(16);
  store.writeResizeSnapshot(after, "BUSY", 12, 80, 3, sealed, "rich");
  const latest = readFileSync(join(workspace, "output", "latest.log.html"), "utf8");
  expect(latest).toContain("size: \"3x80\"");
  expect(latest).toContain("pre-file: \"1~10.log.html\"");
  expect(latest).toContain("event: \"RESIZED_TO_80x3\"");
  expect(latest).toContain("<system-msg>=== Terminal Resized to 80x3.");
  expect(latest).toContain("line-13");
  expect(latest).toContain("line-15");
});
