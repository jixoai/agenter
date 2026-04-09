import { createServer as createNetServer } from "node:net";

import type { MessageControlPlane, MessageRecord } from "@agenter/message-system";

import type { ChatMessage, SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import type { RealKernelHarness } from "./real-kernel-harness";
import { waitForRealValue } from "./real-kernel-harness";

const DEFAULT_TIMEOUT_MS = 120_000;
const REAL_ROOM_DELIVERY_TIMEOUT_MS = 240_000;
const REAL_ROOM_APP_V1_MARKERS = ["REAL-ROOM-APP-V1", "BUTTON-LABEL-V1", "STATUS-V1"] as const;
const REAL_ROOM_APP_V2_MARKERS = ["REAL-ROOM-APP-V2", "BUTTON-LABEL-V2", "FEEDBACK-APPLIED"] as const;
const REAL_ROOM_URL_PATTERN = /https?:\/\/127\.0\.0\.1:\d+\/?/u;
const chatScenarioAttentionScope = excludeActiveContextPrefixes("ctx-task-source-");

const getPrimaryRoomId = (harness: RealKernelHarness): string => {
  if (!harness.session.primaryRoomId) {
    throw new Error(`missing primaryRoomId for session ${harness.session.id}`);
  }
  return harness.session.primaryRoomId;
};

const getMessageControlPlane = (harness: RealKernelHarness): MessageControlPlane =>
  Reflect.get(harness.kernel, "messageControlPlane") as MessageControlPlane;

const allocateEphemeralPort = async (): Promise<number> => {
  const server = createNetServer();
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
  if (!port) {
    throw new Error("failed to allocate delivery port");
  }
  return port;
};

const toChatMessage = (harness: RealKernelHarness, message: MessageRecord): ChatMessage => ({
  id: message.messageId,
  chatId: message.chatId,
  role: message.from === harness.session.avatar ? "assistant" : "user",
  content: message.content,
  timestamp: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
});

const listRoomTruthMessages = (harness: RealKernelHarness): ChatMessage[] =>
  harness.kernel
    .listMessageChannels(harness.session.id)
    .flatMap((channel) => getMessageControlPlane(harness).snapshot(channel.chatId, 50).items.map((item) => toChatMessage(harness, item)))
    .sort((left, right) => left.timestamp - right.timestamp);

const getAssistantMessages = (messages: ChatMessage[], predicate: (message: ChatMessage) => boolean): ChatMessage[] =>
  messages.filter((message) => message.role === "assistant" && predicate(message));

const waitForAssistantMessage = async (
  harness: RealKernelHarness,
  input: {
    label: string;
    predicate: (message: ChatMessage) => boolean;
    timeoutMs?: number;
  },
): Promise<ChatMessage> =>
  await waitForRealValue(
    () => getAssistantMessages(listRoomTruthMessages(harness), input.predicate).at(-1) ?? null,
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const waitForAttentionSettled = async (harness: RealKernelHarness, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  await waitForScopedAttentionSettled(
    async () => await harness.kernel.inspectAttentionState(harness.session.id),
    waitForRealValue,
    chatScenarioAttentionScope,
    timeoutMs,
  );

const listRecentModelCallRecords = async (harness: RealKernelHarness) =>
  (await harness.kernel.inspectModelDebug(harness.session.id)).recentModelCalls;

const waitForModelCallsAfter = async (
  harness: RealKernelHarness,
  input: {
    afterTimestamp: number;
    label: string;
    timeoutMs?: number;
  },
) =>
  await waitForRealValue(
    async () => {
      const calls = await listRecentModelCallRecords(harness);
      const relevant = calls.filter((call) => call.createdAt >= input.afterTimestamp);
      const latest = relevant.at(-1) ?? null;
      if (!latest || latest.status === "running") {
        return null;
      }
      return relevant;
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const extractToolTraceTools = (call: { response?: unknown }): string[] => {
  const response = call.response;
  if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) =>
    typeof entry === "object" && entry !== null && "tool" in entry && typeof entry.tool === "string" ? [entry.tool] : [],
  );
};

const extractLocalDeliveryUrl = (content: string): string | null => content.match(REAL_ROOM_URL_PATTERN)?.[0] ?? null;

const fetchUrlWithMarkers = async (
  url: string,
  markers: readonly string[],
): Promise<{ ok: true; status: number; body: string } | { ok: false; status?: number; body?: string; error: string }> => {
  try {
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body,
        error: `unexpected status ${response.status}`,
      };
    }
    const missingMarkers = markers.filter((marker) => !body.includes(marker));
    if (missingMarkers.length > 0) {
      return {
        ok: false,
        status: response.status,
        body,
        error: `missing markers: ${missingMarkers.join(", ")}`,
      };
    }
    return {
      ok: true,
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const waitForUrlMarkers = async (
  url: string,
  markers: readonly string[],
  input: {
    label: string;
    timeoutMs?: number;
    onObservation?: (observation: { status?: number; body?: string; error: string } | null) => void;
  },
): Promise<{ status: number; body: string }> =>
  await waitForRealValue(
    async () => {
      const observed = await fetchUrlWithMarkers(url, markers);
      if (!observed.ok) {
        input.onObservation?.({
          status: observed.status,
          body: observed.body,
          error: observed.error,
        });
        return null;
      }
      input.onObservation?.({
        status: observed.status,
        body: observed.body,
        error: "",
      });
      return {
        status: observed.status,
        body: observed.body,
      };
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? REAL_ROOM_DELIVERY_TIMEOUT_MS,
    },
  );

export interface RealRoomTerminalDeliveryDiagnostics {
  lastDeliveryUrl: string | null;
  lastFetchObservation: {
    status?: number;
    body?: string;
    error: string;
  } | null;
  terminals: Array<{
    terminalId: string;
    running: boolean;
    cwd?: string;
    focused?: boolean;
    title?: string;
  }>;
  activeContexts: Array<{
    contextId: string;
    scoreMap: Record<string, number>;
  }>;
  chatMessages: ChatMessage[];
  recentModelCalls: Array<{
    id: number;
    cycleId: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
    tools: string[];
  }>;
}

export interface RealRoomTerminalDeliveryScenarioResult {
  acknowledgement: ChatMessage;
  deliveryMessage: ChatMessage;
  updateMessage: ChatMessage;
  deliveryUrl: string;
  initialBody: string;
  updatedBody: string;
  feedbackPrompt: string;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
}

const collectRealRoomTerminalDeliveryDiagnostics = async (
  harness: RealKernelHarness,
  state: {
    lastDeliveryUrl: string | null;
    lastFetchObservation: RealRoomTerminalDeliveryDiagnostics["lastFetchObservation"];
  },
): Promise<RealRoomTerminalDeliveryDiagnostics> => {
  const attention = await harness.kernel.inspectAttentionState(harness.session.id);
  const recentModelCalls = await listRecentModelCallRecords(harness);
  return {
    lastDeliveryUrl: state.lastDeliveryUrl,
    lastFetchObservation: state.lastFetchObservation,
    terminals: harness.kernel.listTerminals(harness.session.id).map((terminal) => ({
      terminalId: terminal.terminalId,
      running: terminal.running,
      cwd: terminal.cwd,
      focused: terminal.focused,
      title: terminal.title,
    })),
    activeContexts: attention.active.map((match) => ({
      contextId: match.contextId,
      scoreMap: match.context.scoreMap,
    })),
    chatMessages: listRoomTruthMessages(harness),
    recentModelCalls: recentModelCalls.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: call.outcome?.code ?? null,
      tools: extractToolTraceTools(call),
    })),
  };
};

export const runRealRoomTerminalDeliveryScenario = async (
  harness: RealKernelHarness,
): Promise<RealRoomTerminalDeliveryScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const port = await allocateEphemeralPort();
  const url = `http://127.0.0.1:${port}/`;
  const startAt = Date.now();
  const debugState: {
    lastDeliveryUrl: string | null;
    lastFetchObservation: RealRoomTerminalDeliveryDiagnostics["lastFetchObservation"];
  } = {
    lastDeliveryUrl: null,
    lastFetchObservation: null,
  };

  try {
    const prompt = [
      "你正在参与一个真实交付测试，目标是验证 Room + Terminal + URL 交付闭环。",
      `你只能在房间 ${primaryRoomId} 与用户沟通。`,
      "第 1 步：立刻发送一条以 APP-ACK: 开头的简短中文消息，表示你开始构建。",
      "第 2 步：必须使用 terminal 工具在当前工作目录创建一个最小静态网页应用。",
      `初版页面必须同时包含这些精确字符串：${REAL_ROOM_APP_V1_MARKERS.join(", ")}。`,
      `第 3 步：必须把应用启动在 ${url}，只能监听 127.0.0.1，不要换端口。`,
      `第 4 步：在发链接前，先用 terminal 工具自行验证 ${url} 可访问。`,
      `第 5 步：验证通过后，只发送一条以 APP-URL: 开头并包含精确 URL ${url} 的消息。`,
      "第 6 步：收到用户反馈后，在同一个 URL 上修改应用，不要换端口。",
      `反馈完成后的页面必须同时包含这些精确字符串：${REAL_ROOM_APP_V2_MARKERS.join(", ")}。`,
      `修改完成后，再自行验证 ${url} 可访问，然后只发送一条以 APP-UPDATED: 开头并包含同一个 URL ${url} 的消息。`,
      "除了 APP-ACK / APP-URL / APP-UPDATED 这三类消息，不要发送多余的用户可见消息。",
      "每轮工作完成后都要收敛 attention。",
    ].join("\n");
    const sent = await harness.kernel.sendChat(harness.session.id, prompt);
    if (!sent.ok) {
      throw new Error(`failed to send room-terminal delivery prompt: ${sent.reason ?? "unknown"}`);
    }

    const acknowledgement = await waitForAssistantMessage(harness, {
      label: "room-terminal acknowledgement",
      predicate: (message) =>
        message.chatId === primaryRoomId &&
        message.timestamp >= startAt &&
        message.content.trim().startsWith("APP-ACK:"),
      timeoutMs: REAL_ROOM_DELIVERY_TIMEOUT_MS,
    });

    const deliveryMessage = await waitForAssistantMessage(harness, {
      label: "room-terminal delivery url message",
      predicate: (message) =>
        message.chatId === primaryRoomId &&
        message.timestamp > acknowledgement.timestamp &&
        message.content.trim().startsWith("APP-URL:") &&
        extractLocalDeliveryUrl(message.content) === url,
      timeoutMs: REAL_ROOM_DELIVERY_TIMEOUT_MS,
    });

    debugState.lastDeliveryUrl = url;
    const initialFetch = await waitForUrlMarkers(url, REAL_ROOM_APP_V1_MARKERS, {
      label: "initial tiny-app delivery body",
      timeoutMs: REAL_ROOM_DELIVERY_TIMEOUT_MS,
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    const feedbackPrompt = [
      `我已经打开了 ${url}。`,
      "请继续在同一个 URL 上修改这个应用，不要换端口。",
      `请把页面更新为同时包含这些精确字符串：${REAL_ROOM_APP_V2_MARKERS.join(", ")}。`,
      `完成后只发送一条以 APP-UPDATED: 开头并包含同一个 URL ${url} 的消息。`,
    ].join("\n");
    const feedbackSent = await harness.kernel.sendChat(harness.session.id, feedbackPrompt);
    if (!feedbackSent.ok) {
      throw new Error(`failed to send room-terminal feedback: ${feedbackSent.reason ?? "unknown"}`);
    }
    const feedbackSentAt = Date.now();

    const updateMessage = await waitForAssistantMessage(harness, {
      label: "room-terminal update acknowledgement",
      predicate: (message) =>
        message.chatId === primaryRoomId &&
        message.timestamp >= feedbackSentAt &&
        message.content.trim().startsWith("APP-UPDATED:") &&
        extractLocalDeliveryUrl(message.content) === url,
      timeoutMs: REAL_ROOM_DELIVERY_TIMEOUT_MS,
    });

    const updatedFetch = await waitForUrlMarkers(url, REAL_ROOM_APP_V2_MARKERS, {
      label: "updated tiny-app delivery body",
      timeoutMs: REAL_ROOM_DELIVERY_TIMEOUT_MS,
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    const settledAttention = await waitForAttentionSettled(harness, REAL_ROOM_DELIVERY_TIMEOUT_MS);
    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "room-terminal model call completion",
      timeoutMs: REAL_ROOM_DELIVERY_TIMEOUT_MS,
    });

    return {
      acknowledgement,
      deliveryMessage,
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
        outcome: call.outcome?.code ?? null,
      })),
      toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
    };
  } catch (error) {
    const diagnostics = await collectRealRoomTerminalDeliveryDiagnostics(harness, debugState);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`real room-terminal delivery scenario failed: ${message}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
};
