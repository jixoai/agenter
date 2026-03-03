import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel } from "../src/app-kernel";

const tempDirs: string[] = [];

const createKernel = (): AppKernel => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
  tempDirs.push(dir);
  return new AppKernel({
    registryPath: join(dir, "instances.json"),
  });
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: app kernel event replay", () => {
  test("Scenario: Given emitted events When reading getEventsAfter Then return ordered backlog", () => {
    const kernel = createKernel();
    const first = kernel.createInstance({ cwd: process.cwd(), name: "alpha", autoStart: false });
    const second = kernel.createInstance({ cwd: process.cwd(), name: "beta", autoStart: false });

    const full = kernel.getEventsAfter(0);
    expect(full.length).toBe(2);
    expect(full[0]?.eventId).toBe(1);
    expect(full[1]?.eventId).toBe(2);
    expect((full[0]?.payload as { instance: { id: string } }).instance.id).toBe(first.id);
    expect((full[1]?.payload as { instance: { id: string } }).instance.id).toBe(second.id);

    const incremental = kernel.getEventsAfter(1);
    expect(incremental.length).toBe(1);
    expect(incremental[0]?.eventId).toBe(2);
  });

  test("Scenario: Given event volume exceeds cap When reading backlog Then only latest window is kept", () => {
    const kernel = createKernel();
    for (let index = 0; index < 2050; index += 1) {
      kernel.createInstance({
        cwd: process.cwd(),
        name: `instance-${index}`,
        autoStart: false,
      });
    }

    const events = kernel.getEventsAfter(0);
    expect(events.length).toBe(2048);
    expect(events[0]?.eventId).toBe(3);
    expect(events[events.length - 1]?.eventId).toBe(2050);
  });
});
