import { expect, test } from "bun:test";

import { runCli } from "../src";

test("cli export exists", () => {
  expect(typeof runCli).toBe("function");
});
