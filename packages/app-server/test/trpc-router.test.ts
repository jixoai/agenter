import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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
  test("Scenario: Given caller creates instance When listing and deleting Then lifecycle is reflected", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({ registryPath: join(root, "instances.json") });
    await kernel.start();
    const caller = appRouter.createCaller(createTrpcContext(kernel));

    const created = await caller.session.create({
      cwd: root,
      name: "workspace",
      autoStart: false,
    });

    expect(created.instance.name).toBe("workspace");

    const listed = await caller.session.list();
    expect(listed.instances).toHaveLength(1);

    const deleted = await caller.session.delete({ instanceId: created.instance.id });
    expect(deleted.removed).toBe(true);

    const afterDelete = await caller.session.list();
    expect(afterDelete.instances).toHaveLength(0);

    await kernel.stop();
  });
});
