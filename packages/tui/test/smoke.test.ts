import { expect, test } from "bun:test";

import { runTuiClient } from "../src";

test("tui export exists", () => {
  expect(typeof runTuiClient).toBe("function");
});
