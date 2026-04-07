import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const messageRowSource = readFileSync(resolve(import.meta.dirname, "../src/message-row.svelte"), "utf8");

describe("Feature: shared message row read-trigger placement", () => {
  test("Scenario: Given a room row with read progress When reading the shared source Then the trigger lives in the same message cluster as the bubble", () => {
    expect(messageRowSource).toContain('<div class="message-cluster" part="message-cluster">');
    expect(messageRowSource).toContain("<MessageReadIndicator progress={messageReadProgress} />");
    expect(messageRowSource).toContain(".message-cluster {");
  });
});
