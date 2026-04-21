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
    expect(commit.target).toBe("default");
    expect(commit.parentCommitIds).toEqual([]);
    expect(commit.scores).toEqual({ hash1: 100, hash2: 40 });
    expect(commit.change.type).toBe("update");
    expect(snapshot.template).toBe('<Slot name="default"/>');
    expect(snapshot.slots).toEqual({ default: "帮我问一下中午吃什么" });
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
    expect(snapshot.slots).toEqual({ default: "hi\nworld" });
  });

  test("Scenario: Given a clean commit When committed Then context content is cleared", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane", content: "hello" });

    const { context: snapshot } = context.commit({
      summary: "clean",
      scores: { hash1: 0 },
      change: { type: "clean" },
    });

    expect(snapshot.content).toBe("");
    expect(snapshot.slots).toEqual({ default: "" });
  });

  test("Scenario: Given a custom slot template When a targeted commit lands Then only the targeted slot changes", () => {
    const context = new AttentionContext({
      contextId: "ctx-1",
      owner: "avatar:jane",
      template: '<Slot name="skills-list" readonly/>\n<Slot name="default"/>',
      slots: {
        "skills-list": "## skills.list\n- agenter-runtime",
        default: "notes",
      },
    });

    const { context: snapshot } = context.commit({
      target: "default",
      summary: "update notes",
      scores: { hash1: 1 },
      change: { type: "update", value: "updated notes" },
    });

    expect(snapshot.content).toBe("## skills.list\n- agenter-runtime\nupdated notes");
    expect(snapshot.slots).toEqual({
      "skills-list": "## skills.list\n- agenter-runtime",
      default: "updated notes",
    });
  });

  test("Scenario: Given an unknown slot target When committed Then the commit is rejected", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane" });

    expect(() =>
      context.commit({
        target: "skills-list",
        summary: "bad target",
        scores: { hash1: 1 },
        change: { type: "update", value: "value" },
      }),
    ).toThrow('attention slot "skills-list" not found');
  });

  test("Scenario: Given a readonly slot When an ordinary commit targets it Then the commit is rejected", () => {
    const context = new AttentionContext({
      contextId: "ctx-1",
      owner: "avatar:jane",
      template: '<Slot name="skills-list" readonly/>\n<Slot name="default"/>',
      slots: {
        "skills-list": "## skills.list\n- agenter-runtime",
        default: "",
      },
    });

    expect(() =>
      context.commit({
        target: "skills-list",
        summary: "bad readonly write",
        scores: { hash1: 1 },
        change: { type: "update", value: "new list" },
      }),
    ).toThrow('attention slot "skills-list" is readonly');
  });

  test("Scenario: Given a readonly slot When the runtime uses commitSystem Then the slot is updated", () => {
    const context = new AttentionContext({
      contextId: "ctx-1",
      owner: "avatar:jane",
      template: '<Slot name="skills-list" readonly/>\n<Slot name="default"/>',
      slots: {
        "skills-list": "## skills.list\n- agenter-runtime",
        default: "",
      },
    });

    const { commit, context: snapshot } = context.commitSystem({
      target: "skills-list",
      summary: "refresh skills",
      scores: {},
      change: { type: "update", value: "## skills.list\n- agenter-runtime\n- agenter-message" },
    });

    expect(commit.target).toBe("skills-list");
    expect(snapshot.slots?.["skills-list"]).toBe("## skills.list\n- agenter-runtime\n- agenter-message");
    expect(snapshot.content).toContain("- agenter-message");
  });

  test("Scenario: Given a background push When focus changes and pushes are consumed Then background debt stays active until the push is explicitly consumed", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane", focusState: "background" });

    const push = context.commit({
      ingressType: "push",
      summary: "background ping",
      scores: { hash1: 100 },
      change: { type: "update", value: "background ping" },
    }).commit;

    expect(context.isActive()).toBeTrue();
    expect(context.pendingPushCount()).toBe(1);

    context.setFocusState("focused");
    expect(context.isActive()).toBeTrue();

    const consumed = context.consumePushes([push.commitId]);
    expect(consumed.map((item) => item.commitId)).toEqual([push.commitId]);
    expect(context.isActive()).toBeFalse();
    expect(context.getState().consumedPushCommitIds).toEqual([push.commitId]);
  });

  test("Scenario: Given a muted push with notification semantics When committed Then it remains active until consumed", () => {
    const context = new AttentionContext({ contextId: "ctx-1", owner: "avatar:jane", focusState: "muted" });

    const push = context.commit({
      ingressType: "push",
      meta: { tags: ["notification"] },
      summary: "urgent ping",
      scores: { hash1: 100 },
      change: { type: "update", value: "urgent ping" },
    }).commit;

    expect(context.isActive()).toBeTrue();
    expect(context.pendingPushCount()).toBe(1);

    context.consumePushes([push.commitId]);
    expect(context.isActive()).toBeFalse();
  });
});
