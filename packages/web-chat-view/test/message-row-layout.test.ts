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

  test("Scenario: Given a room row with a reply reference When reading the shared source Then the bubble exposes a first-class reference preview surface", () => {
    expect(messageRowSource).toContain('data-testid="message-ref-preview"');
    expect(messageRowSource).toContain('part="message-reference"');
  });

  test("Scenario: Given compact sent and received rows with actions When reading the shared CSS Then bubble action spacing does not reserve one fixed logical end for every card", () => {
    expect(messageRowSource).toContain("message-card-with-actions");
    expect(messageRowSource).not.toMatch(/\.message-card-with-actions\s*\{[^}]*padding-inline-end/su);
    expect(messageRowSource).not.toMatch(/@container[^{]*\{[^@]*\.message-card-with-actions\s*\{[^}]*padding-inline-end/su);
  });
});
