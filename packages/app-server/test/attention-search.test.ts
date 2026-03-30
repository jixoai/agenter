import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AttentionSystem } from "@agenter/attention-system";

import { AttentionSearchEngine } from "../src/attention-search";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0, roots.length).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    }),
  );
});

const createHarness = async () => {
  const root = await mkdtemp(join(tmpdir(), "agenter-attention-search-"));
  roots.push(root);
  const system = new AttentionSystem();
  system.createContext({ contextId: "ctx-chat-main", owner: "avatar:jane" });
  const engine = new AttentionSearchEngine(join(root, "attention-search.duckdb"));
  return { system, engine };
};

const appendCommit = (
  system: AttentionSystem,
  input: {
    summary: string;
    change: string;
    scores: Record<string, number>;
    author?: string;
    source?: string;
  },
) =>
  system.commit("ctx-chat-main", {
    meta: {
      author: input.author ?? "avatar:jane",
      source: input.source ?? "attention",
    },
    scores: input.scores,
    summary: input.summary,
    change: {
      type: "update",
      value: input.change,
      format: "text/plain",
    },
  }).commit;

describe("Feature: attention search query execution", () => {
  test("Scenario: Given active and resolved weather commits When plain text query runs Then only active matches return by default", async () => {
    const { system, engine } = await createHarness();
    appendCommit(system, {
      summary: "Weather report for Xiamen",
      change: "Sunny with wind",
      scores: { weather01: 100 },
      source: "message",
    });
    appendCommit(system, {
      summary: "Old weather archive",
      change: "Resolved archive result",
      scores: { archive01: 0 },
      source: "attention",
    });

    const items = await engine.query({
      attentionSystem: system,
      snapshot: system.snapshot(),
      request: { query: "weather" },
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.commit.summary).toContain("Weather report");
  });

  test("Scenario: Given a resolved phrase match When minscore is widened Then the quoted phrase can still be found", async () => {
    const { system, engine } = await createHarness();
    appendCommit(system, {
      summary: "Weather report for Xiamen",
      change: "Tomorrow outlook remains sunny",
      scores: { weather01: 100 },
    });
    appendCommit(system, {
      summary: "Archived forecast",
      change: "weather report future 15 day forecast",
      scores: { archive01: 0 },
      source: "terminal",
    });

    const items = await engine.query({
      attentionSystem: system,
      snapshot: system.snapshot(),
      request: { query: 'minscore:0 "future 15 day forecast"' },
    });

    expect(items.map((item) => item.commit.summary)).toEqual(["Archived forecast"]);
  });

  test("Scenario: Given score-linked commits When score and depth controls are queried Then graph traversal still works", async () => {
    const { system, engine } = await createHarness();
    const root = appendCommit(system, {
      summary: "Ask kzf about dinner",
      change: "Pending relay",
      scores: { relay01: 100, room01: 100 },
      source: "message",
    });
    appendCommit(system, {
      summary: "Follow-up dinner relay",
      change: "Need direct answer",
      scores: { room01: 100, reply01: 100 },
      source: "attention",
    });
    appendCommit(system, {
      summary: "Unrelated work",
      change: "Ignore me",
      scores: { other01: 100 },
      source: "attention",
    });

    const items = await engine.query({
      attentionSystem: system,
      snapshot: system.snapshot(),
      request: { query: "score:relay01 deep:2" },
    });

    expect(items.some((item) => item.commit.commitId === root.commitId)).toBe(true);
    expect(items.map((item) => item.commit.summary).sort()).toEqual([
      "Follow-up dinner relay",
      "Ask kzf about dinner",
    ].sort());
  });

  test("Scenario: Given a score hash has already been resolved When queried by score without explicit minscore Then history still returns by default", async () => {
    const { system, engine } = await createHarness();
    appendCommit(system, {
      summary: "厦门天气如何？未来天气走势如何？",
      change: "厦门天气如何？未来天气走势如何？",
      scores: { ba7902: 100 },
      source: "message",
      author: "User",
    });
    appendCommit(system, {
      summary: "Weather query completed",
      change: "",
      scores: { ba7902: 0 },
      source: "terminal",
      author: "agenter-ai",
    });

    const items = await engine.query({
      attentionSystem: system,
      snapshot: system.snapshot(),
      request: { query: "context:ctx-chat-main score:ba7902 deep:2" },
    });

    expect(items.map((item) => item.commit.scores)).toEqual([{ ba7902: 0 }, { ba7902: 100 }]);
    expect(items.map((item) => item.commit.summary)).toEqual([
      "Weather query completed",
      "厦门天气如何？未来天气走势如何？",
    ]);
  });
});
