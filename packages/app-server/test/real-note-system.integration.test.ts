import { describe, expect, test } from "bun:test";

import {
  createRealKernelHarness,
  REAL_MODEL_PROJECT_ROOT,
  type RealKernelHarnessDiagnostics,
  waitForRealValue,
} from "../test-support/real-kernel-harness";
import { resolveRealModelConfig } from "../test-support/real-model-cache";

const NOTE_SYSTEM_REAL_AI_OBSERVATION = "NOTE-SYSTEM-REAL-AI-OBSERVATION";
const NOTE_SYSTEM_REAL_AI_REPLY = "NOTE-SYSTEM-OK";

const resolveNoteSystemRealAiProviderGate = (): { available: boolean; reason: string | null } => {
  if (process.env.AGENTER_RUN_REAL_LOOPBUS !== "1") {
    return {
      available: false,
      reason:
        "Set AGENTER_RUN_REAL_LOOPBUS=1 and configure a real model provider to run NoteSystem real-AI validation.",
    };
  }
  if (!resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT)) {
    return {
      available: false,
      reason: `No real model provider config was found for ${REAL_MODEL_PROJECT_ROOT}.`,
    };
  }
  return { available: true, reason: null };
};

const realAiGate = resolveNoteSystemRealAiProviderGate();
const realTest = realAiGate.available ? test : test.skip;

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
          stdin:
            typeof (entry.input as { stdin?: unknown }).stdin === "string"
              ? (entry.input as { stdin: string }).stdin
              : "",
          stdout:
            output && typeof output === "object" && typeof (output as { stdout?: unknown }).stdout === "string"
              ? (output as { stdout: string }).stdout
              : "",
        },
      ];
    }),
  );

describe("Feature: real AI NoteSystem validation", () => {
  test("Scenario: Given no real provider settings When the NoteSystem real-AI gate is resolved Then the skip reason is explicit", () => {
    if (realAiGate.available) {
      expect(realAiGate.reason).toBeNull();
      return;
    }
    expect(realAiGate.reason).toContain("real model provider");
  });

  realTest(
    "Scenario: Given a configured real provider When the model records a durable note Then it uses NoteSystem skill and note CLI before verifying retrieval",
    async () => {
      const harness = await createRealKernelHarness({
        sessionName: "real-note-system",
        avatarNickname: "test-note-system",
        agenterPromptContent: [
          "You are validating NoteSystem.",
          "Before recording any note, inspect NoteSystem guidance with `skill info note` through root_bash.",
          "Record raw activity evidence only through the projected `note` CLI. Do not create or edit files directly.",
          "After recording, verify retrieval with `note search` or `note show`.",
        ].join("\n"),
      });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        const roomId = harness.room.chatId;

        const startAt = Date.now();
        const sent = await harness.kernel.pushUserRoomMessage({
          sessionId: harness.session.id,
          chatId: roomId,
          text: [
            "请完成一次 NoteSystem 真实 AI 验证。",
            "必须先通过 root_bash 执行 `skill info note`。",
            `然后必须通过 root_bash 执行 note CLI 写入包含精确片段 ${NOTE_SYSTEM_REAL_AI_OBSERVATION} 的 raw note，写入 JSON 必须包含 "mime":"text/markdown" 和 content/contentFile 之一。`,
            "可以使用 `note draft` 或 `note write`，但不能直接 mkdir/cat/tee/printf 到 notes 文件。",
            `写入后必须通过 root_bash 执行 \`note search '{"query":"${NOTE_SYSTEM_REAL_AI_OBSERVATION}"}'\` 或等价 \`note show\` JSON 命令验证能读回该片段。`,
            `验证成功后，只向 ${roomId} 发送最终结果：${NOTE_SYSTEM_REAL_AI_REPLY}`,
            "完成后把 attention 收敛到 0。",
          ].join("\n"),
        });
        if (!sent.ok) {
          throw new Error(`failed to send real NoteSystem prompt: ${sent.reason ?? "unknown"}`);
        }

        const settled = await waitForRealValue(
          async () => {
            const attention = await harness.kernel.inspectAttentionState(harness.session.id);
            const diagnostics = await harness.collectDiagnostics({ messageLimit: 50 });
            const reply =
              diagnostics.roomTruth
                .filter(
                  (message) =>
                    message.chatId === roomId &&
                    message.role === "assistant" &&
                    message.timestamp >= startAt &&
                    message.content.includes(NOTE_SYSTEM_REAL_AI_REPLY),
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
            label: "real NoteSystem reply and settled attention",
            timeoutMs: 300_000,
          },
        );

        const runs = extractRootWorkspaceBashRuns(settled.diagnostics);
        const commands = runs.map((run) => run.command);
        const commandText = commands.join("\n");
        const outputText = runs.map((run) => `${run.stdout}\n${run.stdin}`).join("\n");

        expect(settled.reply.chatId).toBe(roomId);
        expect(settled.reply.content.trim()).toBe(NOTE_SYSTEM_REAL_AI_REPLY);
        expect(settled.attention.active).toHaveLength(0);
        expect(commands.some((command) => command.includes("skill info note"))).toBe(true);
        expect(commands.some((command) => /\bnote (draft|write)\b/u.test(command))).toBe(true);
        expect(commands.some((command) => /\bnote (search|show)\b/u.test(command))).toBe(true);
        expect(outputText).toContain(NOTE_SYSTEM_REAL_AI_OBSERVATION);
        expect(commandText).not.toMatch(/\b(?:mkdir|cat|tee|printf)\b[^\n]*\/notes\//u);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 360_000 },
  );
});
