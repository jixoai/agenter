import { describe, expect, test } from "vitest";

import {
  buildNotesAvatarHref,
  buildNotesOverviewHref,
  normalizeNotesMode,
  readLegacyNotesAvatarNickname,
  readNotesRouteScope,
} from "./notes-workbench-location";

describe("Feature: Notes workbench route contract", () => {
  test("Scenario: Given the fixed Notes entry When building overview href Then /notes remains the Overview tab", () => {
    expect(buildNotesOverviewHref()).toBe("/notes");
  });

  test("Scenario: Given an avatar nickname When building avatar mode hrefs Then the avatar identity stays path-scoped", () => {
    expect(buildNotesAvatarHref("default")).toBe("/notes/avatar/default");
    expect(buildNotesAvatarHref("default", "search")).toBe("/notes/avatar/default/search");
    expect(buildNotesAvatarHref("default", "query")).toBe("/notes/avatar/default/query");
  });

  test("Scenario: Given canonical avatar routes When reading route scope Then avatar and page-toolbar mode restore together", () => {
    expect(readNotesRouteScope("/notes/avatar/default/search")).toEqual({
      avatarNickname: "default",
      mode: "search",
    });
    expect(readNotesRouteScope("/notes/avatar/default/query")).toEqual({
      avatarNickname: "default",
      mode: "query",
    });
    expect(readNotesRouteScope("/notes/avatar/default")).toEqual({
      avatarNickname: "default",
      mode: "browse",
    });
  });

  test("Scenario: Given unknown mode or overview route When normalizing Then Browse remains the safe default", () => {
    expect(normalizeNotesMode("unknown")).toBe("browse");
    expect(readNotesRouteScope("/notes")).toEqual({
      avatarNickname: null,
      mode: "browse",
    });
  });

  test("Scenario: Given legacy avatar query When reading legacy scope Then the route can canonicalize without body selectors", () => {
    expect(readLegacyNotesAvatarNickname(new URLSearchParams("avatar=default"))).toBe("default");
    expect(readLegacyNotesAvatarNickname(new URLSearchParams())).toBeNull();
  });
});
