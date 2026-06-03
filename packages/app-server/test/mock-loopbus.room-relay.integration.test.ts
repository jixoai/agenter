import { describe, expect, test } from "bun:test";

import { createMockKernelHarness } from "../test-support/mock-kernel-harness";
import {
  createGaubeeRoom,
  runTwoRoomRelayScenario,
} from "../test-support/mock-loopbus-scenarios";
import { MOCK_FINAL_ANSWER, MOCK_GAUBEE_REPLY, MOCK_RELAY_PROMPT } from "../test-support/mock-model-server";

describe("Feature: non-GUI LoopBus two-room relay", () => {
  test(
    "Scenario: Given a session with rooms for kzf and gaubee When kzf asks about lunch Then the runtime relays through gaubee's room and answers back in kzf's room",
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "two-room-relay" });

      try {
        const roomId = harness.room.chatId;
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
        expect(result.finalReply.chatId).toBe(roomId);
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
    { timeout: 60_000 },
  );
});
