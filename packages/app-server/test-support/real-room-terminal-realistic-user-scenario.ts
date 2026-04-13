import type { ChatMessage, SessionRuntimeAttentionState } from "../src";
import type { RealKernelHarness } from "./real-kernel-harness";
import {
  allocateEphemeralPort,
  REAL_ROOM_DELIVERY_TIMEOUT_MS,
  REAL_ROOM_DELIVERY_SCENARIO_TIMEOUT_MS,
  createScenarioBudget,
  extractLocalDeliveryUrl,
  extractToolTraceTools,
  getPrimaryRoomId,
  listRoomTruthMessages,
  projectModelCallDiagnostics,
  readModelOutcomeCode,
  waitForAssistantMessage,
  waitForAttentionSettled,
  waitForModelCallsAfter,
  waitForUrlMarkers,
} from "./real-room-terminal-delivery-scenario";

const REALISTIC_ROOM_APP_V1_MARKERS = ["周末喝水提醒", "点我一下", "今天先从第一杯开始"] as const;
const REALISTIC_ROOM_APP_V2_MARKERS = ["周末喝水提醒", "继续喝水", "已根据反馈更新"] as const;

export interface RealRoomTerminalRealisticUserDiagnostics {
  phase: string;
  lastDeliveryUrl: string | null;
  lastFetchObservation: {
    status?: number;
    body?: string;
    error: string;
  } | null;
  chatMessages: ChatMessage[];
  activeContexts: Array<{
    contextId: string;
    scoreMap: Record<string, number>;
  }>;
  terminals: Array<{
    terminalId: string;
    running: boolean;
    cwd?: string;
    focused?: boolean;
    title?: string;
  }>;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
    assistantText?: string;
    tools: string[];
    toolTrace: Array<{
      tool: string;
      input: unknown;
      output?: unknown;
      error: string | null;
    }>;
  }>;
}

export interface RealRoomTerminalRealisticUserScenarioResult {
  startedAt: number;
  acknowledgement: ChatMessage;
  deliveryMessage: ChatMessage;
  feedbackSentAt: number;
  updateMessage: ChatMessage;
  deliveryUrl: string;
  initialBody: string;
  updatedBody: string;
  feedbackPrompt: string;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
}

const collectDiagnostics = async (
  harness: RealKernelHarness,
  state: {
    phase: string;
    lastDeliveryUrl: string | null;
    lastFetchObservation: RealRoomTerminalRealisticUserDiagnostics["lastFetchObservation"];
  },
): Promise<RealRoomTerminalRealisticUserDiagnostics> => {
  const attention = await harness.kernel.inspectAttentionState(harness.session.id);
  const recentModelCalls = (await harness.kernel.inspectModelDebug(harness.session.id)).recentModelCalls;
  return {
    phase: state.phase,
    lastDeliveryUrl: state.lastDeliveryUrl,
    lastFetchObservation: state.lastFetchObservation,
    chatMessages: listRoomTruthMessages(harness),
    activeContexts: attention.active.map((match) => ({
      contextId: match.contextId,
      scoreMap: match.context.scoreMap,
    })),
    terminals: harness.kernel.listTerminals(harness.session.id).map((terminal) => ({
      terminalId: terminal.terminalId,
      running: terminal.running,
      cwd: terminal.cwd,
      focused: terminal.focused,
      title: terminal.title,
    })),
    recentModelCalls: projectModelCallDiagnostics(recentModelCalls),
  };
};

