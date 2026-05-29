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

  test("Scenario: Given a discloseable read trigger rendered through Framework7 Link When reading the source Then indicator sizing is package-global instead of relying on scoped component-root CSS", () => {
    expect(messageReadIndicatorSource).toContain("web-chat-message-read-indicator");
    expect(messageReadIndicatorSource).toContain(":global(.web-chat-message-read-indicator)");
    expect(messageReadIndicatorSource).toContain("inline-size: var(--web-chat-message-read-indicator-size, 1.25rem);");
    expect(messageReadIndicatorSource).toContain("block-size: var(--web-chat-message-read-indicator-size, 1.25rem);");
  });

  test("Scenario: Given the message read disclosure surface When reading the source Then it composes Framework7 list and block primitives instead of a custom card stack", () => {
    expect(messageReadIndicatorSource).toContain('import { Badge, Block, BlockTitle, Link, List, ListItem, Popover } from "./framework7-components";');
    expect(messageReadIndicatorSource).toContain("<Block");
    expect(messageReadIndicatorSource).toContain("<BlockTitle");
    expect(messageReadIndicatorSource).toContain("<List");
    expect(messageReadIndicatorSource).toContain("<ListItem");
    expect(messageReadIndicatorSource).not.toContain("<Card.Root");
  });
});
