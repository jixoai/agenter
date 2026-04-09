import { describe, expect, test } from "bun:test";

import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import { runRealRoomTerminalDeliveryScenario } from "../test-support/real-room-terminal-delivery-scenario";

const hasRealModel = process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
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
        const result = await runRealRoomTerminalDeliveryScenario(harness);

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(result.acknowledgement.content.startsWith("APP-ACK:")).toBe(true);
        expect(result.deliveryMessage.chatId).toBe(primaryRoomId);
        expect(result.deliveryMessage.content).toContain(`APP-URL: ${result.deliveryUrl}`);
        expect(result.initialBody).toContain("REAL-ROOM-APP-V1");
        expect(result.initialBody).toContain("BUTTON-LABEL-V1");
        expect(result.initialBody).toContain("STATUS-V1");
        expect(result.updateMessage.chatId).toBe(primaryRoomId);
        expect(result.updateMessage.content).toContain(`APP-UPDATED: ${result.deliveryUrl}`);
        expect(result.updatedBody).toContain("REAL-ROOM-APP-V2");
        expect(result.updatedBody).toContain("BUTTON-LABEL-V2");
        expect(result.updatedBody).toContain("FEEDBACK-APPLIED");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(result.toolTraceTools).toContain("message_send");
        expect(result.toolTraceTools.some((tool) => tool.startsWith("terminal_"))).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 420_000 },
  );
});
