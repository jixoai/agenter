import { setTimeout as sleep } from "node:timers/promises";

import {
  collectSessionDbMonitorSnapshot,
  createTeamMonitorStartRecord,
  copySessionDbSnapshot,
  summarizeAiCallDurations,
} from "../test-support/real-ai-observability";
import {
  REAL_TEAM_BACKEND_AVATAR_PROFILE,
  REAL_TEAM_FRONTEND_AVATAR_PROFILE,
} from "../test-support/real-ai-test-personas";
import { createRealTeamKernelHarness, type RealTeamProjectRoom } from "../test-support/real-team-kernel-harness";
import { runRealProjectRoomCollaborationScenario } from "../test-support/real-project-room-collaboration-scenario";
import { runRealProjectRoomRealisticUserScenario } from "../test-support/real-project-room-realistic-user-scenario";

const scenario = process.argv[2] === "realistic-user" ? "realistic-user" : "collaboration";
const POLL_MS = 15_000;
const MAX_POLLS = 48;

const extractToolTraceTools = (response: unknown): string[] => {
  if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) =>
    typeof entry === "object" && entry !== null && "tool" in entry && typeof entry.tool === "string"
      ? [entry.tool]
      : [],
  );
};

const readOutcomeCode = (outcome: unknown): string | null => {
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
    return typeof outcome === "string" ? outcome : null;
  }
  return typeof (outcome as { code?: unknown }).code === "string" ? (outcome as { code: string }).code : null;
};

const resolveLatestProjectRoom = (
  harness: NonNullable<Awaited<ReturnType<typeof createRealTeamKernelHarness>>>,
): Pick<RealTeamProjectRoom, "room"> | null => {
  const expectedTitle = scenario === "realistic-user" ? "realistic-project-room" : "real-project-room";
  const room =
    harness.kernel
      .listGlobalRooms({
        actorId: harness.userActorId,
        includeArchived: true,
      })
      .filter((entry) => entry.title === expectedTitle)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .at(0) ?? null;
  return room ? { room } : null;
};

const listParticipantCalls = async (
  harness: NonNullable<Awaited<ReturnType<typeof createRealTeamKernelHarness>>>,
  sessionId: string,
) => (await harness.kernel.inspectModelDebug(sessionId)).recentModelCalls;

