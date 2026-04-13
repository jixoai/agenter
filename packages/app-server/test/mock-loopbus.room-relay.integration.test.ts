import { describe, expect, test } from "bun:test";

import { createMockKernelHarness } from "../test-support/mock-kernel-harness";
import {
  createGaubeeRoom,
  runCompactFollowUpScenario,
  runTwoRoomRelayScenario,
} from "../test-support/mock-loopbus-scenarios";
import { MOCK_FINAL_ANSWER, MOCK_GAUBEE_REPLY, MOCK_RELAY_PROMPT } from "../test-support/mock-model-server";

describe("Feature: non-GUI LoopBus two-room relay", () => {
  test(
    "Scenario: Given a session with rooms for kzf and gaubee When kzf asks about lunch Then the runtime relays through gaubee's room and answers back in kzf's room",
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "two-room-relay" });

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const relayChannel = await createGaubeeRoom(harness);
        const roomList = harness.kernel.listMessageChannels(harness.session.id);
        const gaubeeRoom = roomList.find((channel) => channel.chatId === relayChannel.chatId);

        expect(gaubeeRoom?.participants.some((participant) => participant.label === "gaubee")).toBeTrue();

        const result = await runTwoRoomRelayScenario(harness, relayChannel);

        expect(result.relayChannel.chatId).toBe(relayChannel.chatId);
        expect(result.relayPromptMessage.chatId).toBe(relayChannel.chatId);
        expect(result.relayPromptMessage.content).toBe(MOCK_RELAY_PROMPT);
        expect(result.relayParticipantReply.chatId).toBe(relayChannel.chatId);
        expect(result.relayParticipantReply.content).toBe(MOCK_GAUBEE_REPLY);
        expect(result.finalReply.chatId).toBe(primaryRoomId);
        expect(result.finalReply.content).toBe(MOCK_FINAL_ANSWER);
        expect(result.settledAttention.active).toHaveLength(0);

        const recentResponses = JSON.stringify(result.recentModelCalls.map((call) => call.response));
        expect(recentResponses).toContain("message list");
        expect(recentResponses).toContain("message send");
        expect(recentResponses).toContain("attention commit");
        expect(recentResponses).toContain(relayChannel.chatId);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 30_000 },
  );

  test(
    "Scenario: Given the relay already completed When the session runs manual compact and kzf asks again Then the answer is recovered without relaying to gaubee a second time",
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "two-room-compact-follow-up" });

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        if (!primaryRoomId) {
          throw new Error("expected session primaryRoomId");
        }
        const relayChannel = await createGaubeeRoom(harness);
        const relay = await runTwoRoomRelayScenario(harness, relayChannel);
        const followUp = await runCompactFollowUpScenario(harness, {
          relayChannel,
          afterReplyTimestamp: relay.finalReply.timestamp,
        });

        expect(followUp.compactCycle.kind).toBe("compact");
        expect(followUp.compactCycle.compactTrigger).toBe("manual");
        expect(followUp.followUpReply.chatId).toBe(primaryRoomId);
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
    { timeout: 30_000 },
  );
});
