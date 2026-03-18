import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionDb } from "../src/session-db";

const tempDirs: string[] = [];

const createDb = () => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-session-db-"));
  tempDirs.push(dir);
  return new SessionDb(join(dir, "session.db"));
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Feature: session-system ledger persistence", () => {
  test("Scenario: Given cycles and a moved head When reading the current branch Then the branch follows head pointers", () => {
    const db = createDb();
    try {
      const root = db.appendCycle({ result: { step: "root" } });
      const branchA = db.appendCycle({ prevCycleId: root.id, result: { step: "branch-a" } });
      const branchB = db.appendCycle({ prevCycleId: root.id, result: { step: "branch-b" } });

      db.setHead(branchA.id);
      expect(db.listCurrentBranchCycles().map((item) => item.result)).toEqual([{ step: "root" }, { step: "branch-a" }]);

      db.setHead(branchB.id);
      expect(db.listCurrentBranchCycles().map((item) => item.result)).toEqual([{ step: "root" }, { step: "branch-b" }]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given blocks model calls and api calls When querying before and after Then records keep insertion order", () => {
    const db = createDb();
    try {
      const cycle = db.appendCycle({ result: { step: "collect" } });
      const model = db.appendModelCall({
        cycleId: cycle.id,
        provider: "deepseek",
        model: "deepseek-chat",
        request: { messages: 1 },
        response: { id: "resp-1" },
      });

      const block1 = db.appendBlock({ role: "user", channel: "user_input", content: "hello" });
      const block2 = db.appendBlock({
        cycleId: cycle.id,
        role: "assistant",
        channel: "tool_result",
        content: "```yaml\nok: true\n```",
        tool: { name: "terminal_read", ok: true },
      });
      const api = db.appendApiCall({
        modelCallId: model.id,
        request: { body: { prompt: "hello" } },
        response: { body: { reply: "hi" } },
      });

      expect(db.listBlocksAfter(0).map((item) => item.id)).toEqual([block1.id, block2.id]);
      expect(db.listBlocksBefore(block2.id + 1).map((item) => item.id)).toEqual([block1.id, block2.id]);
      expect(db.getModelCallByCycleId(cycle.id)?.id).toBe(model.id);
      expect(db.listApiCallsByModelCall(model.id).map((item) => item.id)).toEqual([api.id]);
      expect(db.getBlockById(block2.id)?.tool).toEqual({ name: "terminal_read", ok: true });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given image assets linked to a chat block When reading the block back Then attachment metadata stays attached in order", () => {
    const db = createDb();
    try {
      const firstAsset = db.appendAsset({
        id: "asset-1",
        kind: "image",
        name: "diagram.png",
        mimeType: "image/png",
        sizeBytes: 128,
        relativePath: "assets/images/asset-1.png",
      });
      const secondAsset = db.appendAsset({
        id: "asset-2",
        kind: "image",
        name: "mockup.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 256,
        relativePath: "assets/images/asset-2.jpg",
      });

      const block = db.appendBlock({
        role: "user",
        channel: "user_input",
        content: "Please inspect these screenshots.",
      });
      db.linkBlockAssets(block.id, [secondAsset.id, firstAsset.id]);

      expect(db.getBlockById(block.id)?.attachments.map((item) => item.id)).toEqual([secondAsset.id, firstAsset.id]);
      expect(db.listBlocksAfter(0)[0]?.attachments.map((item) => item.name)).toEqual(["mockup.jpg", "diagram.png"]);
      expect(db.listAssetsByIds([firstAsset.id, secondAsset.id]).map((item) => item.mimeType)).toEqual([
        "image/png",
        "image/jpeg",
      ]);
    } finally {
      db.close();
    }
  });

});
