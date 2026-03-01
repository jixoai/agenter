import { expect, test } from "bun:test";

import { parseColorOption, parseGitLogOption, parseLogStyleOption, parseSizeOption, resolveSizeWithFallback } from "../src/cli/option-parser";

test("parse --size supports short forms", () => {
  expect(parseSizeOption(undefined)).toEqual({
    rows: "auto",
    cols: "auto",
    normalized: "auto:auto",
  });
  expect(parseSizeOption("10")).toEqual({
    rows: 10,
    cols: "auto",
    normalized: "10:auto",
  });
  expect(parseSizeOption(":10")).toEqual({
    rows: "auto",
    cols: 10,
    normalized: "auto:10",
  });
  expect(parseSizeOption("auto")).toEqual({
    rows: "auto",
    cols: "auto",
    normalized: "auto:auto",
  });
});

test("parse --size rejects invalid tokens", () => {
  expect(() => parseSizeOption("0")).toThrow();
  expect(() => parseSizeOption("x:10")).toThrow();
  expect(() => parseSizeOption("1:2:3")).toThrow();
});

test("resolve size keeps fixed axis and inherits auto axis", () => {
  const requested = parseSizeOption("10:auto");
  const resolved = resolveSizeWithFallback(requested, { rows: 55, cols: 144 });
  expect(resolved.rows).toBe(10);
  expect(resolved.cols).toBe(144);
});

test("parse --color supports aliases and auto", () => {
  expect(parseColorOption(undefined)).toBe("auto");
  expect(parseColorOption("auto")).toBe("auto");
  expect(parseColorOption("truecolor")).toBe("truecolor");
  expect(parseColorOption("24bit")).toBe("truecolor");
  expect(parseColorOption("xterm-256color")).toBe("256");
  expect(parseColorOption("off")).toBe("none");
});

test("parse --color rejects unsupported values", () => {
  expect(() => parseColorOption("rainbow")).toThrow();
});

test("parse --log-style supports explicit mode and keep-style alias", () => {
  expect(parseLogStyleOption(undefined, undefined)).toBe("rich");
  expect(parseLogStyleOption("rich", undefined)).toBe("rich");
  expect(parseLogStyleOption("plain", undefined)).toBe("plain");
  expect(parseLogStyleOption(undefined, true)).toBe("rich");
  expect(parseLogStyleOption(undefined, false)).toBe("plain");
});

test("parse --log-style rejects unsupported values", () => {
  expect(() => parseLogStyleOption("fancy", undefined)).toThrow();
});

test("parse --git-log supports bool-like and mode values", () => {
  expect(parseGitLogOption(undefined)).toBe("none");
  expect(parseGitLogOption("")).toBe("normal");
  expect(parseGitLogOption("true")).toBe("normal");
  expect(parseGitLogOption("normal")).toBe("normal");
  expect(parseGitLogOption("verbose")).toBe("verbose");
  expect(parseGitLogOption("off")).toBe("none");
  expect(parseGitLogOption("none")).toBe("none");
});

test("parse --git-log rejects unsupported values", () => {
  expect(() => parseGitLogOption("trace")).toThrow();
});
