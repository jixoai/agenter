import { describe, expect, test } from "bun:test";

import { REAL_MESSAGE_FOLLOW_UP_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import {
  runRealMessageFollowUpScenario,
  writeRealMessageFollowUpEvidence,
  writeRealMessageFollowUpFailureEvidence,
} from "../test-support/real-message-follow-up-scenario";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI message follow-up reminder", () => {
  realTest(
    "Scenario: Given a real provider When a room acknowledgement carries followUpAfterMs Then reminder expiry produces a later explicit room send instead of an automatic reply",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-message-follow-up",
        avatarNickname: REAL_MESSAGE_FOLLOW_UP_AVATAR_PROFILE.nickname,
        agenterPromptContent: REAL_MESSAGE_FOLLOW_UP_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const result = await runRealMessageFollowUpScenario(harness);
        await writeRealMessageFollowUpEvidence(result);

        expect(result.firstMessage.chatId).toBe(result.roomId);
        expect(result.firstMessage.content.trim()).toBe(result.firstReply);
        expect(result.secondMessage.chatId).toBe(result.roomId);
        expect(result.secondMessage.content.trim()).toBe(result.secondReply);
        expect(result.secondMessage.createdAt - result.firstMessage.createdAt).toBeGreaterThanOrEqual(
          result.minReminderDelayMs,
        );
        expect(result.assistantMessages.map((message) => message.content.trim())).toEqual([
          result.firstReply,
          result.secondReply,
        ]);
        expect(result.settledAttention.active).toHaveLength(0);
        expect(result.recentModelCalls.length).toBeGreaterThan(0);
        expect(result.recentModelCalls.some((call) => call.outcome === "done")).toBeTrue();
        expect(result.recentModelCalls.flatMap((call) => call.toolTraceTools)).toContain("root_bash");
        expect(result.rootWorkspaceBashRuns.some((run) => run.command === "message send")).toBeTrue();
        expect(result.rootWorkspaceMessageSendRequests).toContainEqual(
          expect.objectContaining({
            chatId: result.roomId,
            content: result.firstReply,
            followUpAfterMs: result.followUpAfterMs,
          }),
        );
        expect(result.rootWorkspaceMessageSendRequests).toContainEqual(
          expect.objectContaining({
            chatId: result.roomId,
            content: result.secondReply,
          }),
        );
      } catch (error) {
        await writeRealMessageFollowUpFailureEvidence(harness, error);
        throw error;
      } finally {
        await harness.stop();
      }
    },
    { timeout: 420_000 },
  );
});
