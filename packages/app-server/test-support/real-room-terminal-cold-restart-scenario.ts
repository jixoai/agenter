import { resolve } from "node:path";

import type { ChatMessage, SessionRuntimeAttentionState } from "../src";
import type { RealKernelHarness } from "./real-kernel-harness";
import {
  allocateEphemeralPort,
  REAL_ROOM_APP_V1_MARKERS,
  REAL_ROOM_APP_V2_MARKERS,
  REAL_ROOM_DELIVERY_TIMEOUT_MS,
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

const RESUMED_PREFIX = "APP-RESUMED:";
const REAL_ROOM_COLD_RESTART_SCENARIO_TIMEOUT_MS = 420_000;

type ModelCallRecord = Awaited<ReturnType<RealKernelHarness["kernel"]["inspectModelDebug"]>>["recentModelCalls"][number];

const projectModelCalls = (calls: readonly ModelCallRecord[]) =>
  calls.map((call) => ({
    id: call.id,
    cycleId: call.cycleId,
    status: call.status,
    outcome: readModelOutcomeCode(call),
    tools: extractToolTraceTools(call),
  }));

const projectChannels = (harness: RealKernelHarness) =>
  harness.kernel.listMessageChannels(harness.session.id).map((channel) => ({
    chatId: channel.chatId,
    title: channel.title,
    kind: channel.kind,
    focused: channel.focused,
    contextId: channel.contextId,
  }));

const projectWorkspaceMounts = (harness: RealKernelHarness) =>
  harness.kernel.listRuntimeWorkspaceMounts(harness.session.id).map((mount) => ({
    workspacePath: mount.workspacePath,
    grants: harness.kernel.listRuntimeWorkspaceGrants({
      runtimeId: harness.session.id,
      workspacePath: mount.workspacePath,
    }),
  }));

const projectTerminals = (harness: RealKernelHarness) =>
  harness.kernel.listTerminals(harness.session.id).map((terminal) => ({
    terminalId: terminal.terminalId,
    running: terminal.running,
    cwd: terminal.cwd,
    focused: terminal.focused,
    title: terminal.title,
  }));

export interface RealRoomTerminalColdRestartDiagnostics {
  phase: string;
  sessionIdBeforeRestart: string;
  sessionIdAfterRestart: string | null;
  primaryRoomIdBeforeRestart: string;
  primaryRoomIdAfterRestart: string | null;
  lastDeliveryUrl: string | null;
  lastFetchObservation: {
    status?: number;
    body?: string;
    error: string;
  } | null;
  preRestart: {
    channels: ReturnType<typeof projectChannels>;
    workspaceMounts: ReturnType<typeof projectWorkspaceMounts>;
    terminals: ReturnType<typeof projectTerminals>;
    chatMessages: ChatMessage[];
    recentModelCalls: ReturnType<typeof projectModelCallDiagnostics>;
  };
  postRestart: {
    channels: ReturnType<typeof projectChannels>;
    workspaceMounts: ReturnType<typeof projectWorkspaceMounts>;
    terminals: ReturnType<typeof projectTerminals>;
    chatMessages: ChatMessage[];
    attention: SessionRuntimeAttentionState | null;
    recentModelCalls: ReturnType<typeof projectModelCallDiagnostics>;
  };
}

export interface RealRoomTerminalColdRestartScenarioResult {
  acknowledgement: ChatMessage;
  deliveryMessage: ChatMessage;
  resumedMessage: ChatMessage;
  deliveryUrl: string;
  initialBody: string;
  resumedBody: string;
  feedbackPrompt: string;
  sessionIdBeforeRestart: string;
  sessionIdAfterRestart: string;
  primaryRoomIdBeforeRestart: string;
  primaryRoomIdAfterRestart: string;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCallsAfterRestart: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceToolsAfterRestart: string[];
}

const collectColdRestartDiagnostics = async (
  harness: RealKernelHarness,
  state: {
    phase: string;
    sessionIdBeforeRestart: string;
    sessionIdAfterRestart: string | null;
    primaryRoomIdBeforeRestart: string;
    primaryRoomIdAfterRestart: string | null;
    lastDeliveryUrl: string | null;
    lastFetchObservation: RealRoomTerminalColdRestartDiagnostics["lastFetchObservation"];
    preRestartMessages: ChatMessage[];
    preRestartChannels: ReturnType<typeof projectChannels>;
    preRestartWorkspaceMounts: ReturnType<typeof projectWorkspaceMounts>;
    preRestartTerminals: ReturnType<typeof projectTerminals>;
    preRestartModelCalls: ReturnType<typeof projectModelCallDiagnostics>;
  },
): Promise<RealRoomTerminalColdRestartDiagnostics> => {
  const attention = await harness.kernel.inspectAttentionState(harness.session.id).catch(() => null);
  const recentModelCalls = await harness.kernel.inspectModelDebug(harness.session.id).catch(() => ({ recentModelCalls: [] as ModelCallRecord[] }));
  return {
    phase: state.phase,
    sessionIdBeforeRestart: state.sessionIdBeforeRestart,
    sessionIdAfterRestart: state.sessionIdAfterRestart,
    primaryRoomIdBeforeRestart: state.primaryRoomIdBeforeRestart,
    primaryRoomIdAfterRestart: state.primaryRoomIdAfterRestart,
    lastDeliveryUrl: state.lastDeliveryUrl,
    lastFetchObservation: state.lastFetchObservation,
    preRestart: {
      channels: state.preRestartChannels,
      workspaceMounts: state.preRestartWorkspaceMounts,
      terminals: state.preRestartTerminals,
      chatMessages: state.preRestartMessages,
      recentModelCalls: state.preRestartModelCalls,
    },
    postRestart: {
      channels: projectChannels(harness),
      workspaceMounts: projectWorkspaceMounts(harness),
      terminals: projectTerminals(harness),
      chatMessages: listRoomTruthMessages(harness),
      attention,
      recentModelCalls: projectModelCallDiagnostics(recentModelCalls.recentModelCalls),
    },
  };
};

export const runRealRoomTerminalColdRestartScenario = async (
  harness: RealKernelHarness,
): Promise<RealRoomTerminalColdRestartScenarioResult> => {
  const sessionIdBeforeRestart = harness.session.id;
  const primaryRoomIdBeforeRestart = getPrimaryRoomId(harness);
  const budget = createScenarioBudget("real room-terminal cold-restart scenario", REAL_ROOM_COLD_RESTART_SCENARIO_TIMEOUT_MS);
  const debugState = {
    phase: "prepare initial prompt",
    sessionIdBeforeRestart,
    sessionIdAfterRestart: null as string | null,
    primaryRoomIdBeforeRestart,
    primaryRoomIdAfterRestart: null as string | null,
    lastDeliveryUrl: null as string | null,
    lastFetchObservation: null as RealRoomTerminalColdRestartDiagnostics["lastFetchObservation"],
    preRestartMessages: [] as ChatMessage[],
    preRestartChannels: [] as ReturnType<typeof projectChannels>,
    preRestartWorkspaceMounts: [] as ReturnType<typeof projectWorkspaceMounts>,
    preRestartTerminals: [] as ReturnType<typeof projectTerminals>,
    preRestartModelCalls: [] as ReturnType<typeof projectModelCallDiagnostics>,
  };

  try {
    const port = await allocateEphemeralPort();
    const initialDeliveryUrl = `http://127.0.0.1:${port}/`;
    const initialStartAt = Date.now();
    const initialPrompt = [
      "你正在参与一个真实冷重启恢复测试，目标是验证 Room + Workspace + Terminal + 持久化恢复。",
      `你只能在房间 ${primaryRoomIdBeforeRestart} 与用户沟通。`,
      "第 1 步：立刻发送一条以 APP-ACK: 开头的简短中文消息，表示你开始构建。",
      "第 2 步：你现在只有 root_workspace_list 和 root_workspace_bash 这两个直接工具。",
      `共享项目工作目录的绝对路径固定为：${harness.workspacePath}`,
      "先用 root_workspace_list 看清已挂载路径，再用 root_workspace_bash 进入 shell。",
      `如果当前没有 terminal，就先执行 terminal create --help，然后使用 JSON 形式创建，例如 terminal create '{"cwd":"${harness.workspacePath}","focus":true}'；如果已有 terminal，就先 terminal list / terminal read 恢复它。`,
      "如果你忘了 terminal CLI 的格式，先在 shell 里执行 ccski info agenter-terminal。长期服务放在 terminal 里跑，一次性检查放在 root_workspace_bash 里做；验证 URL 时优先用 curl。",
      "如果 terminal write 的 text 里还要包含 JSON、很多引号或 heredoc，优先用 JSON stdin 形式调用 terminal write，不要手写多层转义的单个 argv。",
      "然后只在这个目录里创建一个最小静态网页应用。",
      `初版页面必须同时包含这些精确字符串：${REAL_ROOM_APP_V1_MARKERS.join(", ")}。`,
      `第 3 步：必须把应用启动在 ${initialDeliveryUrl}，只能监听 127.0.0.1，不要换端口。`,
      `第 4 步：在发链接前，继续通过 root_workspace_bash 自行验证 ${initialDeliveryUrl} 可访问。`,
      `第 5 步：验证通过后，只发送一条以 APP-URL: 开头并包含精确 URL ${initialDeliveryUrl} 的消息。`,
      "除了 APP-ACK 和 APP-URL，不要发送多余的用户可见消息。",
      "每轮工作完成后都要收敛 attention。",
    ].join("\n");
    const initialSent = await harness.kernel.sendChat(harness.session.id, initialPrompt);
    if (!initialSent.ok) {
      throw new Error(`failed to send cold-restart initial prompt: ${initialSent.reason ?? "unknown"}`);
    }

    debugState.phase = "wait initial acknowledgement";
    const acknowledgement = await waitForAssistantMessage(harness, {
      label: "cold-restart initial acknowledgement",
      predicate: (message) =>
        message.chatId === primaryRoomIdBeforeRestart &&
        message.timestamp >= initialStartAt &&
        message.content.trim().startsWith("APP-ACK:"),
      timeoutMs: budget.step("cold-restart initial acknowledgement", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.phase = "wait initial delivery url";
    const deliveryMessage = await waitForAssistantMessage(harness, {
      label: "cold-restart initial delivery url",
      predicate: (message) =>
        message.chatId === primaryRoomIdBeforeRestart &&
        message.timestamp > acknowledgement.timestamp &&
        message.content.trim().startsWith("APP-URL:") &&
        extractLocalDeliveryUrl(message.content) === initialDeliveryUrl,
      timeoutMs: budget.step("cold-restart initial delivery url", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.lastDeliveryUrl = initialDeliveryUrl;
    debugState.phase = "verify initial url";
    const initialFetch = await waitForUrlMarkers(initialDeliveryUrl, REAL_ROOM_APP_V1_MARKERS, {
      label: "cold-restart initial delivery body",
      timeoutMs: budget.step("cold-restart initial delivery body", REAL_ROOM_DELIVERY_TIMEOUT_MS),
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    debugState.phase = "wait pre-restart attention settled";
    await waitForAttentionSettled(harness, budget.step("cold-restart pre-restart attention settled", REAL_ROOM_DELIVERY_TIMEOUT_MS));
    const preRestartModelCallsRaw = await harness.kernel.inspectModelDebug(harness.session.id);
    debugState.preRestartMessages = listRoomTruthMessages(harness);
    debugState.preRestartChannels = projectChannels(harness);
    debugState.preRestartWorkspaceMounts = projectWorkspaceMounts(harness);
    debugState.preRestartTerminals = projectTerminals(harness);
    debugState.preRestartModelCalls = projectModelCallDiagnostics(preRestartModelCallsRaw.recentModelCalls);

    const stopped = await harness.kernel.stopSession(harness.session.id);
    if (stopped.id !== sessionIdBeforeRestart || stopped.status !== "stopped") {
      throw new Error(`unexpected stopSession result: ${JSON.stringify({ id: stopped.id, status: stopped.status })}`);
    }

    debugState.phase = "restart kernel";
    await harness.restartKernel();
    const restoredMeta = harness.kernel.getSession(sessionIdBeforeRestart);
    if (!restoredMeta) {
      throw new Error(`session missing after kernel restart: ${sessionIdBeforeRestart}`);
    }
    harness.session = await harness.kernel.startSession(restoredMeta.id);
    debugState.sessionIdAfterRestart = harness.session.id;
    debugState.primaryRoomIdAfterRestart = harness.session.primaryRoomId ?? null;

    const primaryRoomIdAfterRestart = harness.session.primaryRoomId;
    if (!primaryRoomIdAfterRestart) {
      throw new Error(`missing primary room after cold restart: ${harness.session.id}`);
    }
    if (harness.session.id !== sessionIdBeforeRestart) {
      throw new Error(`session identity changed across restart: ${sessionIdBeforeRestart} -> ${harness.session.id}`);
    }
    if (primaryRoomIdAfterRestart !== primaryRoomIdBeforeRestart) {
      throw new Error(`primary room changed across restart: ${primaryRoomIdBeforeRestart} -> ${primaryRoomIdAfterRestart}`);
    }
    if (!projectChannels(harness).some((channel) => channel.chatId === primaryRoomIdAfterRestart)) {
      throw new Error(`primary room grant missing after restart: ${primaryRoomIdAfterRestart}`);
    }
    if (!projectWorkspaceMounts(harness).some((mount) => mount.workspacePath === resolve(harness.workspacePath))) {
      throw new Error(`workspace grant missing after restart: ${resolve(harness.workspacePath)}`);
    }

    const feedbackPrompt = [
      `我在重启后又打开了 ${initialDeliveryUrl}。`,
      "请继续在同一个 URL 上修改这个应用，不要换端口。",
      "如果你之前的 terminal 进程已经不存在，就自己通过 root_workspace_bash 里的 terminal CLI 恢复，不要假设内存状态还在；如果忘了格式，先 terminal create --help / terminal write --help。",
      `请把页面更新为同时包含这些精确字符串：${REAL_ROOM_APP_V2_MARKERS.join(", ")}。`,
      `完成后只发送一条以 ${RESUMED_PREFIX} 开头并包含同一个 URL ${initialDeliveryUrl} 的消息。`,
      `注意：之前那条 APP-URL 只完成了重启前的上一轮义务；这条反馈重新打开了新的房间义务，只有发出 ${RESUMED_PREFIX} 开头的消息后才算完成。`,
    ].join("\n");
    const feedbackSent = await harness.kernel.sendChat(harness.session.id, feedbackPrompt);
    if (!feedbackSent.ok) {
      throw new Error(`failed to send cold-restart feedback: ${feedbackSent.reason ?? "unknown"}`);
    }
    const feedbackSentAt = Date.now();

    debugState.phase = "wait resumed delivery";
    const resumedMessage = await waitForAssistantMessage(harness, {
      label: "cold-restart resumed delivery",
      predicate: (message) =>
        message.chatId === primaryRoomIdAfterRestart &&
        message.timestamp >= feedbackSentAt &&
        message.content.trim().startsWith(RESUMED_PREFIX) &&
        extractLocalDeliveryUrl(message.content) === initialDeliveryUrl,
      timeoutMs: budget.step("cold-restart resumed delivery", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    debugState.phase = "verify resumed url";
    const resumedFetch = await waitForUrlMarkers(initialDeliveryUrl, REAL_ROOM_APP_V2_MARKERS, {
      label: "cold-restart resumed delivery body",
      timeoutMs: budget.step("cold-restart resumed delivery body", REAL_ROOM_DELIVERY_TIMEOUT_MS),
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    debugState.phase = "wait post-restart attention settled";
    const settledAttention = await waitForAttentionSettled(
      harness,
      budget.step("cold-restart post-restart attention settled", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    );
    debugState.phase = "wait post-restart model calls";
    const modelCallsAfterRestart = await waitForModelCallsAfter(harness, {
      afterTimestamp: feedbackSentAt,
      label: "cold-restart post-restart model calls",
      timeoutMs: budget.step("cold-restart post-restart model calls", REAL_ROOM_DELIVERY_TIMEOUT_MS),
    });

    return {
      acknowledgement,
      deliveryMessage,
      resumedMessage,
      deliveryUrl: initialDeliveryUrl,
      initialBody: initialFetch.body,
      resumedBody: resumedFetch.body,
      feedbackPrompt,
      sessionIdBeforeRestart,
      sessionIdAfterRestart: harness.session.id,
      primaryRoomIdBeforeRestart,
      primaryRoomIdAfterRestart,
      settledAttention,
      recentModelCallsAfterRestart: modelCallsAfterRestart.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
      })),
      toolTraceToolsAfterRestart: modelCallsAfterRestart.flatMap(extractToolTraceTools),
    };
  } catch (error) {
    const diagnostics = await collectColdRestartDiagnostics(harness, debugState);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`real room-terminal cold-restart scenario failed: ${message}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
};
