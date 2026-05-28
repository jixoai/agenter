import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const sourcePopupSource = readFileSync(
  resolve(import.meta.dirname, "../src/message-source-popup.svelte"),
  "utf8",
);

describe("Feature: canonical message source popup contract", () => {
  test("Scenario: Given the shared popup source When reading the implementation Then it carries sender identity, line anchors, and copy confirmation", () => {
    expect(sourcePopupSource).toContain('showFramework7Toast("已复制全文")');
    expect(sourcePopupSource).toContain('data-line-number={index + 1}');
    expect(sourcePopupSource).toContain("message-source-navbar-name");
    expect(sourcePopupSource).toContain('aria-label={`Source for ${resolvedActor.label}`}');
    expect(sourcePopupSource).toContain("buildCommentResourceSourceUri");
    expect(sourcePopupSource).toContain("sourceUri: selectedSourceUri");
  });
});
