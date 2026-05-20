import { describe, expect, test } from "vitest";

import { buildWorkspaceDetailHref, buildWorkspaceIndexHref, readWorkspaceAvatar } from "./workspace-location";

describe("Feature: Workspace routing helpers", () => {
  test("Scenario: Given the workspaces start page When building hrefs Then avatar context stays on the fixed chooser route without inventing a root param", () => {
    expect(buildWorkspaceIndexHref()).toBe("/workspaces");
    expect(buildWorkspaceIndexHref({ avatar: "reviewer" })).toBe("/workspaces?avatar=reviewer");
  });

  test("Scenario: Given one chosen workspace root When building the detail href Then the root moves into the pathname and query state only carries lens or mode metadata", () => {
    expect(
      buildWorkspaceDetailHref({
        workspacePath: "/repo/agenter",
        avatar: "reviewer",
        mode: "cli",
        q: "README",
      }),
    ).toBe("/workspaces/root/%2Frepo%2Fagenter?avatar=reviewer&mode=cli&q=README");

    expect(buildWorkspaceDetailHref({ workspacePath: "~/" })).toBe("/workspaces/root/~%2F");
  });

  test("Scenario: Given workspace search params When reading the avatar lens Then blank avatar values collapse to null", () => {
    expect(readWorkspaceAvatar(new URLSearchParams("avatar=reviewer"))).toBe("reviewer");
    expect(readWorkspaceAvatar(new URLSearchParams("avatar=%20%20"))).toBeNull();
    expect(readWorkspaceAvatar(new URLSearchParams())).toBeNull();
  });
});
