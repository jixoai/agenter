import { setTimeout as sleep } from "node:timers/promises";

import {
  collectSessionDbMonitorSnapshot,
  copySessionDbSnapshot,
  summarizeAiCallDurations,
} from "../test-support/real-ai-observability";
import { REAL_RELAY_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness } from "../test-support/real-kernel-harness";
import {
  listRoomTruthMessages,
  projectModelCallDiagnostics,
} from "../test-support/real-room-terminal-delivery-scenario";
import { runRealLunchRelayScenario } from "../test-support/real-loopbus-scenarios";

const POLL_MS = 15_000;

const main = async (): Promise<void> => {
  const harness = await createRealKernelHarness({
    sessionName: "debug-real-loopbus-relay",
    avatarNickname: REAL_RELAY_AVATAR_PROFILE.nickname,
    agenterPromptContent: REAL_RELAY_AVATAR_PROFILE.prompt,
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

  const startedAt = Date.now();
  let polling = true;
  const poll = (async () => {
    let tick = 0;
    while (polling) {
      await sleep(POLL_MS);
      if (!polling) {
        break;
      }
      tick += 1;
      const ledger = collectSessionDbMonitorSnapshot(harness.session.sessionRoot);
      const calls = (await harness.kernel.inspectModelDebug(harness.session.id)).recentModelCalls;
      const latest = calls.at(-1) ?? null;
      const latestRoom = listRoomTruthMessages(harness).at(-1) ?? null;
      console.log(
        JSON.stringify(
          {
            type: "monitor",
            tick,
            elapsedSec: Math.round((Date.now() - startedAt) / 1_000),
            counts: ledger.counts,
            aiCalls: ledger.aiCalls,
            latestCall:
              latest === null
                ? null
                : {
                    id: latest.id,
                    cycleId: latest.cycleId,
                    status: latest.status,
                    tools:
                      latest.response && typeof latest.response === "object" && "toolTrace" in latest.response
                        ? ((latest.response.toolTrace as Array<{ tool?: string }> | undefined) ?? [])
                            .flatMap((entry) => (typeof entry.tool === "string" ? [entry.tool] : []))
                        : [],
                  },
            latestRoom,
          },
          null,
          2,
        ),
      );
    }
  })();

  try {
    const result = await runRealLunchRelayScenario(harness);
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
          relayChannel: result.relayChannel.chatId,
          originAcknowledgement: result.originAcknowledgement,
          relayPromptMessage: result.relayPromptMessage,
          relayParticipantReply: result.relayParticipantReply,
          finalReply: result.finalReply,
          activeAfterRelay: result.activeAfterRelay.active.map((match) => ({
            contextId: match.contextId,
            focusState: match.context.focusState,
            scoreMap: match.context.scoreMap,
          })),
          settledAttention: result.settledAttention.active.map((match) => ({
            contextId: match.contextId,
            focusState: match.context.focusState,
            scoreMap: match.context.scoreMap,
          })),
          recentModelCalls: result.recentModelCalls,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    polling = false;
    await poll;
    const runtime = harness.kernel.getSnapshot().runtimes[harness.session.id] ?? null;
    const attention = await harness.kernel.inspectAttentionState(harness.session.id);
    const modelDebug = await harness.kernel.inspectModelDebug(harness.session.id);
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
          chatMessages:
            runtime?.chatMessages.map((message) => ({
              chatId: message.chatId,
              role: message.role,
              content: message.content,
              timestamp: message.timestamp,
            })) ?? [],
          activeContexts: attention.active.map((match) => ({
            contextId: match.contextId,
            focusState: match.context.focusState,
            scoreMap: match.context.scoreMap,
            content: match.context.content,
            recentCommits: match.recentCommits.map((commit) => ({
              commitId: commit.commitId,
              summary: commit.summary,
              systemId: commit.meta.systemId,
              subjectId: commit.meta.subjectId,
              channelId: commit.meta.channelId,
              scores: commit.scores,
              egress: commit.egress,
              createdAt: commit.createdAt,
            })),
          })),
          modelDiagnostics: projectModelCallDiagnostics(modelDebug.recentModelCalls),
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
