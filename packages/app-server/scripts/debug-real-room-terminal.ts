import { setTimeout as sleep } from "node:timers/promises";

import {
  collectSessionDbMonitorSnapshot,
  createSingleAvatarMonitorStartRecord,
  copySessionDbSnapshot,
  summarizeRoomTerminalPhaseTimings,
  summarizeAiCallDurations,
} from "../test-support/real-ai-observability";
import { REAL_ROOM_TERMINAL_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness } from "../test-support/real-kernel-harness";
import {
  extractToolTraceTools,
  listRoomTruthMessages,
  projectModelCallDiagnostics,
  readModelOutcomeCode,
  runRealRoomTerminalDeliveryScenario,
} from "../test-support/real-room-terminal-delivery-scenario";

const POLL_MS = 10_000;
const MAX_POLLS = 30;

const main = async (): Promise<void> => {
  const harness = await createRealKernelHarness({
    sessionName: "debug-real-room-terminal",
    avatarNickname: REAL_ROOM_TERMINAL_AVATAR_PROFILE.nickname,
    agenterPromptContent: REAL_ROOM_TERMINAL_AVATAR_PROFILE.prompt,
    logger: {
      log: (line) => {
        if (line.level === "error" || line.level === "warn") {
          console.error(`[${line.level}] ${line.message}`, line.meta ?? {});
        }
      },
    },
  });

  if (!harness) {
    throw new Error("Real AI config not found.");
  }

  console.log(
    JSON.stringify(
      createSingleAvatarMonitorStartRecord({
        scenario: "room-terminal",
        sessionId: harness.session.id,
        sessionRoot: harness.session.sessionRoot,
        workspacePath: harness.workspacePath,
        avatarNickname: harness.avatarNickname,
        avatarPromptPath: harness.avatarPromptPath,
      }),
      null,
      2,
    ),
  );

  const startedAt = Date.now();
  let polling = true;

  const poll = (async () => {
    for (let index = 0; index < MAX_POLLS && polling; index += 1) {
      await sleep(POLL_MS);
      if (!polling) {
        break;
      }
      const ledger = collectSessionDbMonitorSnapshot(harness.session.sessionRoot);
      const runtime = harness.kernel.getSnapshot().runtimes[harness.session.id] ?? null;
      const debug = await harness.kernel.inspectModelDebug(harness.session.id);
      const calls = debug.recentModelCalls;
      const latest = calls.at(-1) ?? null;
      const latestRoom = listRoomTruthMessages(harness).at(-1) ?? null;
      console.log(
        JSON.stringify(
          {
            poll: index + 1,
            elapsedMs: Date.now() - startedAt,
            counts: ledger.counts,
            aiCalls: ledger.aiCalls,
            schedulerPhase: runtime?.schedulerPhase ?? null,
            stage: runtime?.stage ?? null,
            chatMessages: runtime?.chatMessages.map((message) => ({
              chatId: message.chatId,
              role: message.role,
              content: message.content.slice(0, 200),
              timestamp: message.timestamp,
            })),
            latestCall:
              latest === null
                ? null
                : {
                    id: latest.id,
                    cycleId: latest.cycleId,
                    status: latest.status,
                    outcome: readModelOutcomeCode(latest),
                    tools: extractToolTraceTools(latest),
                  },
            latestRoom,
            diagnostics: projectModelCallDiagnostics(calls.slice(-3)),
          },
          null,
          2,
        ),
      );
    }
  })();

  try {
    const result = await runRealRoomTerminalDeliveryScenario(harness);
    polling = false;
    await poll;
    const dbSnapshot = await copySessionDbSnapshot({
      sessionRoot: harness.session.sessionRoot,
      fileName: `${harness.session.id}.session.db`,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          sessionId: harness.session.id,
          sessionRoot: harness.session.sessionRoot,
          avatarNickname: harness.avatarNickname,
          avatarPromptPath: harness.avatarPromptPath,
          dbSnapshot,
          aiCallDurations: summarizeAiCallDurations(harness.session.sessionRoot),
          phaseTimings: summarizeRoomTerminalPhaseTimings({
            startedAt: result.startedAt,
            acknowledgementAt: result.acknowledgement.timestamp,
            deliveryAt: result.deliveryMessage.timestamp,
            feedbackSentAt: result.feedbackSentAt,
            updateAt: result.updateMessage.timestamp,
          }),
          deliveryUrl: result.deliveryUrl,
          toolTraceTools: result.toolTraceTools,
          recentModelCalls: result.recentModelCalls,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    polling = false;
    await poll;
    const debug = await harness.kernel.inspectModelDebug(harness.session.id);
    const runtime = harness.kernel.getSnapshot().runtimes[harness.session.id] ?? null;
    const dbSnapshot = await copySessionDbSnapshot({
      sessionRoot: harness.session.sessionRoot,
      fileName: `${harness.session.id}.failed.session.db`,
    });
    console.error(
      JSON.stringify(
        {
          ok: false,
          sessionId: harness.session.id,
          sessionRoot: harness.session.sessionRoot,
          avatarNickname: harness.avatarNickname,
          avatarPromptPath: harness.avatarPromptPath,
          dbSnapshot,
          aiCallDurations: summarizeAiCallDurations(harness.session.sessionRoot),
          error: error instanceof Error ? error.message : String(error),
          schedulerPhase: runtime?.schedulerPhase ?? null,
          stage: runtime?.stage ?? null,
          diagnostics: projectModelCallDiagnostics(debug.recentModelCalls),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await harness.stop();
  }
};

await main();
