import { describe, expect, test } from "bun:test";

import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealRoomTerminalColdRestartScenario } from "../test-support/real-room-terminal-cold-restart-scenario";

const hasRealModel = process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
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
        const result = await runRealRoomTerminalColdRestartScenario(harness);

        expect(result.acknowledgement.chatId).toBe(result.primaryRoomIdBeforeRestart);
        expect(result.acknowledgement.content.startsWith("APP-ACK:")).toBe(true);
        expect(result.deliveryMessage.chatId).toBe(result.primaryRoomIdBeforeRestart);
        expect(result.deliveryMessage.content).toContain(`APP-URL: ${result.deliveryUrl}`);
        expect(result.initialBody).toContain("REAL-ROOM-APP-V1");
        expect(result.initialBody).toContain("BUTTON-LABEL-V1");
        expect(result.initialBody).toContain("STATUS-V1");

        expect(result.sessionIdAfterRestart).toBe(result.sessionIdBeforeRestart);
        expect(result.primaryRoomIdAfterRestart).toBe(result.primaryRoomIdBeforeRestart);
        expect(result.resumedMessage.chatId).toBe(result.primaryRoomIdAfterRestart);
        expect(result.resumedMessage.content).toContain(`APP-RESUMED: ${result.deliveryUrl}`);
        expect(result.resumedBody).toContain("REAL-ROOM-APP-V2");
        expect(result.resumedBody).toContain("BUTTON-LABEL-V2");
        expect(result.resumedBody).toContain("FEEDBACK-APPLIED");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCallsAfterRestart.length).toBeGreaterThan(0);
        expect(result.toolTraceToolsAfterRestart).toContain("root_workspace_bash");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 480_000 },
  );
});
