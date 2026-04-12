import type { SessionAssetKind } from "@agenter/session-system";
import type { MessageActorId, MessageKind, MessagePayload } from "@agenter/message-system";

export type TaskStage = "idle" | "plan" | "act" | "observe" | "decide" | "done" | "error";

export interface TaskEvent {
  taskId: string;
  stage: TaskStage;
  timestamp: number;
  summary: string;
}

export interface ChatSessionAsset {
  assetId: string;
  kind: SessionAssetKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface RoomMediaAsset extends ChatSessionAsset {
  createdAt: number;
  updatedAt: number;
  uploadedByActorId?: MessageActorId;
}

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  imageInput: boolean;
  nativeCompact: boolean;
  summarizeFallback: boolean;
  fileUpload: boolean;
  mcpCatalog: boolean;
}

export type ChatToolInvocationStatus = "waiting" | "running" | "success" | "failed" | "cancelled";

export interface ChatToolInvocationPayload {
  value: unknown;
  rawText?: string;
}

export interface ChatToolInvocation {
  invocationId: string;
  name: string;
  status: ChatToolInvocationStatus;
  startedAt: number;
  finishedAt?: number;
  call?: ChatToolInvocationPayload;
  result?: ChatToolInvocationPayload;
  error?: string;
}

export interface ChatMessage {
  id: string;
  chatId?: string;
  role: "user" | "assistant";
  content: string;
  messageKind?: MessageKind;
  messagePayload?: MessagePayload;
  timestamp: number;
  updatedAt?: number;
  visibleAt?: number;
  cycleId?: number | null;
  channel?: "to_user" | "self_talk" | "tool";
  format?: "plain" | "markdown";
  tool?: ChatToolInvocation;
  attachments?: ChatSessionAsset[];
}

export interface AppServerLogger {
  log: (input: {
    channel: "agent" | "error";
    level: "debug" | "info" | "warn" | "error";
    message: string;
    meta?: Record<string, string | number | boolean | null>;
  }) => void;
}
