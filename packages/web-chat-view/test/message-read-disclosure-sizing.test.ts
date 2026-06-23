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
const messageActionsMenuSource = readFileSync(
  resolve(import.meta.dirname, "../src/message-actions-menu.svelte"),
  "utf8",
);

describe("Feature: message read disclosure sizing contract", () => {
  test("Scenario: Given a shared popover content primitive When reading the source Then width is driven by durable sizing variables instead of arbitrary width utilities", () => {
    expect(popoverContentSource).toContain("var(--popover-inline-size, 22rem)");
    expect(popoverContentSource).toContain("var(--popover-max-inline-size, calc(100vw - 2rem))");
    expect(popoverContentSource).not.toContain('w-[min(22rem,calc(100vw-2rem))]');
  });

  test("Scenario: Given the message read disclosure When reading the source Then it injects a readable compact width through the shared popover sizing contract", () => {
    expect(messageReadIndicatorSource).toContain('"--popover-inline-size: 19rem"');
    expect(messageReadIndicatorSource).toContain('"--popover-max-inline-size: calc(100vw - 1rem)"');
    expect(messageReadIndicatorSource).not.toContain('w-[min(19rem,calc(100vw-1rem))]');
  });

  test("Scenario: Given a discloseable read trigger rendered through plain markup When reading the source Then indicator sizing is package-global instead of relying on scoped component-root CSS", () => {
    expect(messageReadIndicatorSource).toContain("web-chat-message-read-indicator");
    expect(messageReadIndicatorSource).toContain(":global(.web-chat-message-read-indicator)");
    expect(messageReadIndicatorSource).toContain("WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT");
    expect(messageReadIndicatorSource).toContain("inline-size: var(--web-chat-message-read-indicator-size, 1.25rem);");
    expect(messageReadIndicatorSource).toContain("block-size: var(--web-chat-message-read-indicator-size, 1.25rem);");
  });

  test("Scenario: Given read progress is disclosed from the message action affordance When reading source Then the ring shell wraps the inner menu trigger", () => {
    expect(messageActionsMenuSource).toContain("<MessageReadIndicator");
    expect(messageActionsMenuSource).toContain("WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT");
    expect(messageActionsMenuSource).toContain('document.querySelectorAll("[data-message-actions-trigger]")');
    expect(messageActionsMenuSource).toContain("handleExternalReadDisclosureClose");
    expect(messageActionsMenuSource).toContain("closeReadDisclosure();");
    expect(messageActionsMenuSource).toContain("className");
    expect(messageActionsMenuSource).toContain("message-actions-menu-read");
    expect(messageActionsMenuSource).toContain("onpointerenter={openReadDisclosure}");
    expect(messageActionsMenuSource).toContain("onfocusout={handleReadDisclosureFocusOut}");
    expect(messageActionsMenuSource).toContain("readDisclosureCloseDelayMs = 650");
    expect(messageActionsMenuSource).toContain('target.closest(".message-read-disclosure")');
    expect(messageActionsMenuSource).not.toContain("onpointerleave={scheduleReadDisclosureClose}");
    expect(messageActionsMenuSource).not.toContain("onDisclosurePointerLeave={scheduleReadDisclosureClose}");
    expect(messageActionsMenuSource).not.toContain("onfocusout={scheduleReadDisclosureClose}");
    expect(messageActionsMenuSource).toContain("triggerMode=\"manual\"");
    expect(messageActionsMenuSource).toContain("targetEl={targetEl}");
    expect(messageActionsMenuSource).toContain("useCompactActions()");
    expect(messageActionsMenuSource).toContain("return { targetEl };");
    expect(messageActionsMenuSource).toContain("targetX: Math.round");
    expect(messageActionsMenuSource).toContain("targetY: Math.round");
    expect(messageActionsMenuSource).not.toContain("framework7Disclosure={false}");
    expect(messageActionsMenuSource).not.toContain("message-read-popover");
    expect(messageActionsMenuSource).toContain("class=\"message-actions-read-ring\"");
    expect(messageActionsMenuSource).toContain("inline-size: var(--message-action-button-size, 1.5rem);");
    expect(messageActionsMenuSource).toContain("--web-chat-message-read-indicator-size: var(--message-action-button-size, 1.5rem);");
    expect(messageActionsMenuSource).toContain("color: #0f766e;");
    expect(messageActionsMenuSource).toContain("filter: drop-shadow(0 0 1px rgba(20, 184, 166, 0.46));");
  });

  test("Scenario: Given the message read disclosure surface When reading the source Then a native popover owns the overlay shell while actor rows stay compact", () => {
    expect(messageReadIndicatorSource).toContain('popover="auto"');
    expect(messageReadIndicatorSource).toContain("showPopover");
    expect(messageReadIndicatorSource).toContain("position-anchor:");
    expect(messageReadIndicatorSource).toContain("position-try-fallbacks:");
    expect(messageReadIndicatorSource).toContain("position-try-order:");
    expect(messageReadIndicatorSource).not.toContain('import { Badge, Block, BlockTitle, Popover } from "./framework7-components";');
    expect(messageReadIndicatorSource).not.toContain("<Block");
    expect(messageReadIndicatorSource).not.toContain("<BlockTitle");
    expect(messageReadIndicatorSource).not.toContain("<Popover");
    expect(messageReadIndicatorSource).toContain('role="list"');
    expect(messageReadIndicatorSource).toContain('role="listitem"');
    expect(messageReadIndicatorSource).toContain("pointer-events: auto;");
    expect(messageReadIndicatorSource).toContain("display: grid;");
    expect(messageReadIndicatorSource).not.toContain("top: calc(100% + 0.45rem);");
    expect(messageReadIndicatorSource).not.toContain("<Card.Root");
  });
});
