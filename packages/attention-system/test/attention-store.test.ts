import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AttentionStore } from "../src/attention-store";

describe("Feature: attention store persistence", () => {
  test("Scenario: Given a V1 snapshot When loaded Then it migrates into context commits", async () => {
    const root = mkdtempSync(join(tmpdir(), "attn-store-v1-"));
    await writeFile(
      join(root, "state.json"),
      JSON.stringify({
        nextId: 2,
        records: [
          {
            id: 1,
            content: "hello",
            from: "user",
            score: 100,
            remark: "legacy remark",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );

    const snapshot = await new AttentionStore(root).load();
    expect(snapshot.contexts).toHaveLength(1);
    expect(snapshot.contexts[0]?.commits[0]?.meta.author).toBe("user");
    expect(snapshot.contexts[0]?.commits[0]?.change.type).toBe("update");
    expect(snapshot.contexts[0]?.commits[0]?.change.type === "update" ? snapshot.contexts[0]?.commits[0]?.change.value : null).toBe(
      "legacy remark",
    );
  });

  test("Scenario: Given a V2 snapshot When loaded Then it migrates into commit summaries and changes", async () => {
    const root = mkdtempSync(join(tmpdir(), "attn-store-v2-"));
    await writeFile(
      join(root, "state.json"),
      JSON.stringify({
        version: 2,
        contexts: [
          {
            id: "ctx-1",
            owner: "jane",
            items: [
              {
                id: "item-1",
                contextId: "ctx-1",
                meta: { from: "kzf", time: 1, source: "message", src: "msg:chat-kzf/1" },
                scores: { hash1: 80 },
                title: "hello",
                context: "legacy detail",
                createdAt: "2026-03-01T00:00:00.000Z",
              },
            ],
          },
        ],
      }),
      "utf8",
    );

    const snapshot = await new AttentionStore(root).load();
    expect(snapshot.contexts[0]?.commits[0]?.meta.source).toBe("message");
    expect(snapshot.contexts[0]?.commits[0]?.summary).toBe("hello");
    expect(snapshot.contexts[0]?.commits[0]?.change.type === "update" ? snapshot.contexts[0]?.commits[0]?.change.value : null).toBe(
      "legacy detail",
    );
  });

  test("Scenario: Given a V4 snapshot When saved and reloaded Then parent commit ids survive without legacy bridge residue", async () => {
    const root = mkdtempSync(join(tmpdir(), "attn-store-v4-"));
    const store = new AttentionStore(root);
    await store.save({
      contexts: [
        {
          contextId: "ctx-1",
          owner: "jane",
          focusState: "background",
          content: "fried rice",
          scoreMap: { hash1: 0 },
          consumedPushCommitIds: ["commit-1"],
          headCommitId: "commit-1",
          createdAt: "2026-03-23T00:00:00.000Z",
          updatedAt: "2026-03-23T00:00:00.000Z",
          commits: [
            {
              commitId: "commit-1",
              contextId: "ctx-1",
              ingressType: "push",
              parentCommitIds: ["root-1"],
              meta: {
                author: "avatar:jane",
                source: "attention",
              },
              scores: { hash1: 0 },
              summary: "reply",
              change: { type: "update", value: "fried rice" },
              createdAt: "2026-03-23T00:00:00.000Z",
            },
          ],
        },
      ],
    });

    const reloaded = await store.load();
    expect(reloaded.contexts[0]?.commits[0]?.parentCommitIds).toEqual(["root-1"]);
    expect(Object.prototype.hasOwnProperty.call(reloaded.contexts[0]?.commits[0] ?? {}, "egress")).toBeFalse();
    expect(reloaded.contexts[0]?.focusState).toBe("background");
    expect(reloaded.contexts[0]?.template).toBe('<Slot name="default"/>');
    expect(reloaded.contexts[0]?.slots).toEqual({ default: "fried rice" });
    expect(reloaded.contexts[0]?.consumedPushCommitIds).toEqual(["commit-1"]);
    expect(reloaded.contexts[0]?.commits[0]?.ingressType).toBe("push");
  });
});
