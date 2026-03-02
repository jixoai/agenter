import { expect, test } from "bun:test";
import { join } from "node:path";

import { CommandDispatcher, resolveSubmitSequence } from "../src/core/command-dispatcher";
import { DebugLogger } from "../src/infra/logger";

test("resolveSubmitSequence keeps enter mapping for enter mode", () => {
  expect(resolveSubmitSequence("enter")).toBe("enter");
});

test("resolveSubmitSequence supports linefeed mode", () => {
  expect(resolveSubmitSequence("linefeed")).toBe("linefeed");
});

test("dispatcher uses pending mixed input and inserts ! delay", async () => {
  const writes: string[] = [];
  const dispatcher = new CommandDispatcher(
    {
      writeMixed: async (input) => {
        writes.push(input);
      },
    },
    new DebugLogger(join(process.cwd(), "demo", "logs", "test"), 50),
  );

  await dispatcher.dispatch({
    taskId: "t-1",
    text: "!date",
    submit: true,
    submitKey: "enter",
    submitGapMs: 120,
  });

  expect(writes.length).toBe(1);
  expect(writes[0]).toBe("!<wait ms=\"200\"/>date<wait ms=\"120\"/><key data=\"enter\"/>");
});
