import { describe, expect, test } from "bun:test";

import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import {
  runRealCompactFollowUpScenario,
  runRealLunchRelayScenario,
  runRealSimpleReplyScenario,
} from "../test-support/real-loopbus-scenarios";
import { resolveRealModelConfig } from "../test-support/real-model-cache";

const hasRealModel = process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI loopbus convergence", () => {
  realTest(
    "Scenario: Given a real provider When a minimal chat request is sent Then LoopBus replies through tools and settles attention",
    { timeout: 180_000 },
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-simple-reply" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const result = await runRealSimpleReplyScenario(harness);

        expect(result.reply.chatId).toBe("chat-main");
        expect(result.reply.content).toBe("REAL-AI-OK");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
      } finally {
        await harness.stop();
      }
    },
  );

  realTest(
    "Scenario: Given a real provider When kzf asks gaubee about lunch and manual compact follows Then the answer returns to chat-main and remains available after compact",
    { timeout: 360_000 },
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-lunch-relay" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const result = await runRealLunchRelayScenario(harness);
        const followUp = await runRealCompactFollowUpScenario(harness, {
          relayChannel: result.relayChannel,
          afterReplyTimestamp: result.finalReply.timestamp,
        });

        expect(result.relayChannel.chatId).toBe("chat-gaubee");
        expect(result.relayPromptMessage.chatId).toBe("chat-gaubee");
        expect(result.relayPromptMessage.content.length).toBeGreaterThan(0);
        expect(result.activeAfterRelay.active.length).toBeGreaterThan(0);
        expect(result.relayParticipantReply.chatId).toBe("chat-gaubee");
        expect(result.relayParticipantReply.content).toBe("中午吃蛋炒饭。");
        expect(result.finalReply.chatId).toBe("chat-main");
        expect(result.finalReply.content).toContain("蛋炒饭");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(followUp.compactCycle.kind).toBe("compact");
        expect(followUp.compactCycle.compactTrigger).toBe("manual");
        expect(followUp.followUpReply.chatId).toBe("chat-main");
        expect(followUp.followUpReply.content).toContain("蛋炒饭");
        expect(followUp.relayMessageCountAfter).toBe(followUp.relayMessageCountBefore);
        expect(followUp.settledAttention.active).toHaveLength(0);
        expect(followUp.recentModelCalls.length).toBeGreaterThan(0);
      } finally {
        await harness.stop();
      }
    },
  );
});
