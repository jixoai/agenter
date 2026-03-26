export type SessionTraceRefKind =
  | "attention.context"
  | "attention.commit"
  | "cycle.frame"
  | "message.channel"
  | "model.call"
  | "source.read"
  | "terminal.pty"
  | "tool.call"
  | "attention.hook"
  | string;

export interface SessionTraceRef {
  kind: SessionTraceRefKind;
  ref: string;
  label?: string;
  attributes?: Record<string, unknown>;
}

export interface SessionTraceLink {
  kind: string;
  traceId?: string;
  spanId?: string;
  ref?: SessionTraceRef;
  attributes?: Record<string, unknown>;
}

export type SessionTraceEventStatus = "info" | "ok" | "error";

export interface SessionTraceEvent {
  id: string;
  name: string;
  timestamp: number;
  status?: SessionTraceEventStatus;
  refs?: SessionTraceRef[];
  attributes?: Record<string, unknown>;
}

export type SessionTerminalOutcomeCode = "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";

export interface SessionTerminalOutcome {
  code: SessionTerminalOutcomeCode;
  message?: string;
  retryable?: boolean;
  error?: unknown;
  reason?: string;
}

export interface SessionTraceIdentity {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
}

export type SessionTraceStatus = "running" | "done" | "error" | "cancelled";
