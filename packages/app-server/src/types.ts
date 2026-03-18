export type TaskStage = "idle" | "plan" | "act" | "observe" | "decide" | "done" | "error";

export interface TaskEvent {
  taskId: string;
  stage: TaskStage;
  timestamp: number;
  summary: string;
}

export interface ChatImageAttachment {
  assetId: string;
  kind: "image";
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface ModelCapabilities {
  imageInput: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  channel?: "to_user" | "self_talk" | "tool_call" | "tool_result";
  format?: "plain" | "markdown";
  tool?: {
    name: string;
    ok?: boolean;
  };
  attachments?: ChatImageAttachment[];
}

export interface AppServerLogger {
  log: (input: {
    channel: "agent" | "error";
    level: "debug" | "info" | "warn" | "error";
    message: string;
    meta?: Record<string, string | number | boolean | null>;
  }) => void;
}
