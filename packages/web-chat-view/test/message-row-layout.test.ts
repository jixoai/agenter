import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const messageRowSource = readFileSync(resolve(import.meta.dirname, "../src/message-row.svelte"), "utf8");
const messageCommentActionPopoverSource = readFileSync(
  resolve(import.meta.dirname, "../src/message-comment-action-popover.svelte"),
  "utf8",
);
const messageActionsMenuSource = readFileSync(
  resolve(import.meta.dirname, "../src/message-actions-menu.svelte"),
  "utf8",
);

describe("Feature: shared message row read-trigger placement", () => {
  test("Scenario: Given a room row with read progress When reading the shared source Then the read ring composes into the external action affordance", () => {
    expect(messageRowSource).toContain('<div class="message-cluster" part="message-cluster">');
    expect(messageRowSource).toContain("readProgress={messageReadProgress}");
    expect(messageRowSource).toContain("{#snippet contentEnd()}");
    expect(messageRowSource).toContain("bubble-actions-${tone}");
    expect(messageRowSource).toContain('messageReadProgress ? "bubble-actions-has-read" : ""');
    expect(messageRowSource).toContain('class={messageReadProgress ? "bubble-actions-read" : ""}');
    expect(messageRowSource).toContain("--message-read-disclosure-inline-start: auto;");
    expect(messageRowSource).not.toContain("<MessageReadIndicator progress={messageReadProgress} />");
    expect(messageRowSource).toContain(".message-cluster {");
    expect(messageRowSource).toContain(
      "--message-action-inline-offset: calc(-1 * var(--message-action-button-size) - 0.75rem);",
    );
    expect(messageRowSource).toContain("--message-action-block-offset: 0;");
    expect(messageRowSource).toContain("inset-block-end: var(--message-action-block-offset);");
    expect(messageRowSource).toContain("inset-inline-end: var(--message-action-inline-offset);");
    expect(messageRowSource).toContain("inset-inline-start: var(--message-action-inline-offset);");
    expect(messageRowSource.indexOf("{#snippet contentEnd()}")).toBeGreaterThan(
      messageRowSource.indexOf("<MessageCommentActionPopover"),
    );
    expect(messageRowSource.indexOf('class={`bubble-actions')).toBeGreaterThan(
      messageRowSource.indexOf("{#snippet contentEnd()}"),
    );
    expect(messageRowSource).toMatch(/\.bubble-actions-has-read\s*\{[^}]*opacity:\s*1/su);
    expect(messageRowSource).toMatch(
      /\.message-shell:hover\s+\.bubble-actions-has-read,\s*\.message-shell:focus-within\s+\.bubble-actions-has-read,\s*\.bubble-actions-open\.bubble-actions-has-read\s*\{[^}]*opacity:\s*1/su,
    );
  });

  test("Scenario: Given source comment entry moved away from double-click When reading the row source Then only primary-button selection opens a comment action popover", () => {
    expect(messageRowSource).toContain("<MessageCommentActionPopover");
    expect(messageRowSource).toContain("onpointerup={(event: PointerEvent)");
    expect(messageRowSource).toContain("event.button !== 0");
    expect(messageRowSource).toContain("openSelectionCommentFromSelection");
    expect(messageRowSource).not.toContain("oncontextmenu");
    expect(messageRowSource).not.toContain("openSelectionCommentFromContext");
    expect(messageRowSource).not.toContain("ondblclick");
  });

  test("Scenario: Given one row opens a comment action When another row opens one Then existing row-local affordances close through a named event contract", () => {
    expect(messageRowSource).toContain("WEB_CHAT_CLOSE_COMMENT_ACTION_POPOVERS_EVENT");
    expect(messageCommentActionPopoverSource).toContain("WEB_CHAT_CLOSE_COMMENT_ACTION_POPOVERS_EVENT");
    expect(messageCommentActionPopoverSource).toContain("portalToBody");
    expect(messageCommentActionPopoverSource).toContain("message-comment-action-popover-fallback");
    expect(messageCommentActionPopoverSource).toContain("message-comment-action-anchor");
    expect(messageCommentActionPopoverSource).toContain("--message-comment-action-anchor-left");
    expect(messageCommentActionPopoverSource).not.toContain("message-comment-action-f7-popover");
  });

  test("Scenario: Given read disclosures are row-local When another row opens one Then the previous read disclosure closes through a named event contract", () => {
    expect(messageActionsMenuSource).toContain("WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT");
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

  test("Scenario: Given a short CJK message When reading the shared CSS Then the bubble keeps a small horizontal floor without disabling long-message wrapping", () => {
    expect(messageRowSource).toMatch(
      /:global\(\.message \.message-bubble\)\s*\{[^}]*min-inline-size:\s*3\.4em/su,
    );
    expect(messageRowSource).toMatch(/\.message-card\s*\{[^}]*inline-size:\s*fit-content[^}]*min-inline-size:\s*3\.4em/su);
    expect(messageRowSource).toMatch(/\.content\s*\{[^}]*inline-size:\s*fit-content[^}]*min-inline-size:\s*3\.4em/su);
    expect(messageRowSource).toMatch(
      /\.content\s+:global\(\.message-markdown-content\),\s*\.content\s+:global\(\.message-markdown-fallback\)\s*\{[^}]*inline-size:\s*fit-content[^}]*min-inline-size:\s*3\.4em/su,
    );
    expect(messageRowSource).not.toMatch(/\.message-card\s*\{[^}]*inline-size:\s*max-content/su);
  });
});
