import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const appShellSource = readFileSync(resolve(import.meta.dirname, "app-shell.svelte"), "utf8");

describe("Feature: App shell collapsed sidebar chrome", () => {
  test("Scenario: Given collapsed desktop navigation When reading the app shell source Then route icons stay visible, labels collapse, and the footer binds session profile data", () => {
    expect(appShellSource).toContain("group-data-[collapsible=icon]:justify-center");
    expect(appShellSource).toContain(
      "bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:hidden",
    );
    expect(appShellSource).toContain('<item.icon class="size-4" />');
    expect(appShellSource).toContain('<span class="group-data-[collapsible=icon]:hidden">{item.label}</span>');
    expect(appShellSource).toContain("aria-label={profileLabel}");
    expect(appShellSource).toContain("group-data-[collapsible=icon]:size-11");
    expect(appShellSource).toContain("group-data-[collapsible=icon]:self-center");
    expect(appShellSource).toContain("group-data-[collapsible=icon]:bg-sidebar-accent/20");
    expect(appShellSource).toContain('<div class="truncate text-sm font-medium">{profileLabel}</div>');
    expect(appShellSource).toContain('class="size-10 group-data-[collapsible=icon]:size-7"');
    expect(appShellSource).not.toContain(">Super admin<");
  });

  test("Scenario: Given the avatars system entry When reading the app shell source Then running avatars remain wired as sidebar secondary navigation", () => {
    expect(appShellSource).toContain("import RunningAvatarRail");
    expect(appShellSource).toContain("readPinnedRunningAvatarIds");
    expect(appShellSource).toContain("reconcilePinnedRunningAvatarIds");
    expect(appShellSource).toContain("togglePinnedRunningAvatarId");
    expect(appShellSource).toContain("buildRunningAvatarRailItems(controller.runtimeState");
    expect(appShellSource).toContain("pinnedSessionIds: pinnedAvatarSessionIds");
    expect(appShellSource).toContain("extractRuntimeSessionId(page.url.pathname)");
    expect(appShellSource).toContain("const showRunningAvatarSubmenu = $derived(");
    expect(appShellSource).toContain("runningAvatarItems.length > 0 || activeItem?.href === '/avatars'");
    expect(appShellSource).toContain("item.href === '/avatars' && showRunningAvatarSubmenu");
    expect(appShellSource).toContain("<RunningAvatarRail");
    expect(appShellSource).toContain("items={runningAvatarItems}");
    expect(appShellSource).toContain("onTogglePin={(sessionId, nextPinned) => {");
    expect(appShellSource).not.toContain("const avatarsActive = $derived(activeItem?.href === '/avatars');");
  });
});
