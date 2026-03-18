import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel, appRouter, createTrpcContext } from "../src";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-trpc-router-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: app-server trpc procedures", () => {
  test("Scenario: Given caller creates session When listing and deleting Then lifecycle is reflected", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    const caller = appRouter.createCaller(createTrpcContext(kernel));

    const created = await caller.session.create({
      cwd: root,
      name: "workspace",
      autoStart: false,
    });

    expect(created.session.name).toBe("workspace");

    const listed = await caller.session.list();
    expect(listed.sessions).toHaveLength(1);

    const archived = await caller.session.archive({ sessionId: created.session.id });
    expect(archived.session.storageState).toBe("archived");

    const restored = await caller.session.restore({ sessionId: created.session.id });
    expect(restored.session.storageState).toBe("active");

    const deleted = await caller.session.delete({ sessionId: created.session.id });
    expect(deleted.removed).toBe(true);

    const afterDelete = await caller.session.list();
    expect(afterDelete.sessions).toHaveLength(0);

    await kernel.stop();
  });

  test("Scenario: Given workspace and session procedures When querying Then pages favorites and archive results are returned", async () => {
    const root = makeTempDir();
    const workspaceA = join(root, "workspace-a");
    const workspaceB = join(root, "workspace-b");
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    const caller = appRouter.createCaller(createTrpcContext(kernel));

    const createdA = await caller.session.create({ cwd: workspaceA, name: "A", autoStart: false });
    await caller.session.create({ cwd: workspaceB, name: "B", autoStart: false });

    const recent = await caller.workspace.recent({ limit: 8 });
    expect(recent.items[0]).toBe(workspaceB);
    expect(recent.items.includes(workspaceA)).toBeTrue();

    const all = await caller.workspace.listAll();
    expect(all.items.some((item) => item.path === workspaceA)).toBeTrue();
    expect(all.items.some((item) => item.path === workspaceB)).toBeTrue();

    const toggled = await caller.workspace.toggleFavorite({ path: workspaceA });
    expect(toggled.item.path).toBe(workspaceA);
    expect(toggled.item.favorite).toBeTrue();

    const sessionFavorite = await caller.workspace.toggleSessionFavorite({ sessionId: createdA.session.id });
    expect(sessionFavorite.favorite).toBeTrue();

    const page = await caller.workspace.listSessions({ path: workspaceA, tab: "all", limit: 20 });
    expect(page.items[0]?.sessionId).toBe(createdA.session.id);
    expect(page.items[0]?.favorite).toBeTrue();

    await caller.session.archive({ sessionId: createdA.session.id });
    const archivePage = await caller.workspace.listSessions({ path: workspaceA, tab: "archive", limit: 20 });
    expect(archivePage.items[0]?.sessionId).toBe(createdA.session.id);
    expect(archivePage.counts.archive).toBe(1);

    const removed = await caller.workspace.delete({ path: workspaceB });
    expect(removed.removed).toBeTrue();

    const listing = await caller.fs.listDirectories({ path: root, includeHidden: false });
    expect(listing.items.some((item) => item.path === workspaceA)).toBeTrue();

    const valid = await caller.fs.validateDirectory({ path: workspaceA });
    const invalid = await caller.fs.validateDirectory({ path: join(root, "nope") });
    expect(valid.ok).toBeTrue();
    expect(invalid.ok).toBeFalse();

    await kernel.stop();
  });
});
