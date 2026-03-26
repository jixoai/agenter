import { describe, expect, test } from "bun:test";

import { createRuntimeAttentionPreview } from "../src/attention-runtime-view";
import type { SessionRuntimeAttentionState } from "../src/session-runtime";

const createCommit = (index: number) => ({
  commitId: `commit-${index}`,
  contextId: "ctx-terminal-main",
  parentCommitIds: index > 0 ? [`commit-${index - 1}`] : [],
  meta: {
    author: "terminal:main",
    source: "terminal",
    createdAt: new Date(1_700_000_000_000 + index * 1_000).toISOString(),
  },
  scores: {
    abc123: index % 2 === 0 ? 100 : 0,
  },
  summary: `commit ${index}`,
  change: {
    type: "diff" as const,
    value: `diff-${index}-` + "x".repeat(512),
    format: "text/markdown",
  },
  createdAt: new Date(1_700_000_000_000 + index * 1_000).toISOString(),
});

describe("Feature: runtime attention preview projection", () => {
  test("Scenario: Given a large attention context When projecting the runtime preview Then commits are capped and diff payloads are truncated", () => {
    const commits = Array.from({ length: 240 }, (_, index) => createCommit(index + 1));
    const state: SessionRuntimeAttentionState = {
      snapshot: {
        contexts: [
          {
            contextId: "ctx-terminal-main",
            owner: "tester-bot",
            content: "terminal context\n" + "y".repeat(3_000),
            contentFormat: "text/markdown",
            scoreMap: { abc123: 100 },
            headCommitId: commits.at(-1)?.commitId ?? null,
            createdAt: commits[0]!.createdAt,
            updatedAt: commits.at(-1)?.createdAt ?? commits[0]!.createdAt,
            commits,
            commitCount: commits.length,
            commitsTruncated: false,
          },
        ],
      },
      active: [
        {
          contextId: "ctx-terminal-main",
          context: {
            contextId: "ctx-terminal-main",
            owner: "tester-bot",
            content: "terminal context\n" + "z".repeat(3_000),
            contentFormat: "text/markdown",
            scoreMap: { abc123: 100 },
            headCommitId: commits.at(-1)?.commitId ?? null,
            createdAt: commits[0]!.createdAt,
            updatedAt: commits.at(-1)?.createdAt ?? commits[0]!.createdAt,
          },
          recentCommits: commits.slice(-24),
        },
      ],
      cycleFrames: [
        {
          cycleId: 7,
          seq: 1,
          createdAt: Date.now(),
          wakeSource: "attention",
          inputContextIds: ["ctx-terminal-main"],
          activeContextIds: ["ctx-terminal-main"],
          producedCommitRefs: [{ contextId: "ctx-terminal-main", commitId: commits.at(-1)?.commitId ?? "commit-240" }],
          modelCallIds: [3],
          hookIds: ["hook-1"],
        },
      ],
      hooks: [
        {
          id: "hook-1",
          cycleId: 7,
          hookId: "message.reply",
          systemId: "message",
          contextId: "ctx-terminal-main",
          commitId: commits.at(-1)?.commitId ?? "commit-240",
          status: "delivered",
          createdAt: Date.now(),
          target: { chatId: "chat-main" },
          output: { ok: true },
        },
      ],
    };

    const preview = createRuntimeAttentionPreview(state);
    const context = preview.snapshot.contexts[0]!;

    expect(context.commitCount).toBe(240);
    expect(context.commitsTruncated).toBe(true);
    expect(context.commits).toHaveLength(200);
    expect(context.commits[0]?.commitId).toBe("commit-41");
    expect(context.commits.at(-1)?.commitId).toBe("commit-240");
    expect(context.content.length).toBeLessThan(state.snapshot.contexts[0]!.content.length);
    expect(
      context.commits.every((commit) =>
        commit.change.type === "clean" ? true : commit.change.value.includes("[truncated "),
      ),
    ).toBe(true);
    expect(preview.active[0]?.recentCommits).toHaveLength(12);
    expect(preview.cycleFrames[0]).not.toBe(state.cycleFrames[0]);
    expect(preview.hooks[0]).not.toBe(state.hooks[0]);
  });
});
