import { createRealKernelHarness } from "../test-support/real-kernel-harness";
import {
  runRealLunchRelayScenario,
  runRealSimpleReplyScenario,
} from "../test-support/real-loopbus-scenarios";

const printSection = (title: string, value: unknown): void => {
  console.log(`\n## ${title}`);
  console.log(JSON.stringify(value, null, 2));
};

const main = async (): Promise<void> => {
  const harness = await createRealKernelHarness({
    sessionName: "real-loopbus-story",
    logger: {
      log: (line) => {
        if (line.message.includes("session.abort")) {
          return;
        }
        if (line.level === "error" || line.level === "warn") {
          console.error(`[${line.level}] ${line.message}`, line.meta ?? {});
        }
      },
    },
  });
  if (!harness) {
    console.error("Real AI config not found. Expected ~/.agenter/settings.json, demo/.env, or AGENTER_REAL_AI_* env.");
    process.exitCode = 1;
    return;
  }

  try {
    printSection("Harness", {
      sessionId: harness.session.id,
      workspacePath: harness.workspacePath,
      cacheDir: harness.proxy?.cacheDir ?? null,
      provider: harness.config.vendor,
      model: harness.config.model,
      baseUrl: harness.config.baseUrl,
      apiStandard: harness.config.apiStandard,
      proxyMode: harness.proxy ? "cached" : "direct",
    });

    const simple = await runRealSimpleReplyScenario(harness);
    printSection("Simple Reply", {
      reply: simple.reply,
      activeContexts: simple.settledAttention.active.length,
      recentModelCalls: simple.recentModelCalls,
    });

    try {
      const relay = await runRealLunchRelayScenario(harness);
      printSection("Lunch Relay", {
        relayChannel: relay.relayChannel.chatId,
        relayPrompt: relay.relayPromptMessage.content,
        participantReply: relay.relayParticipantReply.content,
        activeAfterRelay: relay.activeAfterRelay.active.map((match) => ({
          contextId: match.contextId,
          scoreMap: match.context.scoreMap,
        })),
        finalReply: relay.finalReply.content,
        settledContexts: relay.settledAttention.active.length,
        recentModelCalls: relay.recentModelCalls,
      });
    } catch (error) {
      const runtime = harness.kernel.getSnapshot().runtimes[harness.session.id] ?? null;
      const attention = await harness.kernel.inspectAttentionState(harness.session.id);
      const modelDebug = await harness.kernel.inspectModelDebug(harness.session.id);
      printSection("Lunch Relay Failure", {
        error: error instanceof Error ? error.message : String(error),
        chatMessages: runtime?.chatMessages ?? [],
        activeContexts: attention.active.map((match) => ({
          contextId: match.contextId,
          scoreMap: match.context.scoreMap,
        })),
        recentModelCalls: modelDebug.recentModelCalls.map((call) => ({
          id: call.id,
          cycleId: call.cycleId,
          status: call.status,
          outcome: call.outcome?.code ?? null,
        })),
      });
      throw error;
    }
  } finally {
    await harness.stop();
  }
};

await main();
