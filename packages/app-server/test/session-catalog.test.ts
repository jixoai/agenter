import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { SessionCatalog } from "../src/session-catalog";
import { resolveWorkspaceAvatarSessionId } from "../src/session-identity";

describe("Feature: session catalog", () => {
  test("Scenario: Given create/update/delete actions When catalog mutates Then lifecycle state is managed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-session-catalog-"));
    const catalog = new SessionCatalog({ globalRoot: join(dir, "sessions"), archiveRoot: join(dir, "archive", "sessions") });

    const session = catalog.create({
      cwd: dir,
      name: "demo",
      avatar: "tester-bot",
      storeTarget: "global",
    });

    expect(catalog.list()).toHaveLength(1);
    expect(session.name).toBe("demo");
    expect(session.status).toBe("stopped");
    expect(session.storageState).toBe("active");

    const updated = catalog.update(session.id, { status: "running" });
    expect(updated.status).toBe("running");

    const archived = catalog.archive(session.id);
    expect(archived.storageState).toBe("archived");

    const restored = catalog.restore(session.id);
    expect(restored.storageState).toBe("active");

    const removed = catalog.remove(session.id);
    expect(removed).toBeTrue();
    expect(catalog.list()).toHaveLength(0);
  });

  test("Scenario: Given persisted running status When catalog refreshes Then status falls back to stopped", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-session-catalog-refresh-"));
    const globalRoot = join(dir, "sessions");
    const sessionId = resolveWorkspaceAvatarSessionId(dir, "tester");
    const sessionRoot = join(globalRoot, "2026", "03", "06", sessionId);
    await mkdir(sessionRoot, { recursive: true });
    await writeFile(
      join(sessionRoot, "session.json"),
      JSON.stringify(
        {
          session: {
            id: sessionId,
            name: "demo",
            cwd: dir,
            workspacePath: dir,
            avatar: "tester",
            status: "running",
            storageState: "active",
            storeTarget: "global",
            createdAt: "2026-03-06T00:00:00.000Z",
            updatedAt: "2026-03-06T00:00:00.000Z",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const catalog = new SessionCatalog({ globalRoot, archiveRoot: join(dir, "archive", "sessions") });
    catalog.refresh([]);
    const session = catalog.list()[0];
    expect(session?.id).toBe(sessionId);
    expect(session?.status).toBe("stopped");
  });

  test("Scenario: Given incompatible legacy session roots When catalog refreshes Then they are quarantined and no longer counted as workspace sessions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-session-catalog-legacy-"));
    const globalRoot = join(dir, "sessions");
    const archiveRoot = join(dir, "archive", "sessions");
    const workspaceRoot = join(dir, "workspace");
    const legacyGlobalRoot = join(globalRoot, "2026", "03", "06", "legacy-random-id");
    const legacyWorkspaceRoot = join(
      workspaceRoot,
      ".agenter",
      "avatar",
      "tester",
      "sessions",
      "2026",
      "03",
      "06",
      "workspace-legacy-id",
    );
    await mkdir(legacyGlobalRoot, { recursive: true });
    await mkdir(legacyWorkspaceRoot, { recursive: true });

    const legacyDoc = JSON.stringify(
      {
        session: {
          id: "legacy-random-id",
          name: "legacy",
          cwd: workspaceRoot,
          workspacePath: workspaceRoot,
          avatar: "tester",
          status: "stopped",
          storageState: "active",
          storeTarget: "global",
          createdAt: "2026-03-06T00:00:00.000Z",
          updatedAt: "2026-03-06T00:00:00.000Z",
        },
      },
      null,
      2,
    );
    await writeFile(join(legacyGlobalRoot, "session.json"), legacyDoc, "utf8");
    await writeFile(
      join(legacyWorkspaceRoot, "session.json"),
      JSON.stringify(
        {
          session: {
            id: "workspace-legacy-id",
            name: "workspace legacy",
            cwd: workspaceRoot,
            workspacePath: workspaceRoot,
            avatar: "tester",
            status: "stopped",
            storageState: "active",
            storeTarget: "workspace",
            createdAt: "2026-03-06T00:00:00.000Z",
            updatedAt: "2026-03-06T00:00:00.000Z",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const catalog = new SessionCatalog({ globalRoot, archiveRoot });
    catalog.refresh([workspaceRoot]);

    expect(catalog.list()).toEqual([]);
    expect(existsSync(legacyGlobalRoot)).toBeFalse();
    expect(existsSync(legacyWorkspaceRoot)).toBeFalse();

    const legacyBuckets = await readdir(join(dir, "archive", "sessions-legacy"));
    expect(legacyBuckets.length).toBeGreaterThan(0);
  });
});
