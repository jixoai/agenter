import { describe, expect, test } from "bun:test";

import { REAL_MESSAGE_REVISION_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT } from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";
import {
  runRealDraftEditScenario,
  runRealDraftRecallScenario,
  writeRealMessageRevisionEvidence,
  writeRealMessageRevisionFailureEvidence,
} from "../test-support/real-message-revision-scenario";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real AI message revision", () => {
  realTest(
    "Scenario: Given a real provider When a room draft should stay the same fact Then the assistant edits that durable message in place",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-message-edit",
        avatarNickname: REAL_MESSAGE_REVISION_AVATAR_PROFILE.nickname,
        agenterPromptContent: REAL_MESSAGE_REVISION_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const result = await runRealDraftEditScenario(harness);
        await writeRealMessageRevisionEvidence(result);
        const visibleAssistantMessages = result.assistantMessages.filter((message) => typeof message.recalledAt !== "number");
        const recallUsed =
          result.rootWorkspaceBashCommands.some((command) => command.includes("message recall")) ||
          result.directMessageMutationTools.includes("message recall");

        expect(result.observedPattern).toBe("send+edit");
        expect(result.revisedMessage?.messageId).toBe(result.finalMessage.messageId);
        expect(result.revisedMessage?.updatedAt).toBeGreaterThan(result.revisedMessage?.createdAt ?? 0);
        expect(result.revisedMessage?.recalledAt).toBeUndefined();
        expect(result.finalMessage.content.trim()).toBe(result.expectedFinalText);
        expect(visibleAssistantMessages).toHaveLength(1);
        expect(visibleAssistantMessages[0]?.messageId).toBe(result.finalMessage.messageId);
        expect(result.rootWorkspaceBashCommands.some((command) => command.includes("message send"))).toBeTrue();
        expect(
          result.rootWorkspaceBashCommands.some((command) => command.includes("message edit")) ||
            result.directMessageMutationTools.includes("message edit"),
        ).toBeTrue();
        if (recallUsed) {
          expect(result.recalledMessage).toBeTruthy();
          expect(result.recalledMessage?.messageId).not.toBe(result.finalMessage.messageId);
          expect(result.recalledMessage?.content.trim()).not.toBe(result.expectedFinalText);
        }
        expect(result.settledAttention.active).toHaveLength(0);
      } catch (error) {
        await writeRealMessageRevisionFailureEvidence(harness, {
          scenario: "edit",
          error,
        });
        throw error;
      } finally {
        await harness.stop();
      }
    },
    { timeout: 420_000 },
  );

  realTest(
    "Scenario: Given a real provider When a room draft should disappear before the final answer Then the assistant recalls it and sends a replacement",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-message-recall",
        avatarNickname: REAL_MESSAGE_REVISION_AVATAR_PROFILE.nickname,
        agenterPromptContent: REAL_MESSAGE_REVISION_AVATAR_PROFILE.prompt,
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const result = await runRealDraftRecallScenario(harness);
        await writeRealMessageRevisionEvidence(result);

        expect(result.observedPattern).toBe("send+recall+send");
        expect(result.recalledMessage).toBeTruthy();
        expect(result.recalledMessage?.messageId).not.toBe(result.finalMessage.messageId);
        expect(result.recalledMessage?.recalledAt).toBeDefined();
        expect(result.recalledMessage?.content).toBe("");
        expect(result.finalMessage.content.trim()).toBe(result.expectedFinalText);
        expect(result.rootWorkspaceBashCommands.some((command) => command.includes("message send"))).toBeTrue();
        expect(
          result.rootWorkspaceBashCommands.some((command) => command.includes("message recall")) ||
            result.directMessageMutationTools.includes("message recall"),
        ).toBeTrue();
        expect(
          result.rootWorkspaceBashCommands.some((command) => command.includes("message edit")) ||
            result.directMessageMutationTools.includes("message edit"),
        ).toBeFalse();
        expect(result.settledAttention.active).toHaveLength(0);
      } catch (error) {
        await writeRealMessageRevisionFailureEvidence(harness, {
          scenario: "recall",
          error,
        });
        throw error;
      } finally {
        await harness.stop();
      }
    },
    { timeout: 420_000 },
  );
});
