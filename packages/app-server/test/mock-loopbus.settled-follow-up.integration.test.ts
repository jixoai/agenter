import { describe, expect, test } from "bun:test";

import { createMockKernelHarness } from "../test-support/mock-kernel-harness";
import {
  createGaubeeRoom,
  runSettledFollowUpScenario,
  runTwoRoomRelayScenario,
} from "../test-support/mock-loopbus-scenarios";
import { MOCK_FINAL_ANSWER } from "../test-support/mock-model-server";

describe("Feature: non-GUI LoopBus settled follow-up", () => {
  test(
    "Scenario: Given the relay already settled When kzf sends a fresh follow-up Then LoopBus wakes again and answers without reopening the relay room",
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "two-room-settled-follow-up" });

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const relayChannel = await createGaubeeRoom(harness);
        const relay = await runTwoRoomRelayScenario(harness, relayChannel);
        const followUp = await runSettledFollowUpScenario(harness, {
          relayChannel,
          afterReplyTimestamp: relay.finalReply.timestamp,
        });

        expect(followUp.followUpReply.chatId).toBe(primaryRoomId);
        expect(followUp.followUpReply.content).toBe(MOCK_FINAL_ANSWER);
        expect(followUp.relayPromptCountAfter).toBe(followUp.relayPromptCountBefore);
        expect(followUp.settledAttention.active).toHaveLength(0);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 30_000 },
  );
});
