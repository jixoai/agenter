import { describe, expect, test } from "bun:test";

import { judgeUrlSpan } from "../src";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import {
  judgeAcknowledgesWorkAndPromisesFollowUp,
  judgeReportsReadyUrlDelivery,
} from "../test-support/real-semantic-assertions";
import { runRealRoomTerminalColdRestartScenario } from "../test-support/real-room-terminal-cold-restart-scenario";
import { loadRequiredRealSemanticJudge } from "../test-support/real-semantic-judge";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI room terminal cold restart recovery", () => {
  realTest(
    "Scenario: Given a real provider When one avatar delivers before a cold restart and later resumes after feedback Then the same session continues from durable room workspace and attention facts",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-room-terminal-cold-restart" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const semanticJudge = await loadRequiredRealSemanticJudge({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
        const result = await runRealRoomTerminalColdRestartScenario(harness);
        const deliverySpan = await judgeUrlSpan(semanticJudge, result.deliveryMessage.content);
        const resumedSpan = await judgeUrlSpan(semanticJudge, result.resumedMessage.content);

        expect(result.acknowledgement.chatId).toBe(result.roomIdBeforeRestart);
        expect(await judgeAcknowledgesWorkAndPromisesFollowUp(semanticJudge, result.acknowledgement.content)).toBe(true);
        expect(result.deliveryMessage.chatId).toBe(result.roomIdBeforeRestart);
        expect(await judgeReportsReadyUrlDelivery(semanticJudge, result.deliveryMessage.content)).toBe(true);
        expect(deliverySpan).not.toEqual({ start: 0, end: 0 });
        expect(result.deliveryMessage.content.slice(deliverySpan.start, deliverySpan.end)).toBe(result.deliveryUrl);
        expect(result.initialBody).toContain("REAL-ROOM-APP-V1");
        expect(result.initialBody).toContain("BUTTON-LABEL-V1");
        expect(result.initialBody).toContain("STATUS-V1");

        expect(result.sessionIdAfterRestart).toBe(result.sessionIdBeforeRestart);
        expect(result.roomIdAfterRestart).toBe(result.roomIdBeforeRestart);
        expect(result.resumedMessage.chatId).toBe(result.roomIdAfterRestart);
        expect(await judgeReportsReadyUrlDelivery(semanticJudge, result.resumedMessage.content)).toBe(true);
        expect(resumedSpan).not.toEqual({ start: 0, end: 0 });
        expect(result.resumedMessage.content.slice(resumedSpan.start, resumedSpan.end)).toBe(result.deliveryUrl);
        expect(result.resumedBody).toContain("REAL-ROOM-APP-V2");
        expect(result.resumedBody).toContain("BUTTON-LABEL-V2");
        expect(result.resumedBody).toContain("FEEDBACK-APPLIED");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCallsAfterRestart.length).toBeGreaterThan(0);
        expect(result.toolTraceToolsAfterRestart).toContain("root_bash");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 960_000 },
  );
});
