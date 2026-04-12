import { describe, expect, test } from "bun:test";

import { judgeContainsUrl, judgeUrlSpan } from "../src";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealRoomTerminalRealisticUserScenario } from "../test-support/real-room-terminal-realistic-user-scenario";
import { createRealSemanticJudge } from "../test-support/real-semantic-judge";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI realistic novice-user delivery", () => {
  realTest(
    "Scenario: Given a real provider When one ordinary user asks for a tiny app in plain language Then the avatar still builds, revises, and re-delivers through room plus terminal",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-room-terminal-realistic-user" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const semanticJudgeResult = await createRealSemanticJudge({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
        const semanticJudge = semanticJudgeResult.judge;
        if (!semanticJudge) {
          console.warn(semanticJudgeResult.availability.warning ?? "real semantic judge is unavailable");
          return;
        }

        const result = await runRealRoomTerminalRealisticUserScenario(harness);
        const deliverySpan = await judgeUrlSpan(semanticJudge, result.deliveryMessage.content);
        const updateSpan = await judgeUrlSpan(semanticJudge, result.updateMessage.content);

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(result.acknowledgement.content.trim().length).toBeGreaterThan(0);
        expect(await judgeContainsUrl(semanticJudge, result.acknowledgement.content)).toBe(false);
        expect(result.deliveryMessage.chatId).toBe(primaryRoomId);
        expect(deliverySpan).not.toEqual({ start: 0, end: 0 });
        expect(result.deliveryMessage.content.slice(deliverySpan.start, deliverySpan.end)).toBe(result.deliveryUrl);
        expect(result.initialBody).toContain("周末喝水提醒");
        expect(result.initialBody).toContain("点我一下");
        expect(result.initialBody).toContain("今天先从第一杯开始");
        expect(result.updateMessage.chatId).toBe(primaryRoomId);
        expect(updateSpan).not.toEqual({ start: 0, end: 0 });
        expect(result.updateMessage.content.slice(updateSpan.start, updateSpan.end)).toBe(result.deliveryUrl);
        expect(result.updatedBody).toContain("周末喝水提醒");
        expect(result.updatedBody).toContain("继续喝水");
        expect(result.updatedBody).toContain("已根据反馈更新");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(result.toolTraceTools).toContain("root_workspace_bash");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 420_000 },
  );
});