export const runRealRoomTerminalRealisticUserScenario = async (
  harness: RealKernelHarness,
): Promise<RealRoomTerminalRealisticUserScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const port = await allocateEphemeralPort();
  const url = `http://127.0.0.1:${port}/`;
  const startAt = Date.now();
  const budget = createScenarioBudget("realistic room-terminal scenario", REAL_ROOM_DELIVERY_SCENARIO_TIMEOUT_MS);
  const debugState: {
    phase: string;
    lastDeliveryUrl: string | null;
    lastFetchObservation: RealRoomTerminalRealisticUserDiagnostics["lastFetchObservation"];
  } = {
    phase: "prepare initial prompt",
    lastDeliveryUrl: null,
    lastFetchObservation: null,
  };

  try {
    const prompt = [
      "你好，我想要一个很简单的小网页，准备发给朋友看。",
      `我这边只会打开这个本地链接：${url}，所以请你用这个链接把页面真正跑起来，不要换端口。`,
      "页面里请帮我放上标题“周末喝水提醒”，一个按钮写“点我一下”，再放一句“今天先从第一杯开始”。",
      "如果这个链接暂时还打不开，你就继续处理，直到我能打开它为止。",
      "我不懂技术，你直接做好并把能打开的那个链接发我就行，不要只说你在处理中。",
      "你给我的用户可见回复请保持简短中文。",
      "不要先打开任何 `.runtime-skills/*/SKILL.md`，也不要先用 ccski info 浏览技能说明；先做直接命令。",
      `当前房间 chatId 就是 ${primaryRoomId}；如果需要发确认或交付消息，直接用这个 chatId，不要先跑 message list/read。`,
      "如果某个命令格式不确定，先直接看该命令的 --help；只有在连命令族都不清楚时才考虑 ccski info。",
    ].join("\n");
    const sent = await harness.kernel.sendChat(harness.session.id, prompt);
    if (!sent.ok) {
      throw new Error(`failed to send realistic room-terminal prompt: ${sent.reason ?? "unknown"}`);
    }

    debugState.phase = "wait acknowledgement";
    const acknowledgement = await waitForAssistantMessage(harness, {
      label: "realistic room-terminal acknowledgement",
      predicate: (message) =>
        message.chatId === primaryRoomId &&
        message.timestamp >= startAt &&
        message.content.trim().length > 0 &&
        extractLocalDeliveryUrl(message.content) === null,
      timeoutMs: budget.step("realistic acknowledgement", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.phase = "wait delivery url";
    const deliveryMessage = await waitForAssistantMessage(harness, {
      label: "realistic room-terminal delivery",
      predicate: (message) =>
        message.chatId === primaryRoomId &&
        message.timestamp > acknowledgement.timestamp &&
        extractLocalDeliveryUrl(message.content) === url,
      timeoutMs: budget.step("realistic delivery url", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.lastDeliveryUrl = url;
    debugState.phase = "verify initial url";
    const initialFetch = await waitForUrlMarkers(url, REALISTIC_ROOM_APP_V1_MARKERS, {
      label: "realistic tiny-app delivery body",
      timeoutMs: budget.step("realistic initial tiny-app delivery body", REAL_ROOM_DELIVERY_TIMEOUT_MS),
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    const feedbackPrompt = [
      `我已经打开了 ${url}。`,
      "整体没问题，不过我想改两点。",
      "按钮文字改成“继续喝水”，再加一句“已根据反馈更新”。",
      "还是用同一个链接给我就行；如果新版还没生效，你就继续处理到这个链接能看到新版为止。",
      "改完后直接把这个同一个链接再发我。",
    ].join("\n");
    const feedbackSent = await harness.kernel.sendChat(harness.session.id, feedbackPrompt);
    if (!feedbackSent.ok) {
      throw new Error(`failed to send realistic room-terminal feedback: ${feedbackSent.reason ?? "unknown"}`);
    }
    const feedbackSentAt = Date.now();

    debugState.phase = "wait updated room message";
    const updateMessage = await waitForAssistantMessage(harness, {
      label: "realistic room-terminal update",
      predicate: (message) =>
        message.chatId === primaryRoomId &&
        message.timestamp >= feedbackSentAt &&
        extractLocalDeliveryUrl(message.content) === url,
      timeoutMs: budget.step("realistic updated room message", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.phase = "verify updated url";
    const updatedFetch = await waitForUrlMarkers(url, REALISTIC_ROOM_APP_V2_MARKERS, {
      label: "realistic updated tiny-app body",
      timeoutMs: budget.step("realistic updated tiny-app body", REAL_ROOM_DELIVERY_TIMEOUT_MS),
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    debugState.phase = "wait attention settled";
    const settledAttention = await waitForAttentionSettled(
      harness,
      budget.step("realistic settled attention", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    );
    debugState.phase = "wait model calls complete";
    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "realistic room-terminal model call completion",
      timeoutMs: budget.step("realistic model call completion", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    return {
      startedAt: startAt,
      acknowledgement,
      deliveryMessage,
      feedbackSentAt,
      updateMessage,
      deliveryUrl: url,
      initialBody: initialFetch.body,
      updatedBody: updatedFetch.body,
      feedbackPrompt,
      settledAttention,
      recentModelCalls: modelCallRecords.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
      })),
      toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
    };
  } catch (error) {
    const diagnostics = await collectDiagnostics(harness, debugState);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`realistic room-terminal scenario failed: ${message}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
};
