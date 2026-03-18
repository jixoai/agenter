import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { WorkspacesStore } from "../src/workspaces-store";

describe("Feature: workspaces store", () => {
  test("Scenario: Given adding workspaces When reloading Then workspaces.yaml keeps recent order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-workspaces-"));
    const filePath = join(dir, "workspaces.yaml");

    const first = new WorkspacesStore({ filePath });
    first.add("/repo/a");
    first.add("/repo/b");

    const second = new WorkspacesStore({ filePath });
    expect(second.list()).toEqual(["/repo/b", "/repo/a"]);
  });

  test("Scenario: Given two store instances When both write Then workspace and session favorites stay durable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-workspaces-"));
    const filePath = join(dir, "workspaces.yaml");

    const first = new WorkspacesStore({ filePath });
    const second = new WorkspacesStore({ filePath });

    first.add("/repo/a");
    second.add("/repo/b");
    first.toggleWorkspaceFavorite("/repo/a");
    second.toggleSessionFavorite("session-1");

    const latest = new WorkspacesStore({ filePath });
    expect(latest.list()).toEqual(["/repo/b", "/repo/a"]);
    expect(latest.listEntries().find((item) => item.path === "/repo/a")?.favorite).toBeTrue();
    expect(latest.favoriteSessionIds()).toEqual(["session-1"]);
  });

  test("Scenario: Given session favorite is removed When reloading Then favoriteSessions no longer includes the deleted id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-workspaces-"));
    const filePath = join(dir, "workspaces.yaml");

    const store = new WorkspacesStore({ filePath });
    store.toggleSessionFavorite("session-1");
    store.removeSessionFavorite("session-1");

    const reloaded = new WorkspacesStore({ filePath });
    expect(reloaded.favoriteSessionIds()).toEqual([]);
  });

  test("Scenario: Given legacy corrupted path entry When reloading Then workspace path is repaired before reuse", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-workspaces-"));
    const filePath = join(dir, "workspaces.yaml");
    const workspace = join(dir, "workspace");
    await mkdir(workspace, { recursive: true });

    const corrupted = `${dir}/path: ${JSON.stringify(workspace)}`;
    await writeFile(
      filePath,
      [
        "version: 2",
        "updatedAt: 2026-03-06T07:17:04.421Z",
        "workspaces:",
        `  - ${JSON.stringify(corrupted)}`,
        "favoriteWorkspaces:",
        `  - ${JSON.stringify(corrupted)}`,
        "favoriteSessions:",
        "",
      ].join("\n"),
      "utf8",
    );

    const reloaded = new WorkspacesStore({ filePath });
    expect(reloaded.list()).toEqual([workspace]);
    expect(reloaded.listEntries()).toEqual([{ path: workspace, favorite: true }]);
  });
});
