import type { MessageContactId } from "@agenter/message-system";
import { describe, expect, test } from "bun:test";

import {
  createRealKernelHarness,
  REAL_MODEL_PROJECT_ROOT,
  type RealKernelHarnessDiagnostics,
  waitForRealValue,
} from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";

const REAL_QUERY_KEYWORD = "budget incident";
const REAL_QUERY_ALLOWED_REPLY = "SEARCH-RESULT: Allowed room -> budget incident alpha";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;
const isMessageQueryCommand = (command: string): boolean => command === "message query" || command.startsWith("message query ");

const extractRootWorkspaceBashRuns = (
  diagnostics: RealKernelHarnessDiagnostics,
): Array<{ command: string; stdin: string; stdout: string }> =>
  diagnostics.recentModelCalls.flatMap((call) =>
    call.toolTrace.flatMap((entry) => {
      if (
        entry.tool !== "root_bash" ||
        !entry.input ||
        typeof entry.input !== "object" ||
        typeof (entry.input as { command?: unknown }).command !== "string"
      ) {
        return [];
      }
      const output = entry.output;
      return [
        {
          command: (entry.input as { command: string }).command,
          stdin: typeof (entry.input as { stdin?: unknown }).stdin === "string" ? (entry.input as { stdin: string }).stdin : "",
          stdout:
            output && typeof output === "object" && typeof (output as { stdout?: unknown }).stdout === "string"
              ? (output as { stdout: string }).stdout
              : "",
        },
      ];
    }),
  );

const extractMessageQueryRequests = (runs: Array<{ command: string; stdin: string; stdout: string }>): unknown[] =>
  runs
    .filter((run) => isMessageQueryCommand(run.command))
    .flatMap((run) => {
      if (run.stdin.length > 0) {
        try {
          const request = JSON.parse(run.stdin);
          return request && typeof request === "object" ? [request] : [];
        } catch {
          return [];
        }
      }
      if (run.command === "message query") {
        return [];
      }
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

describe("Feature: real AI message query", () => {
  realTest(
    "Scenario: Given a real provider When authorized cross-room search is requested Then the assistant uses message query and reports only the authorized hit",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-message-query" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

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

        expect(
          harness.kernel.sendGlobalRoomMessage({
            chatId: allowedRoom.chatId,
            accessToken: allowedRoom.accessToken,
            text: "budget incident alpha",
          }).ok,
        ).toBe(true);
        expect(
          harness.kernel.sendGlobalRoomMessage({
            chatId: forbiddenRoom.chatId,
            accessToken: forbiddenRoom.accessToken,
            text: "budget incident beta",
          }).ok,
        ).toBe(true);

        const startAt = Date.now();
        const sent = await harness.kernel.sendChat(
          harness.session.id,
          [
            "请完成一次真实的授权跨房间消息搜索验证。",
            "必须先通过 root_bash 执行一次 `message query --help`。",
            "然后必须再次通过 root_bash 执行一次真正成功的 `message query`。",
            "不要使用 `--compact`。",
            `真正执行查询时，请使用 command=message query，并把标准 object JSON 放在 stdin：{"chatId":"*","mode":"query","query":"${REAL_QUERY_KEYWORD}","limit":5}`,
            `如果查到有权限房间中的命中结果，就只向 ${primaryRoomId} 发送最终结果。`,
            `最终结果必须包含精确片段：${REAL_QUERY_ALLOWED_REPLY}`,
            "最终结果不要提到 Forbidden room，也不要提到 budget incident beta。",
            "完成后把 attention 收敛到 0。",
          ].join("\n"),
        );
        if (!sent.ok) {
          throw new Error(`failed to send real message query prompt: ${sent.reason ?? "unknown"}`);
        }

        const settled = await waitForRealValue(
          async () => {
            const attention = await harness.kernel.inspectAttentionState(harness.session.id);
            const diagnostics = await harness.collectDiagnostics({ messageLimit: 50 });
            const reply =
              diagnostics.roomTruth
                .filter(
                  (message) =>
                    message.chatId === primaryRoomId &&
                    message.role === "assistant" &&
                    message.timestamp >= startAt &&
                    message.content.includes(REAL_QUERY_ALLOWED_REPLY),
                )
                .at(-1) ?? null;
            const latestModelCall = diagnostics.recentModelCalls.at(-1) ?? null;
            if (!reply || attention.active.length > 0 || latestModelCall?.status === "running") {
              return null;
            }
            return {
              attention,
              diagnostics,
              reply,
            };
          },
          {
            label: "real message query reply and settled attention",
            timeoutMs: 240_000,
          },
        );

        const rootWorkspaceBashRuns = extractRootWorkspaceBashRuns(settled.diagnostics);
        const messageQueryRuns = rootWorkspaceBashRuns.filter((run) => isMessageQueryCommand(run.command));
        const messageQueryRequests = extractMessageQueryRequests(rootWorkspaceBashRuns);
        const messageQueryOutput = messageQueryRuns.map((run) => run.stdout).join("\n");

        expect(settled.reply.chatId).toBe(primaryRoomId);
        expect(settled.reply.content).toContain(REAL_QUERY_ALLOWED_REPLY);
        expect(settled.reply.content).not.toContain("Forbidden room");
        expect(settled.reply.content).not.toContain("budget incident beta");
        expect(settled.attention.active).toHaveLength(0);
        expect(settled.diagnostics.recentModelCalls.length).toBeGreaterThan(0);
        expect(settled.diagnostics.recentModelCalls.some((call) => call.outcome === "done")).toBe(true);
        expect(settled.diagnostics.recentModelCalls.flatMap((call) => call.toolTraceTools)).toContain(
          "root_bash",
        );
        expect(messageQueryRuns.length).toBeGreaterThan(0);
        expect(messageQueryRuns.some((run) => run.command === "message query --help")).toBe(true);
        expect(messageQueryRequests).toContainEqual(
          expect.objectContaining({
            chatId: "*",
            mode: "query",
            query: REAL_QUERY_KEYWORD,
            limit: 5,
          }),
        );
        expect(messageQueryOutput).toContain("Allowed room");
        expect(messageQueryOutput).not.toContain("Forbidden room");
      } finally {
        await harness.stop();
      }
    },
    { timeout: 300_000 },
  );
});
