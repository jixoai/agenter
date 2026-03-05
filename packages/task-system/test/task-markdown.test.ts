import { describe, expect, test } from "bun:test";

import { pickProjectsFromMarkdown, serializeTaskMarkdown, toTaskCreateInputFromMarkdown } from "../src/task-markdown";
import type { Task } from "../src/task-types";

describe("Feature: task markdown io", () => {
  test("Scenario: Given markdown task file When parsed Then task input keeps project and dependencies", () => {
    const markdown = `---
id: "task-1"
title: "Ship feature"
projects:
  - "git:https://example.com/repo.git"
dependsOn:
  - "shared:prepare"
triggers:
  - type: "event"
    topic: "release.ready"
---
Implement release workflow.`;

    const input = toTaskCreateInputFromMarkdown("workspace", "feature/task-1.md", markdown);
    expect(input).toBeDefined();
    if (!input) {
      return;
    }
    expect(input.id).toBe("task-1");
    expect(input.projects).toEqual(["git:https://example.com/repo.git"]);
    expect(input.dependsOn).toEqual([{ source: "shared", id: "prepare" }]);
    expect(input.triggers).toEqual([{ type: "event", topic: "release.ready" }]);
  });

  test("Scenario: Given task object When serialized Then markdown contains frontmatter and body", () => {
    const task: Task = {
      id: "task-2",
      title: "Review",
      body: "Review implementation",
      status: "ready",
      type: "work",
      assignees: ["alice"],
      labels: ["backend"],
      projects: ["file:/repo"],
      dependsOn: [{ source: "workspace", id: "task-1" }],
      relationships: [],
      triggers: [{ type: "manual" }],
      source: { name: "workspace", file: "task-2.md" },
      meta: {
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
        version: 1,
      },
    };

    const markdown = serializeTaskMarkdown(task);
    expect(markdown).toContain("---");
    expect(markdown).toContain("title");
    expect(markdown).toContain("Review implementation");
  });

  test("Scenario: Given markdown with projects field When picking projects Then only project list is returned", () => {
    const markdown = `---
title: "x"
projects:
  - "git:https://example.com/repo.git"
  - "file:/repo"
---
body`;

    const projects = pickProjectsFromMarkdown(markdown);
    expect(projects).toEqual(["git:https://example.com/repo.git", "file:/repo"]);
  });
});
