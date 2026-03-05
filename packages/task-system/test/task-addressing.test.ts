import { describe, expect, test } from "bun:test";

import { resolveTaskSources } from "../src/task-addressing";

describe("Feature: task source addressing", () => {
  test("Scenario: Given no custom sources When resolving Then defaults are user + workspace paths", () => {
    const sources = resolveTaskSources({
      homeDir: "/home/dev",
      projectRoot: "/work/project-a",
    });

    expect(sources).toEqual([
      { name: "user", path: "/home/dev/.agenter/tasks" },
      { name: "workspace", path: "/work/project-a/.agenter/tasks" },
    ]);
  });

  test("Scenario: Given custom sources When resolving Then order is preserved and relative paths are normalized", () => {
    const sources = resolveTaskSources({
      homeDir: "/home/dev",
      projectRoot: "/work/project-a",
      sources: [
        { name: "shared", path: "~/team/tasks" },
        { name: "local", path: "./tmp/tasks" },
      ],
    });

    expect(sources).toEqual([
      { name: "shared", path: "/home/dev/team/tasks" },
      { name: "local", path: "/work/project-a/tmp/tasks" },
    ]);
  });
});
