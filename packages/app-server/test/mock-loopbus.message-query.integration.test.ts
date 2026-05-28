import type { MessageContactId } from "@agenter/message-system";
import { describe, expect, test } from "bun:test";

import { createMockKernelHarness } from "../test-support/mock-kernel-harness";
import { waitForAssistantMessage } from "../test-support/mock-loopbus-scenarios";
import { MOCK_QUERY_ALLOWED_REPLY, MOCK_QUERY_KEYWORD } from "../test-support/mock-model-server";

describe("Feature: mock-loopbus message query", () => {
  test(
    "Scenario: Given a runtime actor with one granted global room When the model searches with message query chatId=* Then only authorized room history is exposed to the AI",
    async () => {
      const harness = await createMockKernelHarness({ sessionName: "message-query-auth" });

      try {
        const primaryRoomId = harness.session.primaryRoomId;
        const actorId = harness.session.avatarPrincipalId as MessageContactId | undefined;
        if (!primaryRoomId || !actorId) {
          throw new Error("expected primary room and avatar principal id");
        }

        const allowedRoom = await harness.kernel.createGlobalRoom({
          title: "Allowed room",
          actorId,
          focus: false,
        });
        const forbiddenRoom = await harness.kernel.createGlobalRoom({
          title: "Forbidden room",
          focus: false,
        });

        harness.kernel.sendGlobalRoomMessage({
          chatId: allowedRoom.chatId,
          accessToken: allowedRoom.accessToken,
          text: "budget incident alpha",
        });
        harness.kernel.sendGlobalRoomMessage({
          chatId: forbiddenRoom.chatId,
          accessToken: forbiddenRoom.accessToken,
          text: "budget incident beta",
        });

        const sent = await harness.kernel.sendChat(
          harness.session.id,
          `帮我临时跨房间搜索 ${MOCK_QUERY_KEYWORD}，但只能看我当前有权限访问的房间。`,
        );
        if (!sent.ok) {
          throw new Error(`failed to send query request: ${sent.reason ?? "unknown"}`);
        }

        const reply = await waitForAssistantMessage(harness, {
          label: "authorized message query reply",
          predicate: (message) => message.chatId === primaryRoomId && message.content.trim() === MOCK_QUERY_ALLOWED_REPLY,
        });
        const debug = await harness.kernel.inspectModelDebug(harness.session.id);
        const rootWorkspaceBashRuns = debug.recentModelCalls.flatMap((call) => {
          const response = call.response;
          if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
            return [];
          }
          return response.toolTrace.flatMap((entry) => {
            if (
              !entry ||
              typeof entry !== "object" ||
              entry.tool !== "root_bash" ||
              !("input" in entry) ||
              !entry.input ||
              typeof entry.input !== "object" ||
              typeof entry.input.command !== "string"
            ) {
              return [];
            }
            const output =
              "output" in entry && entry.output && typeof entry.output === "object" ? entry.output : undefined;
            return [
              {
                command: entry.input.command,
                stdout: typeof output?.stdout === "string" ? output.stdout : "",
              },
            ];
          });
        });
        const messageQueryRuns = rootWorkspaceBashRuns.filter((run) => run.command.startsWith("message query "));
        const messageQueryRequests = messageQueryRuns.flatMap((run) => {
          const rawArg = run.command.slice("message query ".length).trim();
          try {
            const shellArg = JSON.parse(rawArg);
            if (typeof shellArg !== "string") {
              return [];
            }
            const request = JSON.parse(shellArg);
            return request && typeof request === "object" ? [request] : [];
          } catch {
            return [];
          }
        });
        const messageQueryOutput = messageQueryRuns.map((run) => run.stdout).join("\n");

        expect(reply.chatId).toBe(primaryRoomId);
        expect(reply.content).toBe(MOCK_QUERY_ALLOWED_REPLY);
        expect(reply.content).not.toContain("Forbidden room");
        expect(messageQueryRuns.length).toBeGreaterThan(0);
        expect(messageQueryRequests).toContainEqual(
          expect.objectContaining({
            chatId: "*",
            mode: "query",
            query: MOCK_QUERY_KEYWORD,
            limit: 5,
          }),
        );
        expect(messageQueryOutput).toContain("Allowed room");
        expect(messageQueryOutput).not.toContain("Forbidden room");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 30_000 },
  );
});
