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
    { timeout: 30_000 },
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "two-room-relay" });

      try {
        const relayChannel = createGaubeeRoom(harness);
        const roomList = harness.kernel.listMessageChannels(harness.session.id);
        const kzfRoom = roomList.find((channel) => channel.chatId === "chat-main");
        const gaubeeRoom = roomList.find((channel) => channel.chatId === relayChannel.chatId);

        expect(kzfRoom?.participants.some((participant) => participant.label === "kzf")).toBeTrue();
        expect(gaubeeRoom?.participants.some((participant) => participant.label === "gaubee")).toBeTrue();

        const result = await runTwoRoomRelayScenario(harness, relayChannel);

        expect(result.relayChannel.chatId).toBe("chat-gaubee");
        expect(result.relayPromptMessage.chatId).toBe("chat-gaubee");
        expect(result.relayPromptMessage.content).toBe(MOCK_RELAY_PROMPT);
        expect(result.relayParticipantReply.chatId).toBe("chat-gaubee");
        expect(result.relayParticipantReply.content).toBe(MOCK_GAUBEE_REPLY);
        expect(result.finalReply.chatId).toBe("chat-main");
        expect(result.finalReply.content).toBe(MOCK_FINAL_ANSWER);
        expect(result.settledAttention.active).toHaveLength(0);

        const recentResponses = JSON.stringify(result.recentModelCalls.map((call) => call.response));
        expect(recentResponses).toContain("message_channel_list");
        expect(recentResponses).toContain("message_send");
        expect(recentResponses).toContain("attention_commit");
        expect(recentResponses).toContain("chat-gaubee");
      } finally {
        await harness.stop();
      }
    },
  );

  test(
    "Scenario: Given the relay already completed When the session runs manual compact and kzf asks again Then the answer is recovered without relaying to gaubee a second time",
    { timeout: 30_000 },
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "two-room-compact-follow-up" });

      try {
        const relayChannel = createGaubeeRoom(harness);
        const relay = await runTwoRoomRelayScenario(harness, relayChannel);
        const followUp = await runCompactFollowUpScenario(harness, {
          relayChannel,
          afterReplyTimestamp: relay.finalReply.timestamp,
        });

        expect(followUp.compactCycle.kind).toBe("compact");
        expect(followUp.compactCycle.compactTrigger).toBe("manual");
        expect(followUp.followUpReply.chatId).toBe("chat-main");
        expect(followUp.followUpReply.content).toBe(MOCK_FINAL_ANSWER);
        expect(followUp.relayPromptCountAfter).toBe(followUp.relayPromptCountBefore);
        expect(followUp.settledAttention.active).toHaveLength(0);
      } finally {
        await harness.stop();
      }
    },
  );
});
