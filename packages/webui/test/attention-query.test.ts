import { describe, expect, test } from "vitest";

import type { RuntimeAttentionState } from "@agenter/client-sdk";

import { AttentionSystem } from "../../attention-system/src";
import { parseAttentionQuery, queryAttentionLocally } from "../src/features/attention/attention-query";

const createAttention = (): RuntimeAttentionState => {
  const system = new AttentionSystem();
  system.createContext({ contextId: "ctx-chat-main", owner: "avatar:jane" });
  system.commit("ctx-chat-main", {
    meta: {
      author: "avatar:jane",
      source: "message",
    },
    scores: {
      relay01: 100,
      room01: 100,
    },
    summary: "Ask kzf about dinner",
    change: {
      type: "update",
      value: "Pending relay",
      format: "text/plain",
    },
  });
  system.commit("ctx-chat-main", {
    meta: {
      author: "avatar:jane",
      source: "attention",
    },
    scores: {
      room01: 100,
      reply01: 100,
    },
    summary: "Follow-up dinner relay",
    change: {
      type: "update",
      value: "Need direct answer",
      format: "text/plain",
    },
  });

  return {
    snapshot: system.snapshot(),
    active: [],
    cycleFrames: [],
    hooks: [],
  };
};

describe("Feature: local attention query evaluation", () => {
  test("Scenario: Given score graph controls When local query fallback runs Then related commits are not re-filtered by control clauses", () => {
    const items = queryAttentionLocally(createAttention(), parseAttentionQuery("score:relay01 deep:2"));

    expect(items.map((item) => item.commit.summary).sort()).toEqual([
      "Ask kzf about dinner",
      "Follow-up dinner relay",
    ].sort());
  });

  test("Scenario: Given control clauses plus grouped residual text When local query fallback runs Then controls scope the base set and residual text still filters correctly", () => {
    const items = queryAttentionLocally(
      createAttention(),
      parseAttentionQuery('context:ctx-chat-main AND ("direct answer" OR relay)'),
    );

    expect(items.map((item) => item.commit.summary).sort()).toEqual([
      "Ask kzf about dinner",
      "Follow-up dinner relay",
    ].sort());
  });

  test("Scenario: Given a score hash has been resolved When local score query omits minscore Then historical commits still appear", () => {
    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-chat-main", owner: "avatar:jane" });
    system.commit("ctx-chat-main", {
      meta: {
        author: "User",
        source: "message",
      },
      scores: {
        ba7902: 100,
      },
      summary: "厦门天气如何？未来天气走势如何？",
      change: {
        type: "update",
        value: "厦门天气如何？未来天气走势如何？",
        format: "text/plain",
      },
    });
    system.commit("ctx-chat-main", {
      meta: {
        author: "agenter-ai",
        source: "terminal",
      },
      scores: {
        ba7902: 0,
      },
      summary: "Weather query completed",
      change: {
        type: "clean",
      },
    });

    const items = queryAttentionLocally(
      {
        snapshot: system.snapshot(),
        active: [],
        cycleFrames: [],
        hooks: [],
      },
      parseAttentionQuery("context:ctx-chat-main score:ba7902 deep:2"),
    );

    expect(items.map((item) => item.commit.summary).sort()).toEqual([
      "厦门天气如何？未来天气走势如何？",
      "Weather query completed",
    ].sort());
  });
});
