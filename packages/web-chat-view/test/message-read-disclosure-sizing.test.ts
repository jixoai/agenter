import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const popoverContentSource = readFileSync(
  resolve(import.meta.dirname, "../src/ui/popover/popover-content.svelte"),
  "utf8",
);
const messageReadIndicatorSource = readFileSync(
  resolve(import.meta.dirname, "../src/message-read-indicator.svelte"),
  "utf8",
);

describe("Feature: message read disclosure sizing contract", () => {
  test("Scenario: Given a shared popover content primitive When reading the source Then width is driven by durable sizing variables instead of arbitrary width utilities", () => {
    expect(popoverContentSource).toContain("var(--popover-inline-size, 22rem)");
    expect(popoverContentSource).toContain("var(--popover-max-inline-size, calc(100vw - 2rem))");
    expect(popoverContentSource).not.toContain('w-[min(22rem,calc(100vw-2rem))]');
  });

  test("Scenario: Given the message read disclosure When reading the source Then it injects a readable compact width through the shared popover sizing contract", () => {
    expect(messageReadIndicatorSource).toContain('--popover-inline-size: 17rem;');
    expect(messageReadIndicatorSource).toContain('--popover-max-inline-size: calc(100vw - 1rem);');
    expect(messageReadIndicatorSource).not.toContain('w-[min(17rem,calc(100vw-1rem))]');
  });
});
