import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test } from "bun:test";

import { InstanceRegistry } from "../src/instance-registry";

describe("Feature: instance registry persistence", () => {
  test("Scenario: Given create/update/delete actions When registry is reloaded Then lifecycle state is durable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agenter-instance-registry-"));
    const filePath = join(dir, "instances.json");

    const registry = new InstanceRegistry({ filePath });
    const instance = registry.create({ cwd: dir, name: "demo", autoStart: false });

    expect(registry.list()).toHaveLength(1);
    expect(instance.name).toBe("demo");
    expect(instance.status).toBe("stopped");

    const updated = registry.update(instance.id, { status: "running" });
    expect(updated.status).toBe("running");

    const reloaded = new InstanceRegistry({ filePath });
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.get(instance.id)?.status).toBe("running");

    const removed = reloaded.remove(instance.id);
    expect(removed).toBeTrue();
    expect(reloaded.list()).toHaveLength(0);
  });
});
