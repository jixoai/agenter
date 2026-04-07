import { describe, expect, test } from "bun:test";

import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import {
  runRealCompactFollowUpScenario,
  runRealInterleavedCanInputScenario,
  runRealJudgeRelayScenario,
  runRealLunchRelayScenario,
  runRealSimpleReplyScenario,
  runRealWeatherThroughTerminalScenario,
} from "../test-support/real-loopbus-scenarios";
import { resolveRealModelConfig } from "../test-support/real-model-cache";

const hasRealModel = process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI loopbus convergence", () => {
  realTest(
    "Scenario: Given a real provider When a minimal chat request is sent Then LoopBus replies through tools and settles attention",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-simple-reply" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealSimpleReplyScenario(harness);

        expect(result.reply.chatId).toBe(primaryRoomId);
        expect(result.reply.content).toBe("REAL-AI-OK");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 180_000 },
  );

  realTest(
    "Scenario: Given a real provider When the user asks the assistant to ask gaubee about lunch Then the assistant acknowledges in chat-main before relaying and brings the answer back",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-lunch-relay-ack" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealLunchRelayScenario(harness);

        expect(result.originAcknowledgement.chatId).toBe(primaryRoomId);
        expect(result.originAcknowledgement.content.length).toBeGreaterThan(0);
        expect(result.relayPromptMessage.chatId).toBe(result.relayChannel.chatId);
        expect(result.originAcknowledgement.timestamp).toBeLessThanOrEqual(result.relayPromptMessage.timestamp);
        expect(result.relayParticipantReply.chatId).toBe(result.relayChannel.chatId);
        expect(result.relayParticipantReply.content).toBe("中午吃蛋炒饭。");
        expect(result.finalReply.chatId).toBe(primaryRoomId);
        expect(result.finalReply.content).toContain("蛋炒饭");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 240_000 },
  );

  realTest(
    "Scenario: Given a real provider When kzf asks gaubee about lunch and manual compact follows Then the answer returns to chat-main and remains available after compact",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-lunch-relay" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealLunchRelayScenario(harness);
        const followUp = await runRealCompactFollowUpScenario(harness, {
          relayChannel: result.relayChannel,
          afterReplyTimestamp: result.finalReply.timestamp,
        });

        expect(result.originAcknowledgement.chatId).toBe(primaryRoomId);
        expect(result.originAcknowledgement.content.length).toBeGreaterThan(0);
        expect(result.relayPromptMessage.chatId).toBe(result.relayChannel.chatId);
        expect(result.relayPromptMessage.content.length).toBeGreaterThan(0);
        expect(result.originAcknowledgement.timestamp).toBeLessThanOrEqual(result.relayPromptMessage.timestamp);
        expect(result.activeAfterRelay.active.length).toBeGreaterThan(0);
        expect(result.relayParticipantReply.chatId).toBe(result.relayChannel.chatId);
        expect(result.relayParticipantReply.content).toBe("中午吃蛋炒饭。");
        expect(result.finalReply.chatId).toBe(primaryRoomId);
        expect(result.finalReply.content).toContain("蛋炒饭");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(followUp.compactCycle.kind).toBe("compact");
        expect(followUp.compactCycle.compactTrigger).toBe("manual");
        expect(followUp.followUpReply.chatId).toBe(primaryRoomId);
        expect(followUp.followUpReply.content).toContain("蛋炒饭");
        expect(followUp.relayMessageCountAfter).toBe(followUp.relayMessageCountBefore);
        expect(followUp.settledAttention.active).toHaveLength(0);
        expect(followUp.recentModelCalls.length).toBeGreaterThan(0);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 360_000 },
  );

  realTest(
    "Scenario: Given a real provider When the user asks weather that requires external facts Then the assistant uses terminal tools before replying",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-weather-terminal" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealWeatherThroughTerminalScenario(harness);

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(result.acknowledgement.content.length).toBeGreaterThan(0);
        expect(result.reply.chatId).toBe(primaryRoomId);
        expect(result.reply.content.startsWith("WEATHER-RESULT:")).toBe(true);
        expect(result.reply.timestamp).toBeGreaterThan(result.acknowledgement.timestamp);
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.toolTraceTools.some((tool) => tool.startsWith("terminal_"))).toBe(true);
        expect(result.toolTraceTools).toContain("message_send");
        expect(result.toolTraceTools).toContain("attention_commit");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 360_000 },
  );

  realTest(
    "Scenario: Given a real provider When a new user message arrives during tool execution Then the next model request in the same cycle includes that interleaved attention input",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-interleaved-can-input" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealInterleavedCanInputScenario(harness);

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(result.acknowledgement.content).toContain("INTERLEAVED-ACK");
        expect(result.finalReply.chatId).toBe(primaryRoomId);
        expect(result.finalReply.content).toContain("INTERLEAVED-RESULT:");
        expect(result.finalReply.content).toContain("TOOL-PHASE-DONE");
        expect(result.finalReply.content).toContain("SECOND-CLAUSE");
        expect(result.yieldedCall.interleavedInputCount).toBeGreaterThan(0);
        expect(result.interleavedRequestCall.cycleId).toBe(result.yieldedCall.cycleId);
        expect(result.interleavedRequestCall.requestText).toContain("SECOND-CLAUSE");
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 360_000 },
  );

  realTest(
    "Scenario: Given a real provider When the assistant acts as judge across channels Then it relays role-aware prompts instead of pretending to be a player",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-judge-relay" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealJudgeRelayScenario(harness);

        expect(result.relayPromptMessage.chatId).toBe(result.relayChannel.chatId);
        expect(result.relayPromptMessage.content).not.toBe(
          [
            "和 kzf 玩个剪刀石头布，你做裁判，我出布。",
            "请先联系 kzf 获取他的出招，不要代替 kzf 出招，也不要把我的整句话原样转发。",
            `等 kzf 回复后，只把比赛结果发回 ${primaryRoomId}，并收敛 attention。`,
          ].join("\n"),
        );
        expect(result.relayPromptMessage.content.includes("我出剪刀")).toBe(false);
        expect(result.relayPromptMessage.content.includes("我出石头")).toBe(false);
        expect(result.relayPromptMessage.content.includes("我出布")).toBe(false);
        expect(result.activeAfterRelay.active.length).toBeGreaterThan(0);
        expect(result.toolTraceTools).toContain("message_send");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 360_000 },
  );
});
