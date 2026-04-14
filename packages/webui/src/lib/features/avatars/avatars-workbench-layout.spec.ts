import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const avatarsWorkbenchSource = readFileSync(resolve(import.meta.dirname, "avatars-workbench-layout.svelte"), "utf8");

describe("Feature: Avatar workbench toolbar ownership", () => {
  test("Scenario: Given a runtime or draft detail tab is active When reading the workbench layout source Then the catalog toolbar is withheld so the detail route owns the only local toolbar row", () => {
    expect(avatarsWorkbenchSource).toContain("const showWorkbenchToolbar = $derived(activeTabValue === 'catalog');");
    expect(avatarsWorkbenchSource).toContain("toolbar={showWorkbenchToolbar ? avatarsToolbar : undefined}");
  });
});
