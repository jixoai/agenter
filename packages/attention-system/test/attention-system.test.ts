import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AttentionControlPlane, AttentionSystem } from "../src";

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
    expect(restored.getContext("ctx-1")?.getState().template).toBe('<Slot name="default"/>');
    expect(restored.getContext("ctx-1")?.getState().slots).toEqual({ default: "hello" });
  });

  test("Scenario: Given an offline durable writer When external ingress commits with preserve Then cold-start recovery sees unresolved work without rewriting Avatar summary", async () => {
    const root = mkdtempSync(join(tmpdir(), "attn-control-plane-"));
    const plane = new AttentionControlPlane({ root });

    await plane.commit({
      context: {
        contextId: "ctx-room-1",
        owner: "avatar:jane",
        content: "Avatar summary: waiting for room follow-up",
        contentFormat: "text/plain",
      },
      commit: {
        meta: { author: "avatar:jane", source: "attention" },
        scores: {},
        summary: "seed summary",
        change: { type: "update", value: "Avatar summary: waiting for room follow-up", format: "text/plain" },
      },
    });

    const persisted = await plane.commit({
      context: {
        contextId: "ctx-room-1",
        owner: "avatar:jane",
      },
      commit: {
        contextMutation: "preserve",
        meta: {
          author: "avatar:jane",
          source: "message",
          src: "msg:room-1/42",
          tags: ["message", "follow_up_reminder"],
        },
        scores: { "msg:room-1/42": 100 },
        summary: "Re-evaluate room follow-up: room-1/42",
        change: {
          type: "update",
          value: "follow-up reminder detail",
          format: "text/plain",
        },
      },
    });

    expect(persisted.context.content).toBe("Avatar summary: waiting for room follow-up");
    expect(persisted.context.focusState).toBe("focused");
    expect(persisted.context.scoreMap).toEqual({ "msg:room-1/42": 100 });

    const restored = AttentionSystem.fromSnapshot(await plane.loadSnapshot());
    const restoredContext = restored.getContext("ctx-room-1")?.getState();
    const active = restored.listActiveContexts();

    expect(restoredContext?.content).toBe("Avatar summary: waiting for room follow-up");
    expect(restoredContext?.scoreMap).toEqual({ "msg:room-1/42": 100 });
    expect(
      restored
        .query({ contextId: "ctx-room-1", minScore: 0 })
        .some((entry) => entry.commit.meta.src === "msg:room-1/42" && entry.commit.contextMutation === "preserve"),
    ).toBeTrue();
    expect(active.map((item) => item.contextId)).toEqual(["ctx-room-1"]);
  });

  test("Scenario: Given a background context created by the control plane When external ingress omits ingressType Then the durable commit follows the same push law as runtime", async () => {
    const root = mkdtempSync(join(tmpdir(), "attn-control-plane-background-"));
    const plane = new AttentionControlPlane({ root });

    const result = await plane.commit({
      context: {
        contextId: "ctx-room-background",
        owner: "avatar:jane",
        focusState: "background",
      },
      commit: {
        meta: {
          author: "avatar:jane",
          source: "message",
          src: "msg:room-background/7",
          tags: ["message", "follow_up_reminder"],
        },
        scores: { "msg:room-background/7": 100 },
        summary: "Background reminder",
        change: {
          type: "update",
          value: "background detail",
          format: "text/plain",
        },
      },
    });

    const restored = AttentionSystem.fromSnapshot(await plane.loadSnapshot());
    const restoredContext = restored.getContext("ctx-room-background")?.getState();
    const restoredCommit = restored.query({ contextId: "ctx-room-background", minScore: 0 })[0]?.commit;

    expect(result.context.focusState).toBe("background");
    expect(result.commit.ingressType).toBe("push");
    expect(restoredContext?.focusState).toBe("background");
    expect(restoredCommit?.ingressType).toBe("push");
    expect(restored.listPushCommits("ctx-room-background").map((commit) => commit.commitId)).toEqual([
      restoredCommit?.commitId,
    ]);
  });

  test("Scenario: Given a focused context created by the control plane When external ingress omits ingressType Then the durable commit follows the same commit law as runtime", async () => {
    const root = mkdtempSync(join(tmpdir(), "attn-control-plane-focused-"));
    const plane = new AttentionControlPlane({ root });

    const result = await plane.commit({
      context: {
        contextId: "ctx-room-focused",
        owner: "avatar:jane",
        focusState: "focused",
      },
      commit: {
        meta: {
          author: "avatar:jane",
          source: "message",
          src: "msg:room-focused/11",
          tags: ["message", "follow_up_reminder"],
        },
        scores: { "msg:room-focused/11": 100 },
        summary: "Focused reminder",
        change: {
          type: "update",
          value: "focused detail",
          format: "text/plain",
        },
      },
    });

    const restored = AttentionSystem.fromSnapshot(await plane.loadSnapshot());
    const restoredContext = restored.getContext("ctx-room-focused")?.getState();
    const restoredCommit = restored.query({ contextId: "ctx-room-focused", minScore: 0 })[0]?.commit;

    expect(result.context.focusState).toBe("focused");
    expect(result.commit.ingressType).toBe("commit");
    expect(restoredContext?.focusState).toBe("focused");
    expect(restoredCommit?.ingressType).toBe("commit");
    expect(restored.listPushCommits("ctx-room-focused")).toEqual([]);
  });
});