const main = async (): Promise<void> => {
  const harness = await createRealTeamKernelHarness({
    backendAvatar: REAL_TEAM_BACKEND_AVATAR_PROFILE.nickname,
    backendPromptContent: REAL_TEAM_BACKEND_AVATAR_PROFILE.prompt,
    frontendAvatar: REAL_TEAM_FRONTEND_AVATAR_PROFILE.nickname,
    frontendPromptContent: REAL_TEAM_FRONTEND_AVATAR_PROFILE.prompt,
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
      createTeamMonitorStartRecord({
        scenario,
        workspacePath: harness.workspacePath,
        backend: {
          sessionId: harness.backendSession.id,
          avatarNickname: harness.backendSession.avatar ?? REAL_TEAM_BACKEND_AVATAR_PROFILE.nickname,
          avatarPromptPath: harness.backendAvatarPromptPath,
        },
        frontend: {
          sessionId: harness.frontendSession.id,
          avatarNickname: harness.frontendSession.avatar ?? REAL_TEAM_FRONTEND_AVATAR_PROFILE.nickname,
          avatarPromptPath: harness.frontendAvatarPromptPath,
        },
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
      const [backendLedger, frontendLedger, backendCalls, frontendCalls] = await Promise.all([
        collectSessionDbMonitorSnapshot(harness.backendSession.sessionRoot),
        collectSessionDbMonitorSnapshot(harness.frontendSession.sessionRoot),
        listParticipantCalls(harness, harness.backendSession.id),
        listParticipantCalls(harness, harness.frontendSession.id),
      ]);
      const room = resolveLatestProjectRoom(harness);
      const latestRoomMessage = room ? harness.listProjectRoomMessages(room, 120).at(-1) ?? null : null;
      const backendLatest = backendCalls.at(-1) ?? null;
      const frontendLatest = frontendCalls.at(-1) ?? null;
      console.log(
        JSON.stringify(
          {
            poll: index + 1,
            scenario,
            elapsedMs: Date.now() - startedAt,
            backend: {
              sessionId: harness.backendSession.id,
              counts: backendLedger.counts,
              aiCalls: backendLedger.aiCalls,
              latestCall:
                backendLatest === null
                  ? null
                  : {
                      id: backendLatest.id,
                      cycleId: backendLatest.cycleId,
                      status: backendLatest.status,
                      outcome: readOutcomeCode(backendLatest.outcome),
                      tools: extractToolTraceTools(backendLatest.response),
                    },
            },
            frontend: {
              sessionId: harness.frontendSession.id,
              counts: frontendLedger.counts,
              aiCalls: frontendLedger.aiCalls,
              latestCall:
                frontendLatest === null
                  ? null
                  : {
                      id: frontendLatest.id,
                      cycleId: frontendLatest.cycleId,
                      status: frontendLatest.status,
                      outcome: readOutcomeCode(frontendLatest.outcome),
                      tools: extractToolTraceTools(frontendLatest.response),
                    },
            },
            latestRoomMessage:
              latestRoomMessage === null
                ? null
                : {
                    chatId: latestRoomMessage.chatId,
                    senderActorId: latestRoomMessage.senderActorId,
                    content: latestRoomMessage.content,
                    createdAt: latestRoomMessage.createdAt,
                  },
          },
          null,
          2,
        ),
      );
    }
  })();

  try {
    const result =
      scenario === "realistic-user"
        ? await runRealProjectRoomRealisticUserScenario(harness)
        : await runRealProjectRoomCollaborationScenario(harness);
    polling = false;
    await poll;
    const [backendDbSnapshot, frontendDbSnapshot] = await Promise.all([
      copySessionDbSnapshot({
        sessionRoot: harness.backendSession.sessionRoot,
        fileName: `${harness.backendSession.id}.session.db`,
      }),
      copySessionDbSnapshot({
        sessionRoot: harness.frontendSession.sessionRoot,
        fileName: `${harness.frontendSession.id}.session.db`,
      }),
    ]);
    console.log(
      JSON.stringify(
        {
          ok: true,
          scenario,
          workspacePath: harness.workspacePath,
          projectRoomId: result.projectRoom.room.chatId,
          deliveryUrl: result.deliveryUrl,
          backend: {
            sessionId: harness.backendSession.id,
            avatarPromptPath: harness.backendAvatarPromptPath,
            dbSnapshot: backendDbSnapshot,
            aiCallDurations: summarizeAiCallDurations(harness.backendSession.sessionRoot),
          },
          frontend: {
            sessionId: harness.frontendSession.id,
            avatarPromptPath: harness.frontendAvatarPromptPath,
            dbSnapshot: frontendDbSnapshot,
            aiCallDurations: summarizeAiCallDurations(harness.frontendSession.sessionRoot),
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    polling = false;
    await poll;
    const room = resolveLatestProjectRoom(harness);
    const latestRoomMessages = room ? harness.listProjectRoomMessages(room, 120).slice(-12) : [];
    const [backendCalls, frontendCalls, backendDbSnapshot, frontendDbSnapshot] = await Promise.all([
      listParticipantCalls(harness, harness.backendSession.id),
      listParticipantCalls(harness, harness.frontendSession.id),
      copySessionDbSnapshot({
        sessionRoot: harness.backendSession.sessionRoot,
        fileName: `${harness.backendSession.id}.failed.session.db`,
      }),
      copySessionDbSnapshot({
        sessionRoot: harness.frontendSession.sessionRoot,
        fileName: `${harness.frontendSession.id}.failed.session.db`,
      }),
    ]);
    console.error(
      JSON.stringify(
        {
          ok: false,
          scenario,
          error: error instanceof Error ? error.message : String(error),
          workspacePath: harness.workspacePath,
          projectRoomId: room?.room.chatId ?? null,
          latestRoomMessages,
          backend: {
            sessionId: harness.backendSession.id,
            avatarPromptPath: harness.backendAvatarPromptPath,
            dbSnapshot: backendDbSnapshot,
            aiCallDurations: summarizeAiCallDurations(harness.backendSession.sessionRoot),
            recentModelCalls: backendCalls.slice(-8).map((call) => ({
              id: call.id,
              cycleId: call.cycleId,
              status: call.status,
              outcome: readOutcomeCode(call.outcome),
              tools: extractToolTraceTools(call.response),
            })),
          },
          frontend: {
            sessionId: harness.frontendSession.id,
            avatarPromptPath: harness.frontendAvatarPromptPath,
            dbSnapshot: frontendDbSnapshot,
            aiCallDurations: summarizeAiCallDurations(harness.frontendSession.sessionRoot),
            recentModelCalls: frontendCalls.slice(-8).map((call) => ({
              id: call.id,
              cycleId: call.cycleId,
              status: call.status,
              outcome: readOutcomeCode(call.outcome),
              tools: extractToolTraceTools(call.response),
            })),
          },
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
