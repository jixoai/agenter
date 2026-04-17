import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const avatarsWorkbenchLayoutSource = readFileSync(
  resolve(import.meta.dirname, "avatars-workbench-layout.svelte"),
  "utf8",
);

describe("Feature: Avatar workbench toolbar density contract", () => {
  test("Scenario: Given avatar workbench should align with the shared toolbar language When reading the source Then identity and action share the existing workbench-toolbar content pattern instead of a route-specific chrome invention", () => {
    expect(avatarsWorkbenchLayoutSource).not.toContain("import { Badge }");
    expect(avatarsWorkbenchLayoutSource).not.toContain("avatarsToolbarMeta");
    expect(avatarsWorkbenchLayoutSource).toContain("const activeTabItem = $derived");
    expect(avatarsWorkbenchLayoutSource).toContain("const activeToolbarSubtitle = $derived.by(() => {");
    expect(avatarsWorkbenchLayoutSource).toContain("activeTabItem.id === 'catalog'");
    expect(avatarsWorkbenchLayoutSource).toContain("<WorkbenchToolbar content={avatarsToolbarContent} />");
    expect(avatarsWorkbenchLayoutSource).toContain('data-testid="avatar-workbench-toolbar"');
    expect(avatarsWorkbenchLayoutSource).toContain("avatar-page-toolbar__identity");
    expect(avatarsWorkbenchLayoutSource).toContain("ProfileAvatar");
    expect(avatarsWorkbenchLayoutSource).toContain("New avatar");
    expect(avatarsWorkbenchLayoutSource).toContain("{#if !toolbarState.isNarrow && activeToolbarSubtitle}");
    expect(avatarsWorkbenchLayoutSource).not.toContain('<Badge variant="outline" class="bg-background/70">');
  });
});
