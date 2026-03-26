import { describe, expect, test } from "vitest";

import type { RuntimeAttentionState } from "@agenter/client-sdk";

import { buildAttentionContextSnapshot } from "../src/features/attention/attention-view-model";

const attention: RuntimeAttentionState = {
  snapshot: {
    contexts: [
      {
        contextId: "ctx-terminal-iflow",
        owner: "avatar:jane",
        content: "after",
        contentFormat: "text/plain",
        scoreMap: { a1b2c3: 100 },
        headCommitId: "commit-diff",
        createdAt: "2026-03-24T10:00:00.000Z",
        updatedAt: "2026-03-24T10:01:00.000Z",
        commits: [
          {
            commitId: "commit-snapshot",
            contextId: "ctx-terminal-iflow",
            parentCommitIds: [],
            meta: { author: "terminal:iflow", source: "terminal" },
            scores: { a1b2c3: 100 },
            summary: "Terminal iflow: ready",
            change: {
              type: "update",
              value: "full terminal snapshot",
              format: "text/plain",
            },
            createdAt: "2026-03-24T10:00:00.000Z",
          },
          {
            commitId: "commit-diff",
            contextId: "ctx-terminal-iflow",
            parentCommitIds: ["commit-snapshot"],
            meta: { author: "terminal:iflow", source: "terminal" },
            scores: { a1b2c3: 100 },
            summary: "Terminal iflow diff updated",
            change: {
              type: "diff",
              value: "@@ -1 +1 @@\n-ready\n+after",
              format: "text/x-diff",
            },
            createdAt: "2026-03-24T10:01:00.000Z",
          },
        ],
      },
    ],
  },
  active: [
    {
      contextId: "ctx-terminal-iflow",
      context: {
        contextId: "ctx-terminal-iflow",
        owner: "avatar:jane",
        content: "after",
        contentFormat: "text/plain",
        scoreMap: { a1b2c3: 100 },
        headCommitId: "commit-diff",
        createdAt: "2026-03-24T10:00:00.000Z",
        updatedAt: "2026-03-24T10:01:00.000Z",
      },
      recentCommits: [],
    },
  ],
  cycleFrames: [],
  hooks: [],
};

describe("Feature: attention context snapshot selection", () => {
  test("Scenario: Given a context head commit When building the context snapshot Then the view points at the current head instead of a legacy replace item heuristic", () => {
    const snapshot = buildAttentionContextSnapshot(attention, "ctx-terminal-iflow");

    expect(snapshot).not.toBeNull();
    expect(snapshot?.headCommit?.commitId).toBe("commit-diff");
    expect(snapshot?.headCommit?.change.type).toBe("diff");
    if (snapshot?.headCommit?.change.type === "clean") {
      throw new Error("expected diff change");
    }
    expect(snapshot?.headCommit?.change.value).toContain("+after");
  });
});
