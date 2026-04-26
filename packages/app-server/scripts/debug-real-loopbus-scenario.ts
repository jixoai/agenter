import { createRealKernelHarness } from "../test-support/real-kernel-harness";
import {
  REAL_EXTERNAL_FACT_AVATAR_PROFILE,
  REAL_RELAY_AVATAR_PROFILE,
} from "../test-support/real-ai-test-personas";
import {
  runRealCompactFollowUpScenario,
  runRealInterleavedCanInputScenario,
  runRealLunchRelayScenario,
  runRealWeatherThroughTerminalScenario,
} from "../test-support/real-loopbus-scenarios";
import { listRoomTruthMessages, projectModelCallDiagnostics } from "../test-support/real-room-terminal-delivery-scenario";

const scenario = process.argv[2] ?? "relay";
const clipText = (value: string, maxChars = 1_600): string =>
  value.length <= maxChars ? value : `${value.slice(0, maxChars)}\n...<clipped ${value.length - maxChars} chars>`;

const dumpFailure = async (harness: NonNullable<Awaited<ReturnType<typeof createRealKernelHarness>>>) => {
  const runtime = harness.kernel.getSnapshot().runtimes[harness.session.id] ?? null;
  const attention = await harness.kernel.inspectAttentionState(harness.session.id);
  const modelDebug = await harness.kernel.inspectModelDebug(harness.session.id);
  return {
    schedulerPhase: runtime?.schedulerPhase ?? null,
    stage: runtime?.stage ?? null,
    runtimeChatMessages:
      runtime?.chatMessages.map((message) => ({
        chatId: message.chatId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      })) ?? [],
    roomTruthMessages: listRoomTruthMessages(harness),
    activeContexts: attention.active.map((match) => ({
      contextId: match.contextId,
      focusState: match.context.focusState,
      scoreMap: match.context.scoreMap,
      content: match.context.content,
      recentCommits: match.recentCommits.map((commit) => ({
        commitId: commit.commitId,
        summary: commit.summary,
        src: commit.meta.src,
        scores: commit.scores,
        target: commit.target ?? null,
        createdAt: commit.createdAt,
      })),
    })),
    modelDiagnostics: projectModelCallDiagnostics(modelDebug.recentModelCalls),
    rawModelCalls: modelDebug.recentModelCalls.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      createdAt: call.createdAt,
      status: call.status,
      request: clipText(JSON.stringify(call.request)),
      decision:
        call.response && typeof call.response === "object" && "decision" in call.response
          ? call.response.decision
          : null,
    })),
  };
};

const main = async (): Promise<void> => {
  const profile =
    scenario === "relay" || scenario === "compact"
      ? REAL_RELAY_AVATAR_PROFILE
      : scenario === "weather"
        ? REAL_EXTERNAL_FACT_AVATAR_PROFILE
        : null;
  const harness = await createRealKernelHarness({
    sessionName: `debug-real-loopbus-${scenario}`,
    avatarNickname: profile?.nickname,
    agenterPromptContent: profile?.prompt,
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

  try {
    let result: unknown;
    if (scenario === "relay") {
      result = await runRealLunchRelayScenario(harness);
    } else if (scenario === "compact") {
      const relay = await runRealLunchRelayScenario(harness);
      result = {
        relay,
        followUp: await runRealCompactFollowUpScenario(harness, {
          relayChannel: relay.relayChannel,
          afterReplyTimestamp: relay.finalReply.timestamp,
        }),
      };
    } else if (scenario === "weather") {
      result = await runRealWeatherThroughTerminalScenario(harness);
    } else if (scenario === "interleaved") {
      result = await runRealInterleavedCanInputScenario(harness);
    } else {
      throw new Error(`unknown scenario: ${scenario}`);
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          scenario,
          result,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          scenario,
          error: error instanceof Error ? error.message : String(error),
          diagnostics: await dumpFailure(harness),
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
