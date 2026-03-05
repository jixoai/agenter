import { describe, expect, test } from "bun:test";

import { TaskEngine } from "../src/task-engine";

describe("Feature: task engine dag + triggers", () => {
  test("Scenario: Given dependency chain When dependency done Then blocked task becomes ready", () => {
    const engine = new TaskEngine();
    engine.create({
      source: "workspace",
      id: "task-a",
      title: "A",
    });
    engine.create({
      source: "workspace",
      id: "task-b",
      title: "B",
      dependsOn: ["workspace:task-a"],
    });

    const before = engine.get("workspace", "task-b");
    expect(before?.status).toBe("pending");
    expect(before?.blockedBy).toEqual(["workspace:task-a"]);

    engine.done("workspace", "task-a");

    const after = engine.get("workspace", "task-b");
    expect(after?.status).toBe("ready");
    expect(after?.blockedBy).toEqual([]);
    expect(after?.progress).toBe(1);
  });

  test("Scenario: Given cycle dependency When add dependency Then engine rejects the update", () => {
    const engine = new TaskEngine();
    engine.create({
      source: "workspace",
      id: "task-a",
      title: "A",
    });
    engine.create({
      source: "workspace",
      id: "task-b",
      title: "B",
      dependsOn: ["workspace:task-a"],
    });

    expect(() => engine.addDependency("workspace", "task-a", "workspace:task-b")).toThrow("dependency cycle");
  });

  test("Scenario: Given event trigger task When event emitted Then backlog task is promoted to ready", () => {
    const engine = new TaskEngine();
    engine.create({
      source: "shared",
      id: "task-e",
      title: "watch event",
      triggers: [{ type: "event", topic: "deploy.done" }],
    });

    const before = engine.get("shared", "task-e");
    expect(before?.status).toBe("backlog");

    const result = engine.emitEvent({ topic: "deploy.done", source: "api" });
    expect(result.affected).toHaveLength(1);

    const after = engine.get("shared", "task-e");
    expect(after?.status).toBe("ready");
  });
});
