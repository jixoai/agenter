import { expect, test } from "bun:test";

import { projectTerminalViewport, type TerminalRenderRichLine } from "../src";

test("viewport projection injects cursor by terminal column width instead of raw string length", () => {
  const lines: TerminalRenderRichLine[] = [
    {
      spans: [{ text: "A🙂B" }],
    },
  ];

  const projected = projectTerminalViewport({
    lines,
    cursorAbsRow: 0,
    cursorCol: 3,
    cursorVisible: true,
    viewportRows: 1,
  });

  expect(projected.lines).toHaveLength(1);
  expect(projected.lines[0]?.spans.map((span) => span.text)).toEqual(["A🙂", "█", "B"]);
  expect(projected.cursor.source).toBe("hardware");
  expect(projected.cursor.col).toBe(3);
});
