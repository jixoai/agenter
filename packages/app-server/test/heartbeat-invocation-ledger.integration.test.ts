import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { SessionDb } from "@agenter/session-system";

import { AppKernel } from "../src";
import { createMockKernelHarness, waitForMockValue } from "../test-support/mock-kernel-harness";
import {
  createGaubeeRoom,
  waitForAssistantMessage,
  waitForAttentionSettled,
  waitForUserMessage,
} from "../test-support/mock-loopbus-scenarios";
import { MOCK_FINAL_ANSWER, MOCK_GAUBEE_REPLY, MOCK_RELAY_PROMPT } from "../test-support/mock-model-server";

describe("Feature: invocation-first heartbeat ledger cold restore", () => {
  test(
    "Scenario: Given a mock relay run with root_bash When the invocation finishes and the kernel cold restarts Then the same heartbeat_part row keeps both params and result",
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "heartbeat-invocation-ledger" });
      let restarted: AppKernel | null = null;
      const db = new SessionDb(join(harness.session.sessionRoot, "session.db"));

      try {
        const relayChannel = await createGaubeeRoom(harness);
        const sent = await harness.kernel.pushUserRoomMessage({
          sessionId: harness.session.id,
          chatId: harness.room.chatId,
          text: "gaubee在吗？问他中午吃什么？",
        });
        if (!sent.ok) {
          throw new Error(`failed to send relay prompt: ${sent.reason ?? "unknown"}`);
        }

        const runningRow = await waitForMockValue(
          () =>
            db
              .listMessagesByScope("heartbeat_part", { limit: 200 })
              .find(
                (row) =>
                  row.messageId.includes(":tool:") &&
                  row.parts.some((part) => part.partType === "tool_call" && part.isComplete === false),
              ) ?? null,
          {
            label: "running invocation heartbeat row",
            timeoutMs: 60_000,
          },
        );

        expect(runningRow.parts).toMatchObject([
          {
            partType: "tool_call",
            isComplete: false,
            payload: {
              tool: "root_bash",
            },
          },
        ]);

        const runningAiCall = db.getAiCallById(runningRow.aiCallId ?? -1);
        expect(runningAiCall?.responseMessageIds).toContain(runningRow.messageId);

        const relayPromptMessage = await waitForAssistantMessage(harness, {
          label: "relay prompt to gaubee room",
          predicate: (message) => message.chatId === relayChannel.chatId && message.content.trim() === MOCK_RELAY_PROMPT,
        });
        expect(relayPromptMessage.content).toBe(MOCK_RELAY_PROMPT);

        const replySent = await harness.kernel.sendMessageChannel({
          sessionId: harness.session.id,
          chatId: relayChannel.chatId,
          accessToken: relayChannel.accessToken,
          text: MOCK_GAUBEE_REPLY,
        });
        if (!replySent.ok) {
          throw new Error(`failed to send gaubee reply: ${replySent.reason ?? "unknown"}`);
        }

        await waitForUserMessage(harness, {
          label: "gaubee reply on relay room",
          predicate: (message) => message.chatId === relayChannel.chatId && message.content.trim() === MOCK_GAUBEE_REPLY,
        });
        await waitForAssistantMessage(harness, {
          label: "final reply on main room",
          predicate: (message) =>
            message.chatId === harness.room.chatId && message.content.trim() === MOCK_FINAL_ANSWER,
        });
        await waitForAttentionSettled(harness);

        const completedRow =
          db
            .listMessagesByScope("heartbeat_part", { limit: 400 })
            .find((row) => row.messageId === runningRow.messageId) ?? null;
        expect(completedRow?.parts).toMatchObject([
          {
            partType: "tool_call",
            isComplete: true,
            payload: {
              tool: "root_bash",
            },
          },
          {
            partType: "tool_result",
            isComplete: true,
            payload: {
              tool: "root_bash",
              error: null,
            },
          },
        ]);

        const completedAiCall = runningAiCall ? db.getAiCallById(runningAiCall.id) : null;
        expect(completedAiCall?.responseMessageIds).toContain(runningRow.messageId);
        const assistantResponseIds =
          completedAiCall?.responseMessageIds.filter((messageId) => messageId.includes(":response:assistant:")) ?? [];
        expect(assistantResponseIds.every((messageId) => messageId.includes(":response:assistant:"))).toBeTrue();

        await harness.kernel.stop();

        restarted = new AppKernel({
          globalSessionRoot: join(harness.rootDir, "sessions"),
          archiveSessionRoot: join(harness.rootDir, "archive", "sessions"),
          workspacesPath: join(harness.rootDir, "workspaces.yaml"),
        });
        await restarted.start();

        const restartedPage = restarted.pageHeartbeatParts(harness.session.id, { limit: 400 });
        const restartedRows = restartedPage.items.filter((row) => row.messageId === runningRow.messageId);
        expect(restartedRows).toHaveLength(1);
        expect(restartedRows[0]?.parts).toMatchObject([
          {
            partType: "tool_call",
            isComplete: true,
            payload: {
              tool: "root_bash",
            },
          },
          {
            partType: "tool_result",
            isComplete: true,
            payload: {
              tool: "root_bash",
              error: null,
            },
          },
        ]);
      } finally {
        db.close();
        await restarted?.stop().catch(() => {});
        await harness.stop().catch(() => {});
      }
    },
    { timeout: 60_000 },
  );
});
