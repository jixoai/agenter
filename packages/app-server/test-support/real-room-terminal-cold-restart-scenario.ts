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

const REAL_ROOM_COLD_RESTART_SCENARIO_TIMEOUT_MS = 900_000;
const REAL_ROOM_COLD_RESTART_DELIVERY_TIMEOUT_MS = 300_000;
const REAL_ROOM_COLD_RESTART_SETTLE_TIMEOUT_MS = 180_000;

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
    running: terminal.processPhase === "running",
    cwd: terminal.launchCwd,
    focused: terminal.focused,
    title: terminal.currentTitle ?? terminal.configuredTitle ?? terminal.terminalId,
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
      "这是一次冷重启前后的连续交付测试。你现在先完成重启前的第一轮交付，不要做额外的系统自检。",
      `共享项目工作目录固定为：${harness.workspacePath}`,
      "你可以直接使用 workspace_list、root_bash、workspace_bash；长期服务放 terminal，一次性检查放 root_bash。",
      `唯一允许交付的本地链接是：${initialDeliveryUrl}。只能使用这个 URL，只能监听 127.0.0.1，不要换 host，不要换端口，不要改成 3000。`,
      "你的第一条聊天回复必须是简短中文，确认你已经开始处理。",
      `然后在该目录里创建一个最小静态网页，页面必须同时包含这些精确字符串：${REAL_ROOM_APP_V1_MARKERS.join(", ")}。`,
      `不要改写这些标记，不要替换成其它示例里的字符串；只能使用 ${REAL_ROOM_APP_V1_MARKERS.join(", ")}。`,
      `如果当前没有 terminal，就先执行 terminal create --help，然后用 JSON 形式创建，例如 terminal create '{"cwd":"${harness.workspacePath}","focus":true}'；如果已有 terminal，就先 terminal list / terminal read 恢复并复用。`,
      "如果忘了 terminal CLI 的格式，先在 shell 里执行 skill info agenter-terminal；如果忘了 terminal write 的字段名，先看 terminal write --help，字段名是 text。",
      `在回复链接前，必须先通过 root_bash 用 curl 自行验证 ${initialDeliveryUrl} 可访问。`,
      `验证通过后，给我一条带有精确 URL ${initialDeliveryUrl} 的交付消息，并明确说明第一页已经可以打开。`,
      "除最初的简短确认和最终那条带链接的交付消息外，不要发送额外聊天文本。",
      "先完成这一轮交付，再做任何收尾动作。",
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
        message.content.trim().length > 0 &&
        extractLocalDeliveryUrl(message.content) === null,
      timeoutMs: budget.step("cold-restart initial acknowledgement", REAL_ROOM_COLD_RESTART_SETTLE_TIMEOUT_MS),
    });

    debugState.phase = "wait initial delivery url";
    const deliveryMessage = await waitForAssistantMessage(harness, {
      label: "cold-restart initial delivery url",
      predicate: (message) =>
        message.chatId === primaryRoomIdBeforeRestart &&
        message.timestamp > acknowledgement.timestamp &&
        extractLocalDeliveryUrl(message.content) === initialDeliveryUrl,
      timeoutMs: budget.step("cold-restart initial delivery url", REAL_ROOM_COLD_RESTART_DELIVERY_TIMEOUT_MS),
    });

    debugState.lastDeliveryUrl = initialDeliveryUrl;
    debugState.phase = "verify initial url";
    const initialFetch = await waitForUrlMarkers(initialDeliveryUrl, REAL_ROOM_APP_V1_MARKERS, {
      label: "cold-restart initial delivery body",
      timeoutMs: budget.step("cold-restart initial delivery body", REAL_ROOM_COLD_RESTART_DELIVERY_TIMEOUT_MS),
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    debugState.phase = "wait pre-restart attention settled";
    await waitForAttentionSettled(
      harness,
      budget.step("cold-restart pre-restart attention settled", REAL_ROOM_COLD_RESTART_SETTLE_TIMEOUT_MS),
    );
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
      `我在冷重启后又打开了 ${initialDeliveryUrl}。`,
      "请继续第二轮交付，还是用同一个工作目录和同一个 URL，不要换端口。",
      "如果你之前的 terminal 进程还在，就恢复并复用；如果已经不存在，就自己重新创建，不要假设内存态还在。",
      "如果忘了格式，先看 terminal create --help / terminal write --help，再继续。",
      `请把页面更新为同时包含这些精确字符串：${REAL_ROOM_APP_V2_MARKERS.join(", ")}。`,
      `不要改写这些标记，不要替换成其它示例里的字符串；只能使用 ${REAL_ROOM_APP_V2_MARKERS.join(", ")}。`,
      `完成后，直接把同一个 URL ${initialDeliveryUrl} 再发给我，并明确说明重启后的更新版本已经可以打开。`,
      "注意：之前那条带链接的交付消息只完成了重启前的上一轮义务；这条反馈重新打开了新的房间义务，只有把同一个链接重新交付给我后才算完成。",
      "直接把页面改好并回链接，再做任何收尾动作。",
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
        extractLocalDeliveryUrl(message.content) === initialDeliveryUrl,
      timeoutMs: budget.step("cold-restart resumed delivery", REAL_ROOM_COLD_RESTART_DELIVERY_TIMEOUT_MS),
    });

    debugState.phase = "verify resumed url";
    const resumedFetch = await waitForUrlMarkers(initialDeliveryUrl, REAL_ROOM_APP_V2_MARKERS, {
      label: "cold-restart resumed delivery body",
      timeoutMs: budget.step("cold-restart resumed delivery body", REAL_ROOM_COLD_RESTART_DELIVERY_TIMEOUT_MS),
      onObservation: (observation) => {
        debugState.lastFetchObservation = observation;
      },
    });

    debugState.phase = "wait post-restart attention settled";
    const settledAttention = await waitForAttentionSettled(
      harness,
      budget.step("cold-restart post-restart attention settled", REAL_ROOM_COLD_RESTART_SETTLE_TIMEOUT_MS),
    );
    debugState.phase = "wait post-restart model calls";
    const modelCallsAfterRestart = await waitForModelCallsAfter(harness, {
      afterTimestamp: feedbackSentAt,
      label: "cold-restart post-restart model calls",
      timeoutMs: budget.step("cold-restart post-restart model calls", REAL_ROOM_COLD_RESTART_SETTLE_TIMEOUT_MS),
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
