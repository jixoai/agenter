import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test } from "bun:test";

import { WorkspacesStore } from "../src/workspaces-store";

describe("Feature: workspaces store", () => {
  test("Scenario: Given adding workspaces When reloading Then workspaces.yaml remains durable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-workspaces-"));
    const filePath = join(dir, "workspaces.yaml");

    const first = new WorkspacesStore({ filePath });
    first.add("/repo/a");
    first.add("/repo/b");

    const second = new WorkspacesStore({ filePath });
    expect(second.list()).toEqual(["/repo/a", "/repo/b"]);
  });

  test("Scenario: Given two store instances When both write Then no workspace entry is lost", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-workspaces-"));
    const filePath = join(dir, "workspaces.yaml");

    const first = new WorkspacesStore({ filePath });
    const second = new WorkspacesStore({ filePath });

    first.add("/repo/a");
    second.add("/repo/b");

    const latest = new WorkspacesStore({ filePath });
    expect(latest.list()).toEqual(["/repo/a", "/repo/b"]);
  });
});
