import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { SessionCatalog } from "../src/session-catalog";

describe("Feature: session catalog", () => {
  test("Scenario: Given create/update/delete actions When catalog mutates Then lifecycle state is managed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-session-catalog-"));
    const catalog = new SessionCatalog({ globalRoot: join(dir, "sessions") });

    const session = catalog.create({
      cwd: dir,
      name: "demo",
      avatar: "tester-bot",
      storeTarget: "global",
    });

    expect(catalog.list()).toHaveLength(1);
    expect(session.name).toBe("demo");
    expect(session.status).toBe("stopped");

    const updated = catalog.update(session.id, { status: "running" });
    expect(updated.status).toBe("running");

    const removed = catalog.remove(session.id);
    expect(removed).toBeTrue();
    expect(catalog.list()).toHaveLength(0);
  });

  test("Scenario: Given persisted running status When catalog refreshes Then status falls back to stopped", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-session-catalog-refresh-"));
    const globalRoot = join(dir, "sessions");
    const sessionRoot = join(globalRoot, "s-1");
    await mkdir(sessionRoot, { recursive: true });
    await writeFile(
      join(sessionRoot, "session.json"),
      JSON.stringify(
        {
          session: {
            id: "s-1",
            name: "demo",
            cwd: dir,
            avatar: "tester",
            status: "running",
            storeTarget: "global",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const catalog = new SessionCatalog({ globalRoot });
    catalog.refresh([]);
    const session = catalog.list()[0];
    expect(session?.id).toBe("s-1");
    expect(session?.status).toBe("stopped");
  });
});
