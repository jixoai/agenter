export type RenderSource = "snapshot";

export type TaskStage = "idle" | "plan" | "act" | "observe" | "decide" | "done" | "error";

export interface TerminalSnapshot {
  seq: number;
  timestamp: number;
  cols: number;
  rows: number;
  lines: string[];
  richLines: TerminalRichLine[];
  cursor: { x: number; y: number };
}

export interface TerminalSpan {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface TerminalRichLine {
  plain: string;
  spans: TerminalSpan[];
}

export type JsonOpType = "add" | "remove" | "replace";

export interface JsonOp {
  op: JsonOpType;
  path: string;
  value?: string | number;
}

export interface JsonOpBatch {
  seq: number;
  timestamp: number;
  ops: JsonOp[];
}

export interface DebugLogLine {
  id: string;
  timestamp: number;
  channel: "pty.in" | "pty.out" | "agent" | "ui" | "error";
  level: "debug" | "info" | "warn" | "error";
  message: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface TaskEvent {
  taskId: string;
  stage: TaskStage;
  timestamp: number;
  summary: string;
  contextRef?: {
    snapshotSeq?: number;
    opSeq?: number;
  };
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
}

export interface AppStatus {
  stage: TaskStage;
  process: "stopped" | "running";
  renderSource: RenderSource;
  cwd?: string;
  terminal?: string;
  focusedTerminalId?: string;
  dirtyTerminalCount?: number;
  terminalSeq?: number;
  terminalCursor?: { x: number; y: number };
  terminalSize?: { cols: number; rows: number };
  loopCount?: number;
  aiCallCount?: number;
  contextChars?: number;
  totalContextChars?: number;
  promptTokens?: number;
  totalPromptTokens?: number;
}

export const createEmptySnapshot = (): TerminalSnapshot => ({
  seq: 0,
  timestamp: Date.now(),
  cols: 80,
  rows: 24,
  lines: Array.from({ length: 24 }, () => ""),
  richLines: Array.from({ length: 24 }, () => ({ plain: "", spans: [] })),
  cursor: { x: 0, y: 0 },
});
