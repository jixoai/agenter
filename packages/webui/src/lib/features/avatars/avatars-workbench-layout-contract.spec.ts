import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const avatarsWorkbenchLayoutSource = readFileSync(
  resolve(import.meta.dirname, "avatars-workbench-layout.svelte"),
  "utf8",
);

describe("Feature: Avatar workbench toolbar density contract", () => {
  test("Scenario: Given runtime routes already own the page-toolbar When reading the avatar workbench source Then the outer shell keeps only fixed collection tabs and does not revive a second header row", () => {
    expect(avatarsWorkbenchLayoutSource).toContain("createAvatarCreateDraft");
    expect(avatarsWorkbenchLayoutSource).toContain("id: 'catalog'");
    expect(avatarsWorkbenchLayoutSource).toContain("label: 'My avatars'");
    expect(avatarsWorkbenchLayoutSource).toContain("id: 'create'");
    expect(avatarsWorkbenchLayoutSource).toContain("label: 'Add avatar'");
    expect(avatarsWorkbenchLayoutSource).toContain("const openCreateTab = async");
    expect(avatarsWorkbenchLayoutSource).toContain(
      "const activeTabValue = $derived(activeDraftId ? 'create' : activeSessionId ?? 'catalog');",
    );
    expect(avatarsWorkbenchLayoutSource).toContain("onValueChange={handleWorkbenchValueChange}");
    expect(avatarsWorkbenchLayoutSource).not.toContain("toolbar={avatarsToolbar}");
    expect(avatarsWorkbenchLayoutSource).not.toContain("<WorkbenchToolbar");
    expect(avatarsWorkbenchLayoutSource).not.toContain('data-testid="avatar-workbench-toolbar"');
    expect(avatarsWorkbenchLayoutSource).not.toContain("New avatar");
  });

  test("Scenario: Given avatar runtimes live inside WorkbenchWindow fill mode When reading the avatar workbench source Then the direct route wrapper stays plain and shared fill law owns the shrink contract", () => {
    expect(avatarsWorkbenchLayoutSource).toContain('bodyMode="fill"');
    expect(avatarsWorkbenchLayoutSource).toContain('<div class="h-full">');
  });
});
