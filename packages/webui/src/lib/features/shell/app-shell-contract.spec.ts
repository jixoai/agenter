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

  test("Scenario: Given the avatars system entry When reading the app shell source Then avatar session tabs remain wired as sidebar secondary navigation", () => {
    expect(appShellSource).toContain("import RunningAvatarRail");
    expect(appShellSource).toContain("readAvatarSessionTabIds");
    expect(appShellSource).toContain("AVATAR_SESSION_TABS_CHANGE_EVENT");
    expect(appShellSource).toContain("upsertAvatarSessionTabId");
    expect(appShellSource).toContain("readPinnedRunningAvatarIds");
    expect(appShellSource).toContain("reconcilePinnedRunningAvatarIds");
    expect(appShellSource).toContain("togglePinnedRunningAvatarId");
    expect(appShellSource).toContain("buildAvatarSessionRailItems(controller.runtimeState");
    expect(appShellSource).toContain("openedSessionIds: openedAvatarSessionIds");
    expect(appShellSource).toContain("pinnedSessionIds: pinnedAvatarSessionIds");
    expect(appShellSource).toContain("extractRuntimeSessionId(page.url.pathname)");
    expect(appShellSource).toContain("let openedAvatarSessionIds = $state<string[]>(readAvatarSessionTabIds())");
    expect(appShellSource).toContain("const showAvatarSubmenu = $derived(avatarSubmenuItems.length > 0 || activeItem?.href === '/avatars')");
    expect(appShellSource).toContain("item.href === '/avatars' && showAvatarSubmenu");
    expect(appShellSource).toContain("<RunningAvatarRail");
    expect(appShellSource).toContain("items={avatarSubmenuItems}");
    expect(appShellSource).toContain("onTogglePin={(sessionId, nextPinned) => {");
    expect(appShellSource).not.toContain("readOpenAvatarTabs");
    expect(appShellSource).not.toContain("buildOpenAvatarRailItems");
    expect(appShellSource).not.toContain("extractOpenAvatarTabId(page.url)");
    expect(appShellSource).not.toContain("const avatarsActive = $derived(activeItem?.href === '/avatars');");
  });

  test("Scenario: Given a compact viewport When reading the app shell source Then the shell opts into a docked mobile rail instead of a hidden drawer", () => {
    expect(appShellSource).toContain("import { IsMobile } from '$lib/hooks/is-mobile.svelte';");
    expect(appShellSource).toContain('const compactViewport = new IsMobile();');
    expect(appShellSource).toContain('shellSidebarOpen = nextCompactViewport ? false : desktopSidebarOpen;');
    expect(appShellSource).toContain('const handleShellSidebarOpenChange = (nextOpen: boolean): void => {');
    expect(appShellSource).toContain('<Sidebar.Provider open={shellSidebarOpen} onOpenChange={handleShellSidebarOpenChange}>');
    expect(appShellSource).toContain('<Sidebar.Sidebar mobileMode="docked" collapsible="icon" variant="inset">');
  });
});
