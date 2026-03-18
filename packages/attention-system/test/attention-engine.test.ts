import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AttentionEngine, AttentionStore } from "../src";

describe("Feature: attention-system attention records", () => {
  test("Scenario: Given user chats When attention_reply updates relationships Then attention_list is gradually cleared by score", () => {
    const engine = new AttentionEngine();

    const item1 = engine.add({ content: "请帮我创建一个小游戏", from: "user" });
    const item2 = engine.add({ content: "希望是单页网页", from: "user" });

    expect(engine.list().map((item) => item.id)).toEqual([item1.id, item2.id]);

    const firstReply = engine.reply({
      replyContent: "我先确认游戏类型。",
      from: "assistant",
      score: 0,
      relationships: [{ id: item1.id, score: 60, remark: "待确认游戏类型" }],
    });

    expect(firstReply.reply.score).toBe(0);
    expect(engine.list().map((item) => ({ id: item.id, score: item.score }))).toEqual([
      { id: item1.id, score: 60 },
      { id: item2.id, score: 100 },
    ]);

    engine.reply({
      replyContent: "我已完成，进入下一步。",
      from: "assistant",
      score: 0,
      relationships: [
        { id: item1.id, score: 0, remark: "已处理" },
        { id: item2.id, score: 0, remark: "已处理" },
      ],
    });

    expect(engine.list()).toHaveLength(0);
    const queried = engine.query({ query: "已处理", includeInactive: true });
    expect(queried.some((item) => item.id === item1.id)).toBeTrue();
    expect(queried.some((item) => item.id === item2.id)).toBeTrue();
  });

  test("Scenario: Given stored snapshot When reloaded Then records and ids are preserved", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-attention-system-"));
    const store = new AttentionStore(root);

    const engine = new AttentionEngine();
    const first = engine.add({ content: "hello", from: "user", score: 80 });
    engine.remark({ id: first.id, remark: "kept" });

    await store.save(engine.snapshot());

    const restored = new AttentionEngine(await store.load());
    const active = restored.list();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(first.id);
    expect(active[0].remark).toBe("kept");

    const second = restored.add({ content: "world", from: "user" });
    expect(second.id).toBeGreaterThan(first.id);
  });
});
