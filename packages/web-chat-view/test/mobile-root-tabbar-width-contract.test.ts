import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const reviewShellAppCssSource = readFileSync(
  resolve(import.meta.dirname, "../example/src/app.css"),
  "utf8",
);
const reviewShellClientSource = readFileSync(
  resolve(import.meta.dirname, "../example/src/lib/review-shell-client.svelte"),
  "utf8",
);

describe("Feature: mobile root tabbar width contract", () => {
  test("Scenario: Given the compact review shell When reading the implementation Then the official tabbar remains a three-destination bar", () => {
    expect(reviewShellAppCssSource).not.toContain(".review-shell-tabbar-pane");
    expect(reviewShellClientSource).toContain("<ToolbarPane>");
    expect(reviewShellClientSource).toContain('tabLink="#review-shell-tab-messages"');
    expect(reviewShellClientSource).toContain('tabLink="#review-shell-tab-contacts"');
    expect(reviewShellClientSource).toContain('tabLink="#review-shell-tab-me"');
  });
});
