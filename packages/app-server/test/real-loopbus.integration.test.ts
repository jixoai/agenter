import { describe, expect, test } from "bun:test";

import { judgeAvoidsForbiddenMentions, judgeMentionsConcept } from "../src";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import {
  REAL_EXTERNAL_FACT_AVATAR_PROFILE,
  REAL_RELAY_AVATAR_PROFILE,
} from "../test-support/real-ai-test-personas";
import {
  runRealCliCompactScenario,
  runRealCompactFollowUpScenario,
  runRealExternalFactThroughShellScenario,
  runRealInterleavedCanInputScenario,
  runRealJudgeRelayScenario,
  runRealLunchRelayScenario,
  runRealSimpleReplyScenario,
} from "../test-support/real-loopbus-scenarios";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import {
  judgeAcknowledgesWorkAndPromisesFollowUp,
  judgeAnswersPackageLatestVersion,
} from "../test-support/real-semantic-assertions";
import { loadRequiredRealSemanticJudge } from "../test-support/real-semantic-judge";

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
      const harness = await createRealKernelHarness({
        sessionName: "real-lunch-relay-ack",
        avatarNickname: REAL_RELAY_AVATAR_PROFILE.nickname,
        agenterPromptContent: REAL_RELAY_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const semanticJudge = await loadRequiredRealSemanticJudge({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
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
    "Scenario: Given a real provider When the room explicitly requires CLI compact mode Then the assistant inspects help and completes the reply through message send --compact",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-cli-compact" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealCliCompactScenario(harness);

        expect(result.reply.chatId).toBe(primaryRoomId);
        expect(result.reply.content).toBe("COMPACT-OK");
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
        expect(result.toolTraceTools).toContain("root_workspace_bash");
        expect(result.rootWorkspaceBashCommands).toContain("message send --help");
        expect(result.rootWorkspaceBashCommands.some((command) => command.startsWith("message send --compact "))).toBe(
          true,
        );
      } finally {
        await harness.stop();
      }
    },
    { timeout: 240_000 },
  );

  realTest(
    "Scenario: Given a real provider When kzf asks gaubee about lunch and manual compact follows Then the answer returns to chat-main and remains available after compact",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-lunch-relay",
        avatarNickname: REAL_RELAY_AVATAR_PROFILE.nickname,
        agenterPromptContent: REAL_RELAY_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const semanticJudge = await loadRequiredRealSemanticJudge({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
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
    "Scenario: Given a real provider When the user asks for an external fact Then the assistant uses root workspace shell before replying with the verified result",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-shell-external-fact",
        avatarNickname: REAL_EXTERNAL_FACT_AVATAR_PROFILE.nickname,
        agenterPromptContent: REAL_EXTERNAL_FACT_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const result = await runRealExternalFactThroughShellScenario(harness);
        const semanticJudge = await loadRequiredRealSemanticJudge({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(await judgeAcknowledgesWorkAndPromisesFollowUp(semanticJudge, result.acknowledgement.content)).toBe(
          true,
        );
        expect(result.reply.chatId).toBe(primaryRoomId);
        expect(
          await judgeAnswersPackageLatestVersion(semanticJudge, {
            content: result.reply.content,
            packageName: result.packageName,
            expectedVersion: result.expectedVersion,
          }),
        ).toBe(true);
        expect(result.reply.timestamp).toBeGreaterThan(result.acknowledgement.timestamp);
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.toolTraceTools).toContain("root_workspace_bash");
        expect(harness.avatarNickname).toBe(REAL_EXTERNAL_FACT_AVATAR_PROFILE.nickname);
        expect(harness.avatarPromptPath).toBeTruthy();
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
        const semanticJudge = await loadRequiredRealSemanticJudge({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });

        expect(result.acknowledgement.chatId).toBe(primaryRoomId);
        expect(await judgeAcknowledgesWorkAndPromisesFollowUp(semanticJudge, result.acknowledgement.content)).toBe(
          true,
        );
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
        const semanticJudge = await loadRequiredRealSemanticJudge({
          projectRoot: REAL_MODEL_PROJECT_ROOT,
        });
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
