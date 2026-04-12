import { describe, expect, test } from "bun:test";

import { AttentionContext } from "../src/attention-context";

describe("Feature: attention context commit log", () => {
  test("Scenario: Given a first commit When committed Then summary change and scores are preserved", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane" });

    const { commit, context: snapshot } = context.commit({
      meta: { author: "user:kzf", source: "message" },
      scores: { hash1: 100, hash2: 40 },
      summary: "gaubee在吗？",
      change: { type: "update", value: "帮我问一下中午吃什么", format: "text/plain" },
    });

    expect(commit.contextId).toBe("ctx-1");
    expect(commit.ingressType).toBe("commit");
    expect(commit.parentCommitIds).toEqual([]);
    expect(commit.scores).toEqual({ hash1: 100, hash2: 40 });
    expect(commit.change.type).toBe("update");
    expect(snapshot.content).toBe("帮我问一下中午吃什么");
    expect(snapshot.focusState).toBe("focused");
    expect(snapshot.consumedPushCommitIds).toEqual([]);
  });

  test("Scenario: Given a second commit When parent ids are omitted Then head commit becomes the parent", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane" });
    const root = context.commit({
      meta: { author: "user:kzf", source: "message" },
      scores: { hash1: 100 },
      summary: "root",
      change: { type: "update", value: "root" },
    }).commit;

    const followup = context.commit({
      meta: { author: "avatar:jane", source: "attention" },
      scores: { hash1: 50, hash2: 100 },
      summary: "followup",
      change: { type: "update", value: "followup" },
    }).commit;

    expect(followup.parentCommitIds).toEqual([root.commitId]);
  });

  test("Scenario: Given linked hashes When related commits are queried Then transitive matches are returned", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane" });
    context.commit({ summary: "A", scores: { hash1: 100 }, change: { type: "update", value: "A" } });
    context.commit({ summary: "B", scores: { hash1: 50, hash2: 80 }, change: { type: "update", value: "B" } });
    context.commit({ summary: "C", scores: { hash2: 100 }, change: { type: "update", value: "C" } });

    const related = context.queryCommits({ hash: "hash1", depth: 3, minScore: 1 });
    expect(related.map((entry) => entry.commit.summary)).toEqual(["C", "B", "A"]);
  });

  test("Scenario: Given a later commit clears a hash When queried with default minScore Then resolved history is hidden", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane" });
    context.commit({
      meta: { author: "user:kzf", source: "message" },
      scores: { hash1: 100 },
      summary: "user asks",
      change: { type: "update", value: "question" },
    });
    context.commit({
      meta: { author: "avatar:jane", source: "attention" },
      scores: { hash1: 0 },
      summary: "resolved",
      change: { type: "update", value: "answer" },
    });

    expect(context.queryCommits({ hash: "hash1" })).toHaveLength(0);
    expect(context.queryCommits({ hash: "hash1", minScore: 0 }).map((entry) => entry.commit.summary)).toEqual([
      "resolved",
      "user asks",
    ]);
  });

  test("Scenario: Given a diff commit When committed Then context content is patched", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane", content: "hello\nworld" });

    const { context: snapshot } = context.commit({
      summary: "patch hello",
      scores: { hash1: 1 },
      change: {
        type: "diff",
        value: "@@ -1,2 +1,2 @@\n-hello\n+hi\n world",
        format: "text/plain",
      },
    });

    expect(snapshot.content).toBe("hi\nworld");
  });

  test("Scenario: Given a clean commit When committed Then context content is cleared", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane", content: "hello" });

    const { context: snapshot } = context.commit({
      summary: "clean",
      scores: { hash1: 0 },
      change: { type: "clean" },
    });

    expect(snapshot.content).toBe("");
  });

  test("Scenario: Given a background push When focus changes and pushes are consumed Then active debt follows focus truth", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane", focusState: "background" });

    const push = context.commit({
      ingressType: "push",
      summary: "background ping",
      scores: { hash1: 100 },
      change: { type: "update", value: "background ping" },
    }).commit;

    expect(context.isActive()).toBeFalse();
    expect(context.pendingPushCount()).toBe(1);

    context.setFocusState("focused");
    expect(context.isActive()).toBeTrue();

    const consumed = context.consumePushes([push.commitId]);
    expect(consumed.map((item) => item.commitId)).toEqual([push.commitId]);
    expect(context.isActive()).toBeFalse();
    expect(context.getState().consumedPushCommitIds).toEqual([push.commitId]);
  });
});
