import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { PublicRoomMessageRecord, SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import { waitForRealValue } from "./real-kernel-harness";
import {
  allocateEphemeralPort,
  extractToolTraceTools,
  readModelOutcomeCode,
  waitForUrlMarkers,
} from "./real-room-terminal-delivery-scenario";
import type { RealTeamKernelHarness, RealTeamProjectRoom } from "./real-team-kernel-harness";

const REALISTIC_PROJECT_TIMEOUT_MS = 420_000;
const REALISTIC_DELIVERY_TIMEOUT_MS = 240_000;
const REALISTIC_ATTENTION_SCOPE = excludeActiveContextPrefixes("ctx-task-source-");
const REALISTIC_PROJECT_URL_PATTERN = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/?/u;
const DESIGN_FILE_NAME = "design.svg";
const DESIGN_MARKERS = ["<svg", "小队项目看板"] as const;
const HTML_MARKERS = ["小队项目看板", "接口状态", "准备好了"] as const;
const API_MARKERS = ["READY-API", "PROJECT-BOARD-V1"] as const;

type ParticipantModelCall = Awaited<ReturnType<RealTeamKernelHarness["kernel"]["inspectModelDebug"]>>["recentModelCalls"][number];

const isFrontendCoordinationMessage = (message: PublicRoomMessageRecord, actorId: string, afterTimestamp: number): boolean =>
  message.createdAt >= afterTimestamp &&
  message.senderContactId === actorId &&
  /页面|设计|草图|svg|\/api\/status|小队项目看板|接口状态/iu.test(message.content);

const isApiQuestionMessage = (message: PublicRoomMessageRecord, actorId: string, afterTimestamp: number): boolean =>
  message.createdAt >= afterTimestamp &&
  message.senderContactId === actorId &&
  /\/api\/status/iu.test(message.content) &&
  /(接口|字段|返回|响应|status|json|contract|read)/iu.test(message.content) &&
  (/[?？]/u.test(message.content) || /(请问|想确认|能否|麻烦|告诉我|告诉下)/iu.test(message.content));

const isBackendCoordinationMessage = (message: PublicRoomMessageRecord, actorId: string, afterTimestamp: number): boolean =>
  message.createdAt >= afterTimestamp &&
  message.senderContactId === actorId &&
  /(服务|接口|后端|server|\/api\/status|READY-API|PROJECT-BOARD-V1|地址|url)/iu.test(message.content);

const isUrlMessage = (message: PublicRoomMessageRecord, actorId: string, expectedUrl: string, afterTimestamp: number): boolean =>
  message.createdAt >= afterTimestamp &&
  message.senderContactId === actorId &&
  message.content.includes(expectedUrl) &&
  extractProjectUrl(message.content) === expectedUrl;

const isFinalProjectUrlMessage = (
  message: PublicRoomMessageRecord,
  actorId: string,
  expectedUrl: string,
  afterTimestamp: number,
): boolean =>
  isUrlMessage(message, actorId, expectedUrl, afterTimestamp) &&
  /(可打开|可以打开|打开这个地址|最终地址|最终结果|已完成|完成了|交付|ready|done|available|visit)/iu.test(message.content);

export const isRealisticBackendApiAnswerContent = (content: string): boolean =>
  /\/api\/status/iu.test(content) &&
  /READY-API/iu.test(content) &&
  /PROJECT-BOARD-V1/iu.test(content) &&
  (/接口地址|API 接口|已就绪|就绪|已启动|已完成|全部就绪|请打开|查看|```/iu.test(content) ||
    /json/iu.test(content) ||
    /https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/api\/status/iu.test(content));

const isBackendApiAnswerMessage = (message: PublicRoomMessageRecord, actorId: string, afterTimestamp: number): boolean =>
  message.createdAt >= afterTimestamp &&
  message.senderContactId === actorId &&
  isRealisticBackendApiAnswerContent(message.content);

const extractProjectUrl = (content: string): string | null => content.match(REALISTIC_PROJECT_URL_PATTERN)?.[0] ?? null;

const waitForRoomMessage = async (
  harness: RealTeamKernelHarness,
  room: Pick<RealTeamProjectRoom, "room">,
  input: {
    label: string;
    predicate: (message: PublicRoomMessageRecord) => boolean;
    timeoutMs?: number;
  },
): Promise<PublicRoomMessageRecord> =>
  await waitForRealValue(
    () => harness.listProjectRoomMessages(room, 120).filter(input.predicate).at(-1) ?? null,
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? REALISTIC_PROJECT_TIMEOUT_MS,
    },
  );

const waitForWorkspaceFile = async (
  harness: RealTeamKernelHarness,
  input: {
    baseName: string;
    markers: readonly string[];
    label: string;
    timeoutMs?: number;
  },
): Promise<{ relativePath: string; content: string }> =>
  await waitForRealValue(
    async () => await findWorkspaceFile(harness.workspacePath, "", input.baseName, input.markers),
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? REALISTIC_PROJECT_TIMEOUT_MS,
    },
  );

const findWorkspaceFile = async (
  workspacePath: string,
  relativeDir: string,
  baseName: string,
  markers: readonly string[],
): Promise<{ relativePath: string; content: string } | null> => {
  const entries = await readdir(join(workspacePath, relativeDir), {
    withFileTypes: true,
    encoding: "utf8",
  }).catch(() => null);
  if (!entries) {
    return null;
  }

  for (const entry of entries) {
    const childRelativePath = relativeDir ? join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      const nested = await findWorkspaceFile(workspacePath, childRelativePath, baseName, markers);
      if (nested) {
        return nested;
      }
      continue;
    }
    if (!entry.isFile() || entry.name !== baseName) {
      continue;
    }
    try {
      const content = await readFile(join(workspacePath, childRelativePath), "utf8");
      if (markers.every((marker) => content.includes(marker))) {
        return { relativePath: childRelativePath, content };
      }
    } catch {
      continue;
    }
  }

  return null;
};

const waitForParticipantAttentionSettled = async (
  harness: RealTeamKernelHarness,
  sessionId: string,
  timeoutMs = REALISTIC_PROJECT_TIMEOUT_MS,
): Promise<SessionRuntimeAttentionState> =>
  await waitForScopedAttentionSettled(
    async () => await harness.kernel.inspectAttentionState(sessionId),
    waitForRealValue,
    REALISTIC_ATTENTION_SCOPE,
    timeoutMs,
  );

const listParticipantModelCalls = async (harness: RealTeamKernelHarness, sessionId: string): Promise<ParticipantModelCall[]> =>
  harness.kernel.listModelCalls(sessionId, 0, 200);

const readWorkspaceTextIfExists = async (workspacePath: string, relativePath: string): Promise<string | null> => {
  try {
    return await readFile(join(workspacePath, relativePath), "utf8");
  } catch {
    return null;
  }
};

const mapMessages = (messages: PublicRoomMessageRecord[]) =>
  messages.map((message) => ({
    messageId: message.messageId,
    senderContactId: message.senderContactId ?? null,
    from: message.from,
    content: message.content,
    createdAt: message.createdAt,
    attachments:
      message.attachments?.map((attachment) => ({
        assetId: attachment.assetId,
        name: attachment.name,
        mimeType: attachment.mimeType,
      })) ?? [],
  }));

export interface RealProjectRoomRealisticUserDiagnostics {
  workspacePath: string;
  deliveryUrl: string | null;
  htmlObservation: { status?: number; body?: string; error: string } | null;
  apiObservation: { status?: number; body?: string; error: string } | null;
  roomMessages: ReturnType<typeof mapMessages>;
  roomAssets: Array<{
    assetId: string;
    name: string;
    mimeType: string;
    uploadedByActorId?: string;
  }>;
  workspaceFiles: {
    designSvg: { relativePath: string; content: string } | null;
    indexHtml: { relativePath: string; content: string } | null;
    serverJs: string | null;
  };
  backendAttention: SessionRuntimeAttentionState;
  frontendAttention: SessionRuntimeAttentionState;
  backendModelCalls: Array<{ id: number; cycleId: number | null; status: string; outcome: string | null; tools: string[] }>;
  frontendModelCalls: Array<{ id: number; cycleId: number | null; status: string; outcome: string | null; tools: string[] }>;
}

export interface RealProjectRoomRealisticUserScenarioResult {
  projectRoom: RealTeamProjectRoom;
  frontendCoordinationMessage: PublicRoomMessageRecord;
  backendCoordinationMessage: PublicRoomMessageRecord;
  apiQuestionMessage: PublicRoomMessageRecord | null;
  apiAnswerMessage: PublicRoomMessageRecord;
  designSvg: string;
  designAttachmentMessage: PublicRoomMessageRecord;
  finalUrlMessage: PublicRoomMessageRecord;
  deliveryUrl: string;
  htmlBody: string;
  apiBody: string;
  userAcceptanceMessage: PublicRoomMessageRecord;
  backendAttention: SessionRuntimeAttentionState;
  frontendAttention: SessionRuntimeAttentionState;
  backendModelCalls: Array<{ id: number; cycleId: number | null; status: string; outcome: string | null; tools: string[] }>;
  frontendModelCalls: Array<{ id: number; cycleId: number | null; status: string; outcome: string | null; tools: string[] }>;
  attachedAssetId: string;
}

const collectDiagnostics = async (
  harness: RealTeamKernelHarness,
  room: RealTeamProjectRoom | null,
  debugState: {
    deliveryUrl: string | null;
    htmlObservation: RealProjectRoomRealisticUserDiagnostics["htmlObservation"];
    apiObservation: RealProjectRoomRealisticUserDiagnostics["apiObservation"];
  },
): Promise<RealProjectRoomRealisticUserDiagnostics> => {
  const [backendAttention, frontendAttention, backendCalls, frontendCalls, designSvg, indexHtml, serverJs] =
    await Promise.all([
      harness.kernel.inspectAttentionState(harness.backendSession.id),
      harness.kernel.inspectAttentionState(harness.frontendSession.id),
      listParticipantModelCalls(harness, harness.backendSession.id),
      listParticipantModelCalls(harness, harness.frontendSession.id),
      findWorkspaceFile(harness.workspacePath, "", "design.svg", DESIGN_MARKERS),
      findWorkspaceFile(harness.workspacePath, "", "index.html", HTML_MARKERS),
      readWorkspaceTextIfExists(harness.workspacePath, "server.js"),
    ]);

  return {
    workspacePath: harness.workspacePath,
    deliveryUrl: debugState.deliveryUrl,
    htmlObservation: debugState.htmlObservation,
    apiObservation: debugState.apiObservation,
    roomMessages: room ? mapMessages(harness.listProjectRoomMessages(room, 120)) : [],
    roomAssets: room
      ? harness.listProjectRoomAssets(room).map((asset) => ({
          assetId: asset.assetId,
          name: asset.name,
          mimeType: asset.mimeType,
          uploadedByActorId: asset.uploadedByActorId,
        }))
      : [],
    workspaceFiles: { designSvg, indexHtml, serverJs },
    backendAttention,
    frontendAttention,
    backendModelCalls: backendCalls.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: readModelOutcomeCode(call),
      tools: extractToolTraceTools(call),
    })),
    frontendModelCalls: frontendCalls.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: readModelOutcomeCode(call),
      tools: extractToolTraceTools(call),
    })),
  };
};

export const runRealProjectRoomRealisticUserScenario = async (
  harness: RealTeamKernelHarness,
): Promise<RealProjectRoomRealisticUserScenarioResult> => {
  const debugState: {
    deliveryUrl: string | null;
    htmlObservation: RealProjectRoomRealisticUserDiagnostics["htmlObservation"];
    apiObservation: RealProjectRoomRealisticUserDiagnostics["apiObservation"];
  } = {
    deliveryUrl: null,
    htmlObservation: null,
    apiObservation: null,
  };
  let room: RealTeamProjectRoom | null = null;

  try {
    room = await harness.createProjectRoom({
      title: "realistic-project-room",
      metadata: { scenario: "realistic-user-project-room" },
    });
    await harness.focusProjectRoom(room);

    const expectedUrl = `http://127.0.0.1:${await allocateEphemeralPort()}/`;
    const kickoffAt = Date.now();
    const kickoffSent = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: [
        "两位好，我不懂技术，想做一个很小的本地演示页给同事看。",
        `如果需要起服务，我这边只会打开这个地址：${expectedUrl}`,
        "你们自己分工就行，我只看最后结果。",
        "页面里我想看到“小队项目看板”、“接口状态”、“准备好了”。",
        "另外请给我一张简单设计图，文件名就叫 design.svg，放到群里给我看看。",
        "页面读 /api/status 就行，接口返回里请让我能看到 READY-API 和 PROJECT-BOARD-V1，方便我确认前后端已经接好了。",
        "做好后把最终能打开的同一个地址发到这个群里。",
      ].join("\n"),
    });
    if (!kickoffSent.ok) {
      throw new Error(`failed to send realistic project kickoff: ${kickoffSent.reason ?? "unknown"}`);
    }

    const frontendCoordinationMessage = await waitForRoomMessage(harness, room, {
      label: "frontend realistic coordination",
      predicate: (message) => isFrontendCoordinationMessage(message, harness.frontendActorId, kickoffAt),
    });
    const backendCoordinationMessage = await waitForRoomMessage(harness, room, {
      label: "backend realistic coordination",
      predicate: (message) => isBackendCoordinationMessage(message, harness.backendActorId, kickoffAt),
    });

    const designFile = await waitForWorkspaceFile(harness, {
      baseName: DESIGN_FILE_NAME,
      markers: DESIGN_MARKERS,
      label: "realistic design svg",
    });
    const bridge = await harness.bridgeWorkspaceFileToProjectRoomAttachment({
      room,
      participant: "frontend",
      relativePath: designFile.relativePath,
      mimeType: "image/svg+xml",
      messageText: `设计图附件：${DESIGN_FILE_NAME}`,
    });
    if (!bridge.sent.ok) {
      throw new Error(`failed to bridge realistic design attachment: ${bridge.sent.reason ?? "unknown"}`);
    }

    const designAttachmentMessage = await waitForRoomMessage(harness, room, {
      label: "realistic design attachment message",
      predicate: (message) =>
        message.senderContactId === harness.frontendActorId &&
        message.content.includes(DESIGN_FILE_NAME) &&
        message.attachments?.some((attachment) => attachment.assetId === bridge.asset.assetId) === true,
    });

    const apiAnswerMessage = await waitForRoomMessage(harness, room, {
      label: "backend realistic api answer",
      predicate: (message) => isBackendApiAnswerMessage(message, harness.backendActorId, kickoffAt),
    });
    const apiQuestionMessage =
      harness
        .listProjectRoomMessages(room, 120)
        .filter(
          (message) =>
            message.createdAt > frontendCoordinationMessage.createdAt &&
            message.createdAt < apiAnswerMessage.createdAt &&
            isApiQuestionMessage(message, harness.frontendActorId, frontendCoordinationMessage.createdAt + 1),
        )
        .at(-1) ?? null;

    const finalUrlMessage = await waitForRoomMessage(harness, room, {
      label: "realistic project final url",
      predicate: (message) =>
        isFinalProjectUrlMessage(message, harness.backendActorId, expectedUrl, designAttachmentMessage.createdAt + 1),
    });

    debugState.deliveryUrl = expectedUrl;
    const htmlResult = await waitForUrlMarkers(expectedUrl, HTML_MARKERS, {
      label: "realistic project html",
      timeoutMs: REALISTIC_DELIVERY_TIMEOUT_MS,
      onObservation: (observation) => {
        debugState.htmlObservation = observation;
      },
    });
    const apiResult = await waitForUrlMarkers(`${expectedUrl.replace(/\/?$/u, "")}/api/status`, API_MARKERS, {
      label: "realistic project api",
      timeoutMs: REALISTIC_DELIVERY_TIMEOUT_MS,
      onObservation: (observation) => {
        debugState.apiObservation = observation;
      },
    });

    const acceptanceText = `我刚打开了，${expectedUrl} 这版可以，页面和接口都对。`;
    const acceptanceSent = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: acceptanceText,
    });
    if (!acceptanceSent.ok) {
      throw new Error(`failed to send realistic project acceptance: ${acceptanceSent.reason ?? "unknown"}`);
    }

    const userAcceptanceMessage = await waitForRoomMessage(harness, room, {
      label: "realistic user acceptance",
      predicate: (message) => message.senderContactId === harness.userActorId && message.content === acceptanceText,
    });

    const [backendAttention, frontendAttention, backendCalls, frontendCalls] = await Promise.all([
      waitForParticipantAttentionSettled(harness, harness.backendSession.id),
      waitForParticipantAttentionSettled(harness, harness.frontendSession.id),
      listParticipantModelCalls(harness, harness.backendSession.id),
      listParticipantModelCalls(harness, harness.frontendSession.id),
    ]);

    return {
      projectRoom: room,
      frontendCoordinationMessage,
      backendCoordinationMessage,
      apiQuestionMessage,
      apiAnswerMessage,
      designSvg: designFile.content,
      designAttachmentMessage,
      finalUrlMessage,
      deliveryUrl: expectedUrl,
      htmlBody: htmlResult.body,
      apiBody: apiResult.body,
      userAcceptanceMessage,
      backendAttention,
      frontendAttention,
      backendModelCalls: backendCalls.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
        tools: extractToolTraceTools(call),
      })),
      frontendModelCalls: frontendCalls.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
        tools: extractToolTraceTools(call),
      })),
      attachedAssetId: bridge.asset.assetId,
    };
  } catch (error) {
    const diagnostics = await collectDiagnostics(harness, room, debugState);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`realistic project-room scenario failed: ${reason}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
};
