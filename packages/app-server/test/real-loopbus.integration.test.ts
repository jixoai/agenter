import { describe, expect, test } from "bun:test";

import { judgeAvoidsForbiddenMentions, judgeMentionsConcept } from "../src";
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
import {
  judgeAcknowledgesWorkAndPromisesFollowUp,
  judgeAnswersWeatherForecastRequest,
} from "../test-support/real-semantic-assertions";
import { loadRealSemanticJudgeOrWarn } from "../test-support/real-semantic-judge";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
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
        const semanticJudge = await loadRealSemanticJudgeOrWarn({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
        if (!semanticJudge) {
          return;
        }
        const result = await runRealLunchRelayScenario(harness);

        expect(result.originAcknowledgement.chatId).toBe(primaryRoomId);
        expect(result.originAcknowledgement.content.length).toBeGreaterThan(0);
        expect(result.relayPromptMessage.chatId).toBe(result.relayChannel.chatId);
        expect(result.originAcknowledgement.timestamp).toBeLessThanOrEqual(result.relayPromptMessage.timestamp);
        expect(result.relayParticipantReply.chatId).toBe(result.relayChannel.chatId);
        expect(
          await judgeMentionsConcept(semanticJudge, {
            content: result.relayParticipantReply.content,
            concept: "gaubee said egg fried rice for lunch",
            aliases: ["蛋炒饭"],
          }),
        ).toBe(true);
        expect(result.finalReply.chatId).toBe(primaryRoomId);
        expect(
          await judgeMentionsConcept(semanticJudge, {
            content: result.finalReply.content,
            concept: "gaubee said egg fried rice for lunch",
            aliases: ["蛋炒饭"],
          }),
        ).toBe(true);
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
        const semanticJudge = await loadRealSemanticJudgeOrWarn({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
        if (!semanticJudge) {
          return;
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
        expect(
          await judgeMentionsConcept(semanticJudge, {
            content: result.relayParticipantReply.content,
            concept: "gaubee said egg fried rice for lunch",
            aliases: ["蛋炒饭"],
          }),
        ).toBe(true);
        expect(result.finalReply.chatId).toBe(primaryRoomId);
        expect(
          await judgeMentionsConcept(semanticJudge, {
            content: result.finalReply.content,
            concept: "gaubee said egg fried rice for lunch",
            aliases: ["蛋炒饭"],
          }),
        ).toBe(true);
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(followUp.compactCycle.kind).toBe("compact");
        expect(followUp.compactCycle.compactTrigger).toBe("manual");
        expect(followUp.followUpReply.chatId).toBe(primaryRoomId);
        expect(
          await judgeMentionsConcept(semanticJudge, {
            content: followUp.followUpReply.content,
            concept: "gaubee said egg fried rice for lunch",
            aliases: ["蛋炒饭"],
          }),
        ).toBe(true);
        expect(followUp.relayMessageCountAfter).toBe(followUp.relayMessageCountBefore);
        expect(followUp.settledAttention.active).toHaveLength(0);
        expect(followUp.recentModelCalls.length).toBeGreaterThan(0);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 480_000 },
  );

  realTest(
    "Scenario: Given a real provider When the user asks weather that requires external facts Then the assistant uses root workspace shell before replying",
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
        const semanticJudge = await loadRealSemanticJudgeOrWarn({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
        if (!semanticJudge) {
          return;
        }

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(await judgeAcknowledgesWorkAndPromisesFollowUp(semanticJudge, result.acknowledgement.content)).toBe(true);
        expect(result.reply.chatId).toBe(primaryRoomId);
        expect(await judgeAnswersWeatherForecastRequest(semanticJudge, result.reply.content)).toBe(true);
        expect(result.reply.timestamp).toBeGreaterThan(result.acknowledgement.timestamp);
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.toolTraceTools).toContain("root_workspace_bash");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 480_000 },
  );

  realTest(
    "Scenario: Given a real provider When a new user message arrives during tool execution Then the assistant still completes with the tool result and the follow-up clause",
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
        const semanticJudge = await loadRealSemanticJudgeOrWarn({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
        if (!semanticJudge) {
          return;
        }

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(await judgeAcknowledgesWorkAndPromisesFollowUp(semanticJudge, result.acknowledgement.content)).toBe(true);
        expect(result.finalReply.chatId).toBe(primaryRoomId);
        expect(result.finalReply.content).toContain("TOOL-PHASE-DONE");
        expect(result.finalReply.content).toContain("SECOND-CLAUSE");
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 480_000 },
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
        const semanticJudge = await loadRealSemanticJudgeOrWarn({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
        if (!semanticJudge) {
          return;
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
        expect(
          await judgeAvoidsForbiddenMentions(semanticJudge, {
            content: result.relayPromptMessage.content,
            forbidden: ["我出剪刀", "我出石头", "我出布"],
            description: "玩家出招信息",
          }),
        ).toBe(true);
        expect(result.activeAfterRelay.active.length).toBeGreaterThan(0);
        expect(result.toolTraceTools).toContain("root_workspace_bash");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 360_000 },
  );
});
