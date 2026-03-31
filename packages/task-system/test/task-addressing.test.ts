import { describe, expect, test } from "bun:test";

import { resolveTaskSources } from "../src/task-addressing";

describe("Feature: task source addressing", () => {
  test("Scenario: Given no custom sources When resolving Then task-system stays dormant until sources are configured", () => {
    const sources = resolveTaskSources({
      homeDir: "/home/dev",
      projectRoot: "/work/project-a",
    });

    expect(sources).toEqual([]);
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
