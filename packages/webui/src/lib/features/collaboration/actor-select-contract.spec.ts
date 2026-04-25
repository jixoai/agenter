import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const actorSelectSource = readFileSync(resolve(import.meta.dirname, "actor-select.svelte"), "utf8");

describe("Feature: Shared actor select primitive contract", () => {
  test("Scenario: Given actor selectors should stop rebuilding avatar dropdown markup per feature When reading the shared primitive Then it owns trigger avatars, dropdown avatars, and optional subtitle rendering in one place", () => {
    expect(actorSelectSource).toContain("import ProfileAvatar from '$lib/components/profile-avatar.svelte';");
    expect(actorSelectSource).toContain("<Select.Trigger");
    expect(actorSelectSource).toContain("<Select.Item");
    expect(actorSelectSource).toContain("selectedItem ?? items.find((item) => item.value === value) ?? null");
    expect(actorSelectSource).toContain("resolvedDensity");
    expect(actorSelectSource).toContain("resolvedChrome");
    expect(actorSelectSource).toContain("showTriggerSubtitle");
    expect(actorSelectSource).toContain("showMenuSubtitle");
    expect(actorSelectSource).toContain("const renderTriggerSubtitle = $derived(showTriggerSubtitle);");
    expect(actorSelectSource).toContain("const renderMenuSubtitle = $derived(showMenuSubtitle);");
  });
});
