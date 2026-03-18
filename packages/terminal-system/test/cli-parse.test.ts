import { expect, test } from "bun:test";

import { normalizeAtiArgv, normalizeAtiRunLayout } from "../src/cli/normalize-command";

test("keep explicit run command", () => {
  expect(normalizeAtiArgv(["run", "codex"])).toEqual(["run", "codex"]);
});

test("fallback unknown command to run", () => {
  expect(normalizeAtiArgv(["codex", "--dangerously-skip-permissions"])).toEqual([
    "run",
    "codex",
    "--dangerously-skip-permissions",
  ]);
});

test("fallback with global options before command", () => {
  expect(normalizeAtiArgv(["-o", "./logs", "codex", "--foo"])).toEqual(["-o", "./logs", "run", "codex", "--foo"]);
});

test("no positional token keeps args unchanged", () => {
  expect(normalizeAtiArgv(["-o", "./logs"])).toEqual(["-o", "./logs"]);
});

test("fallback with size and color options before command", () => {
  expect(normalizeAtiArgv(["--size=10:120", "--color=truecolor", "codex", "--fast"])).toEqual([
    "--size=10:120",
    "--color=truecolor",
    "run",
    "codex",
    "--fast",
  ]);
});

test("run layout parses ATI options before child command", () => {
  expect(normalizeAtiRunLayout(["run", "--log-style=plain", "codex", "--model", "o3"])).toEqual([
    "run",
    "--log-style=plain",
    "codex",
    "--",
    "--model",
    "o3",
  ]);
});

test("run layout keeps trailing flags as child args", () => {
  expect(normalizeAtiRunLayout(["run", "codex", "--log-style=plain"])).toEqual([
    "run",
    "codex",
    "--",
    "--log-style=plain",
  ]);
});

test("fallback command with run layout keeps child args verbatim", () => {
  expect(normalizeAtiRunLayout(["--size=10:120", "codex", "--dangerously-skip-permissions"])).toEqual([
    "--size=10:120",
    "run",
    "codex",
    "--",
    "--dangerously-skip-permissions",
  ]);
});
