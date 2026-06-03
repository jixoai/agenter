import { describe, expect, test } from "bun:test";

import { createMockKernelHarness } from "../test-support/mock-kernel-harness";
import {
  createGaubeeRoom,
  runCompactFollowUpScenario,
  runTwoRoomRelayScenario,
} from "../test-support/mock-loopbus-scenarios";
import { MOCK_FINAL_ANSWER } from "../test-support/mock-model-server";

describe("Feature: non-GUI LoopBus compact follow-up replay", () => {
  test(
    "Scenario: Given the relay already completed When the session runs manual compact and kzf asks again Then the answer is recovered without relaying to gaubee a second time",
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "two-room-compact-follow-up" });

      try {
        const roomId = harness.room.chatId;
        const relayChannel = await createGaubeeRoom(harness);
        const relay = await runTwoRoomRelayScenario(harness, relayChannel);
        const followUp = await runCompactFollowUpScenario(harness, {
          relayChannel,
          afterReplyTimestamp: relay.finalReply.timestamp,
        });

        expect(followUp.compactCycle.kind).toBe("compact");
        expect(followUp.compactCycle.compactTrigger).toBe("manual");
        expect(followUp.followUpReply.chatId).toBe(roomId);
        expect(followUp.followUpReply.content).toBe(MOCK_FINAL_ANSWER);
        expect(followUp.relayPromptCountAfter).toBe(followUp.relayPromptCountBefore);
        expect(followUp.settledAttention.active).toHaveLength(0);
        const heartbeat = harness.kernel.listChatMessages(harness.session.id, 0, 200);
        const compactSeparators = heartbeat.filter((message) => message.heartbeatKind === "compact_separator");
        expect(compactSeparators.length).toBeGreaterThan(0);
        expect(
          compactSeparators.some(
            (message) =>
              message.role === "system" && message.compactTrigger === followUp.compactCycle.compactTrigger,
          ),
        ).toBeTrue();
      } finally {
        await harness.stop();
      }
    },
    { timeout: 60_000 },
  );
});
