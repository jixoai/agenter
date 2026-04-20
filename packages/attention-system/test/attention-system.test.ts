import { describe, expect, test } from "bun:test";

import { AttentionSystem } from "../src/attention-system";

describe("Feature: attention system context scheduling", () => {
  test("Scenario: Given two contexts When querying by hash Then cross-context matches are returned", () => {
    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "avatar:jane" });
    system.createContext({ contextId: "ctx-2", owner: "avatar:jane" });

    system.commit("ctx-1", {
      meta: { author: "user:kzf", source: "message", src: "msg:chat-kzf/1" },
      scores: { hash1: 100 },
      summary: "kzf asks",
      change: { type: "update", value: "gaubee 在吗？" },
    });
    system.commit("ctx-2", {
      meta: { author: "user:gaubee", source: "message", src: "msg:chat-gaubee/1" },
      scores: { hash1: 20, hash2: 100 },
      summary: "gaubee replies",
      change: { type: "update", value: "中午吃蛋炒饭" },
    });

    const related = system.query({ hash: "hash1", depth: 3 });
    expect(related).toHaveLength(2);
    expect(related.map((entry) => entry.contextId).sort()).toEqual(["ctx-1", "ctx-2"]);
  });

  test("Scenario: Given text and source filters When query runs Then only matching commits remain", () => {
    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "avatar:jane" });

    system.commit("ctx-1", {
      meta: { author: "user:kzf", source: "message" },
      scores: { hash1: 100 },
      summary: "ask gaubee",
      change: { type: "update", value: "ask gaubee" },
    });
    system.commit("ctx-1", {
      meta: { author: "avatar:jane", source: "attention" },
      scores: { hash1: 0 },
      summary: "relay finished",
      change: { type: "update", value: "gaubee says fried rice" },
    });

    const matches = system.query({ source: "attention", text: "fried", minScore: 0 });
    expect(matches).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(matches[0]?.commit ?? {}, "egress")).toBeFalse();
  });

  test("Scenario: Given subscriptions When a commit lands Then listeners receive the commit", () => {
    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "avatar:jane" });

    const received: string[] = [];
    const unsubscribe = system.onCommit((contextId, _context, commit) => {
      if (contextId === "ctx-1" && commit.meta.source === "attention") {
        received.push(commit.summary);
      }
    });

    system.commit("ctx-1", {
      meta: { author: "avatar:jane", source: "attention" },
      scores: { hash1: 0 },
      summary: "reply ready",
      change: { type: "update", value: "reply" },
    });
    unsubscribe();
    system.commit("ctx-1", {
      meta: { author: "avatar:jane", source: "attention" },
      scores: { hash2: 0 },
      summary: "ignored after unsubscribe",
      change: { type: "update", value: "reply 2" },
    });

    expect(received).toEqual(["reply ready"]);
  });

  test("Scenario: Given unresolved scores When listing active contexts Then only unresolved contexts remain", () => {
    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "avatar:jane" });
    system.createContext({ contextId: "ctx-2", owner: "avatar:jane" });

    system.commit("ctx-1", {
      scores: { hash1: 0 },
      summary: "resolved",
      change: { type: "update", value: "resolved" },
    });
    system.commit("ctx-2", {
      scores: { hash2: 100 },
      summary: "pending",
      change: { type: "update", value: "pending" },
    });

    const active = system.listActiveContexts();
    expect(active).toHaveLength(1);
    expect(active[0]?.contextId).toBe("ctx-2");
    expect(active[0]?.recentCommits[0]?.summary).toBe("pending");
  });

  test("Scenario: Given a background push When the system consumes it Then background debt remains active until the notification is cleared", () => {
    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "avatar:jane", focusState: "background" });

    const push = system.commit("ctx-1", {
      ingressType: "push",
      scores: { hash1: 100 },
      summary: "ping",
      change: { type: "update", value: "ping" },
    }).commit;

    expect(system.listActiveContexts()).toHaveLength(1);
    expect(system.listPushCommits("ctx-1").map((item) => item.commitId)).toEqual([push.commitId]);

    system.setContextFocusState("ctx-1", "focused");
    expect(system.listActiveContexts()).toHaveLength(1);

    system.consumePushes("ctx-1", [push.commitId]);
    expect(system.listActiveContexts()).toHaveLength(0);
    expect(system.listPushCommits("ctx-1")).toEqual([]);
  });

  test("Scenario: Given a muted notification push When listing active contexts Then the notification still wakes the system until consumed", () => {
    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "avatar:jane", focusState: "muted" });

    const push = system.commit("ctx-1", {
      ingressType: "push",
      meta: { tags: ["notification"] },
      scores: { hash1: 100 },
      summary: "urgent ping",
      change: { type: "update", value: "urgent ping" },
    }).commit;

    expect(system.listActiveContexts().map((item) => item.contextId)).toEqual(["ctx-1"]);
    expect(system.listPushCommits("ctx-1").map((item) => item.commitId)).toEqual([push.commitId]);

    system.consumePushes("ctx-1", [push.commitId]);
    expect(system.listActiveContexts()).toHaveLength(0);
  });

  test("Scenario: Given a snapshot round-trip When restored Then contexts and commits remain queryable", () => {
    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "avatar:jane" });
    const commit = system.commit("ctx-1", {
      meta: { author: "user:kzf", source: "message" },
      scores: { hash1: 100 },
      summary: "hello",
      change: { type: "update", value: "hello" },
    }).commit;

    const restored = AttentionSystem.fromSnapshot(system.snapshot());
    const restoredState = restored.getContext("ctx-1")!.getState();
    expect(restored.listContexts()).toEqual([
      {
        contextId: "ctx-1",
        owner: "avatar:jane",
        headCommitId: commit.commitId,
        unresolvedScoreCount: 1,
        updatedAt: restoredState.updatedAt,
      },
    ]);
    expect(restored.query({ hash: "hash1" })[0]?.commit.commitId).toBe(commit.commitId);
    expect(restored.getContext("ctx-1")?.getState().focusState).toBe("focused");
  });
});
