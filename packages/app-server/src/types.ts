import type { SessionAssetKind } from "@agenter/session-system";

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

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  imageInput: boolean;
  nativeCompact: boolean;
  summarizeFallback: boolean;
  fileUpload: boolean;
  mcpCatalog: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  cycleId?: number | null;
  channel?: "to_user" | "self_talk" | "tool_call" | "tool_result";
  format?: "plain" | "markdown";
  tool?: {
    name: string;
    ok?: boolean;
  };
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
