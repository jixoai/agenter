import { describe, expect, test } from "bun:test";

import { judgeUrlSpan } from "../src";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import {
  judgeAcknowledgesWorkAndPromisesFollowUp,
  judgeReportsReadyUrlDelivery,
} from "../test-support/real-semantic-assertions";
import { runRealRoomTerminalDeliveryScenario } from "../test-support/real-room-terminal-delivery-scenario";
import { loadRealSemanticJudgeOrWarn } from "../test-support/real-semantic-judge";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI room terminal delivery", () => {
  realTest(
    "Scenario: Given a real provider When one avatar builds and serves a tiny app through the room Then the user can open the URL, give feedback, and receive the updated delivery",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-room-terminal-delivery" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const semanticJudge = await loadRealSemanticJudgeOrWarn({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
        if (!semanticJudge) {
          return;
        }
        const result = await runRealRoomTerminalDeliveryScenario(harness);
        const deliverySpan = await judgeUrlSpan(semanticJudge, result.deliveryMessage.content);
        const updateSpan = await judgeUrlSpan(semanticJudge, result.updateMessage.content);

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(await judgeAcknowledgesWorkAndPromisesFollowUp(semanticJudge, result.acknowledgement.content)).toBe(true);
        expect(result.deliveryMessage.chatId).toBe(primaryRoomId);
        expect(await judgeReportsReadyUrlDelivery(semanticJudge, result.deliveryMessage.content)).toBe(true);
        expect(deliverySpan).not.toEqual({ start: 0, end: 0 });
        expect(result.deliveryMessage.content.slice(deliverySpan.start, deliverySpan.end)).toBe(result.deliveryUrl);
        expect(result.initialBody).toContain("REAL-ROOM-APP-V1");
        expect(result.initialBody).toContain("BUTTON-LABEL-V1");
        expect(result.initialBody).toContain("STATUS-V1");
        expect(result.updateMessage.chatId).toBe(primaryRoomId);
        expect(await judgeReportsReadyUrlDelivery(semanticJudge, result.updateMessage.content)).toBe(true);
        expect(updateSpan).not.toEqual({ start: 0, end: 0 });
        expect(result.updateMessage.content.slice(updateSpan.start, updateSpan.end)).toBe(result.deliveryUrl);
        expect(result.updatedBody).toContain("REAL-ROOM-APP-V2");
        expect(result.updatedBody).toContain("BUTTON-LABEL-V2");
        expect(result.updatedBody).toContain("FEEDBACK-APPLIED");
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
