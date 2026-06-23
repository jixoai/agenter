import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const readSource = (relativePath: string): string => readFileSync(resolve(import.meta.dirname, relativePath), "utf8");

describe("Feature: Skills avatar loading contract", () => {
  test("Scenario: Given the skills avatar overview is loading When no avatar data exists Then Skeletons stand in for missing data only", () => {
    const source = readSource("skills-avatar-overview.svelte");

    expect(source).toContain("import AvatarLoadingSkeleton from '$lib/features/avatars/avatar-loading-skeleton.svelte';");
    expect(source).toContain("const loadingWithoutData = $derived(loading && avatarItems.length === 0)");
    expect(source).toContain("const refreshingWithData = $derived(loading && avatarItems.length > 0)");
    expect(source).toContain('<AvatarLoadingSkeleton variant="catalog-list" />');
    expect(source).toContain('<AvatarLoadingSkeleton variant="catalog-detail" />');
    expect(source).toContain('data-testid="skills-avatar-overview-refreshing"');
    expect(source).not.toContain("Loading avatar catalog");
  });

  test("Scenario: Given a dedicated skills avatar route is loading When previous data exists Then the browser remains visible and refresh has a status signal", () => {
    const source = readSource("skill-avatar-route.svelte");

    expect(source).toContain("import AvatarLoadingSkeleton from '$lib/features/avatars/avatar-loading-skeleton.svelte';");
    expect(source).toContain("const loadingWithoutData = $derived(loading && avatarItems.length === 0)");
    expect(source).toContain("const refreshingWithData = $derived(loading && avatarItems.length > 0)");
    expect(source).toContain('{#if loadingWithoutData}');
    expect(source).toContain('<AvatarLoadingSkeleton variant="skill-browser" />');
    expect(source).toContain('label="Refreshing"');
    expect(source).toContain('title="Refreshing avatar skill browser"');
    expect(source).not.toContain("Loading avatar skill browser…");
  });
});
