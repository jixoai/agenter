import { createServer as createNetServer } from "node:net";

import type { MessageControlPlane, MessageRecord } from "@agenter/message-system";

import type { ChatMessage, SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import type { RealKernelHarness } from "./real-kernel-harness";
import { waitForRealValue } from "./real-kernel-harness";

export const DEFAULT_TIMEOUT_MS = 120_000;
export const REAL_ROOM_DELIVERY_TIMEOUT_MS = 240_000;
export const REAL_ROOM_DELIVERY_SCENARIO_TIMEOUT_MS = 360_000;
export const REAL_ROOM_APP_V1_MARKERS = ["REAL-ROOM-APP-V1", "BUTTON-LABEL-V1", "STATUS-V1"] as const;
export const REAL_ROOM_APP_V2_MARKERS = ["REAL-ROOM-APP-V2", "BUTTON-LABEL-V2", "FEEDBACK-APPLIED"] as const;
export const REAL_ROOM_URL_PATTERN = /https?:\/\/127\.0\.0\.1:\d+\/?/u;
const chatScenarioAttentionScope = excludeActiveContextPrefixes("ctx-task-source-");
type ModelCallRecord = Awaited<ReturnType<RealKernelHarness["kernel"]["inspectModelDebug"]>>["recentModelCalls"][number];

export const getRoomId = (harness: RealKernelHarness): string => harness.room.chatId;

const getMessageControlPlane = (harness: RealKernelHarness): MessageControlPlane =>
  Reflect.get(harness.kernel, "messageControlPlane") as MessageControlPlane;

const clipText = (value: string | undefined, maxChars = 800): string | undefined => {
  if (value === undefined || value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n...<clipped ${value.length - maxChars} chars>`;
};

type ToolTraceEntry = {
  tool: string;
  input: unknown;
  output?: unknown;
  error?: string;
};

export const readModelOutcomeCode = (call: Pick<ModelCallRecord, "outcome">): string | null => {
  const outcome = call.outcome;
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
    return typeof outcome === "string" ? outcome : null;
  }
  const record = outcome as { code?: unknown };
  return typeof record.code === "string" ? record.code : null;
};

export const projectModelCallDiagnostic = (call: ModelCallRecord) => ({
  id: call.id,
  cycleId: call.cycleId,
  status: call.status,
  outcome: readModelOutcomeCode(call),
  assistantText:
    call.response && typeof call.response === "object" && "assistant" in call.response
      ? clipText((call.response.assistant as { text?: string } | undefined)?.text)
      : undefined,
  tools: extractToolTraceTools(call),
  toolTrace: ((call.response && typeof call.response === "object" && "toolTrace" in call.response
    ? call.response.toolTrace
    : []) as ToolTraceEntry[]).map((entry) => ({
    tool: entry.tool,
    input: entry.input,
    output:
      entry.output && typeof entry.output === "object"
        ? {
            ...(entry.output as Record<string, unknown>),
            ...(typeof (entry.output as { stdout?: unknown }).stdout === "string"
              ? { stdout: clipText((entry.output as { stdout: string }).stdout) }
              : {}),
            ...(typeof (entry.output as { stderr?: unknown }).stderr === "string"
              ? { stderr: clipText((entry.output as { stderr: string }).stderr) }
              : {}),
          }
        : entry.output,
    error: entry.error ?? null,
  })),
});

export const projectModelCallDiagnostics = (calls: readonly ModelCallRecord[]) => calls.map(projectModelCallDiagnostic);

export const createScenarioBudget = (label: string, totalTimeoutMs: number) => {
  const startedAt = Date.now();
  return {
    step(stepLabel: string, requestedTimeoutMs = DEFAULT_TIMEOUT_MS): number {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = totalTimeoutMs - elapsedMs;
      if (remainingMs <= 0) {
        throw new Error(`${label} exhausted total timeout budget before ${stepLabel}`);
      }
      return Math.max(1_000, Math.min(requestedTimeoutMs, remainingMs));
    },
  };
};

export const allocateEphemeralPort = async (): Promise<number> => {
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
  id: String(message.messageId),
  chatId: message.chatId,
  role: message.from === harness.session.avatar ? "assistant" : "user",
  content: message.content,
  timestamp: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
});

export const listRoomTruthMessages = (harness: RealKernelHarness): ChatMessage[] =>
  harness.kernel
    .listMessageChannels(harness.session.id)
    .flatMap((channel) => getMessageControlPlane(harness).snapshot(channel.chatId, 50).items.map((item) => toChatMessage(harness, item)))
    .sort((left, right) => left.timestamp - right.timestamp);

const getAssistantMessages = (messages: ChatMessage[], predicate: (message: ChatMessage) => boolean): ChatMessage[] =>
  messages.filter((message) => message.role === "assistant" && predicate(message));

export const waitForAssistantMessage = async (
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

export const waitForAttentionSettled = async (harness: RealKernelHarness, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  await waitForScopedAttentionSettled(
    async () => await harness.kernel.inspectAttentionState(harness.session.id),
    waitForRealValue,
    chatScenarioAttentionScope,
    timeoutMs,
  );

const listRecentModelCallRecords = async (harness: RealKernelHarness) =>
  (await harness.kernel.inspectModelDebug(harness.session.id)).recentModelCalls;

export const waitForModelCallsAfter = async (
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

export const extractToolTraceTools = (call: { response?: unknown }): string[] => {
  const response = call.response;
  if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) =>
    typeof entry === "object" && entry !== null && "tool" in entry && typeof entry.tool === "string" ? [entry.tool] : [],
  );
};

export const extractLocalDeliveryUrl = (content: string): string | null => content.match(REAL_ROOM_URL_PATTERN)?.[0] ?? null;

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

export const waitForUrlMarkers = async (
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
  phase: string;
  expectedDeliveryPort: number;
  expectedDeliveryUrl: string;
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
  validationResources: Awaited<ReturnType<RealKernelHarness["collectDiagnostics"]>>["validationResources"];
}

export interface RealRoomTerminalDeliveryScenarioResult {
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
  validationResources: Awaited<ReturnType<RealKernelHarness["collectDiagnostics"]>>["validationResources"];
}

const collectRealRoomTerminalDeliveryDiagnostics = async (
  harness: RealKernelHarness,
  state: {
    phase: string;
    expectedDeliveryPort: number;
    expectedDeliveryUrl: string;
    lastDeliveryUrl: string | null;
    lastFetchObservation: RealRoomTerminalDeliveryDiagnostics["lastFetchObservation"];
  },
): Promise<RealRoomTerminalDeliveryDiagnostics> => {
  const attention = await harness.kernel.inspectAttentionState(harness.session.id);
  const recentModelCalls = await listRecentModelCallRecords(harness);
  const harnessDiagnostics = await harness.collectDiagnostics({
    label: "real-room-terminal-delivery-diagnostics",
  });
  return {
    phase: state.phase,
    expectedDeliveryPort: state.expectedDeliveryPort,
    expectedDeliveryUrl: state.expectedDeliveryUrl,
    lastDeliveryUrl: state.lastDeliveryUrl,
    lastFetchObservation: state.lastFetchObservation,
    terminals: harness.kernel.listTerminals(harness.session.id).map((terminal) => ({
      terminalId: terminal.terminalId,
      running: terminal.processPhase === "running",
      cwd: terminal.launchCwd,
      focused: terminal.focused,
      title: terminal.currentTitle ?? terminal.configuredTitle ?? terminal.terminalId,
    })),
    activeContexts: attention.active.map((match) => ({
      contextId: match.contextId,
      scoreMap: match.context.scoreMap,
    })),
    chatMessages: listRoomTruthMessages(harness),
    recentModelCalls: projectModelCallDiagnostics(recentModelCalls),
    validationResources: harnessDiagnostics.validationResources,
  };
};

export const runRealRoomTerminalDeliveryScenario = async (
  harness: RealKernelHarness,
): Promise<RealRoomTerminalDeliveryScenarioResult> => {
  const roomId = getRoomId(harness);
  const port = await allocateEphemeralPort();
  const url = `http://127.0.0.1:${port}/`;
  const startAt = Date.now();
  const budget = createScenarioBudget("real room-terminal delivery scenario", REAL_ROOM_DELIVERY_SCENARIO_TIMEOUT_MS);
  const debugState: {
    phase: string;
    expectedDeliveryPort: number;
    expectedDeliveryUrl: string;
    lastDeliveryUrl: string | null;
    lastFetchObservation: RealRoomTerminalDeliveryDiagnostics["lastFetchObservation"];
  } = {
    phase: "prepare initial prompt",
    expectedDeliveryPort: port,
    expectedDeliveryUrl: url,
    lastDeliveryUrl: null,
    lastFetchObservation: null,
  };
  harness.declareOwnedPort({
    kind: "delivery-http",
    label: "room terminal tiny-app delivery",
    port,
    expectedUrl: url,
  });

  try {
    const prompt = [
      "你正在参与一个真实交付测试，目标是验证 Room + Terminal + URL 交付闭环。",
      `你只能在房间 ${roomId} 与用户沟通。`,
      "这条用户消息已经给出完整任务全文，不存在截断。",
      "如果任何工具输出里出现 `...<clipped ...>`，那只是工具预览被截断，不代表任务缺失。",
      "不要先打开任何 runtime skill 的 `SKILL.md`，也不要先用 skill info 浏览技能说明；先做直接命令。",
      "所有用户可见消息都必须使用简短中文，不要回英文。",
      "禁止为了重新确认任务全文而执行 attention list/query、message list/read 或其它上下文读取命令；直接按这条消息执行。",
      "第 1 步：立刻发送一条简短中文消息，确认你开始构建。",
      `当前房间 chatId 已经明确给出，就是 ${roomId}；发确认或交付时直接用这个 chatId，不要先跑 message list/read。`,
      "第 2 步：你现在的直接工具是 workspace_list、root_bash、workspace_bash。",
      `共享项目工作目录的绝对路径固定为：${harness.workspacePath}`,
      `推荐最小实现：只写一个 index.html，然后在 terminal 里运行 python3 -m http.server ${port} --bind 127.0.0.1。`,
      "这是纯静态网页任务，不要创建 API，不要创建 /api/status，不要使用 READY-API 这类其它测试场景的标记。",
      "先用 workspace_list 看清已挂载路径，再根据任务选择 root_bash 或 workspace_bash。",
      `如果当前没有 terminal，就先执行 terminal create --help，然后使用 JSON 形式创建，例如 terminal create '{"cwd":"${harness.workspacePath}","focus":true}'；如果已有 terminal，就先 terminal list / terminal read 恢复它。`,
      "如果你忘了 terminal CLI 的格式，先执行 terminal create --help；只有在连 terminal 命令族本身都不清楚时，才允许再看 skill info agenter-terminal。长期服务放在 terminal 里跑，一次性检查放在 root_bash 里做；验证 URL 时优先用 curl。",
      "如需发房间消息，直接使用 message send；不要为了确认房间上下文先跑 message list/read。",
      "如果 terminal write 的 text 里还要包含 JSON、很多引号或 heredoc，优先用 JSON stdin 形式调用 terminal write，不要手写多层转义的单个 argv。",
      "然后只在这个目录里创建一个最小静态网页应用。",
      `初版页面必须同时包含这些精确字符串：${REAL_ROOM_APP_V1_MARKERS.join(", ")}。`,
      `不要改写这些标记，不要换成 READY-API 或其它示例字符串。`,
      `第 3 步：必须把应用启动在 ${url}，只能监听 127.0.0.1，不要换端口，严禁使用 3000/4173/5173 等默认端口。`,
      `第 4 步：在发链接前，继续通过 root_bash 自行验证 ${url} 可访问。`,
      `第 5 步：验证通过后，立刻直接在当前聊天里把精确 URL ${url} 发给用户，并明确说明第一页已经可以打开。交付消息里不要再附带第二个 URL，不要附带 API 链接。不要在发这条交付消息之前继续刷工具。`,
      "第 6 步：收到用户反馈后，在同一个 URL 上修改应用，不要换端口。",
      `反馈完成后的页面必须同时包含这些精确字符串：${REAL_ROOM_APP_V2_MARKERS.join(", ")}。`,
      `不要改写这些更新标记，也不要引入 READY-API 或其它无关标记。`,
      `修改完成后，再自行验证 ${url} 可访问，然后立刻直接在当前聊天里再次把同一个 URL ${url} 发给用户，并明确说明更新后的版本已经可以打开。更新交付消息里同样不要附带第二个 URL。不要在发这条更新交付消息之前继续刷工具。`,
      "除了最初的简短确认和两次带链接的交付消息之外，不要发送多余的用户可见消息。",
      "顺序要求：先完成该轮用户可见交付消息，再收敛 attention。不要为了确认当前任务而去查询 attention/context。",
    ].join("\n");
    const sent = await harness.kernel.pushUserRoomMessage({
      sessionId: harness.session.id,
      chatId: roomId,
      text: prompt,
    });
    if (!sent.ok) {
      throw new Error(`failed to send room-terminal delivery prompt: ${sent.reason ?? "unknown"}`);
    }

    debugState.phase = "wait acknowledgement";
    const acknowledgement = await waitForAssistantMessage(harness, {
      label: "room-terminal acknowledgement",
      predicate: (message) =>
        message.chatId === roomId &&
        message.timestamp >= startAt &&
        message.content.trim().length > 0 &&
        extractLocalDeliveryUrl(message.content) === null,
      timeoutMs: budget.step("room-terminal acknowledgement", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.phase = "wait delivery url";
    const deliveryMessage = await waitForAssistantMessage(harness, {
      label: "room-terminal delivery url message",
      predicate: (message) =>
        message.chatId === roomId &&
        message.timestamp > acknowledgement.timestamp &&
        extractLocalDeliveryUrl(message.content) === url,
      timeoutMs: budget.step("room-terminal delivery url", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.lastDeliveryUrl = url;
    debugState.phase = "verify initial url";
    const initialFetch = await waitForUrlMarkers(url, REAL_ROOM_APP_V1_MARKERS, {
      label: "initial tiny-app delivery body",
      timeoutMs: budget.step("initial tiny-app delivery body", REAL_ROOM_DELIVERY_TIMEOUT_MS),
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    const feedbackPrompt = [
      `我已经打开了 ${url}。`,
      "请继续在同一个 URL 上修改这个应用，不要换端口。",
      `请把页面更新为同时包含这些精确字符串：${REAL_ROOM_APP_V2_MARKERS.join(", ")}。`,
      `完成后直接把同一个 URL ${url} 再发我，并明确说明更新后的版本已经可以打开。`,
      "注意：之前那条带链接的交付消息只完成了上一轮义务；这条反馈重新打开了新的房间义务，只有把同一个链接重新交付给我后才算完成。",
    ].join("\n");
    const feedbackSent = await harness.kernel.pushUserRoomMessage({
      sessionId: harness.session.id,
      chatId: roomId,
      text: feedbackPrompt,
    });
    if (!feedbackSent.ok) {
      throw new Error(`failed to send room-terminal feedback: ${feedbackSent.reason ?? "unknown"}`);
    }
    const feedbackSentAt = Date.now();

    debugState.phase = "wait updated room message";
    const updateMessage = await waitForAssistantMessage(harness, {
      label: "room-terminal update acknowledgement",
      predicate: (message) =>
        message.chatId === roomId &&
        message.timestamp >= feedbackSentAt &&
        extractLocalDeliveryUrl(message.content) === url,
      timeoutMs: budget.step("room-terminal update acknowledgement", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.phase = "verify updated url";
    const updatedFetch = await waitForUrlMarkers(url, REAL_ROOM_APP_V2_MARKERS, {
      label: "updated tiny-app delivery body",
      timeoutMs: budget.step("updated tiny-app delivery body", REAL_ROOM_DELIVERY_TIMEOUT_MS),
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    debugState.phase = "wait attention settled";
    const settledAttention = await waitForAttentionSettled(
      harness,
      budget.step("room-terminal settled attention", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    );
    debugState.phase = "wait model calls complete";
    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "room-terminal model call completion",
      timeoutMs: budget.step("room-terminal model call completion", REAL_ROOM_DELIVERY_TIMEOUT_MS),
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
      validationResources: harness.getValidationResources(),
    };
  } catch (error) {
    const diagnostics = await collectRealRoomTerminalDeliveryDiagnostics(harness, debugState);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`real room-terminal delivery scenario failed: ${message}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
};
