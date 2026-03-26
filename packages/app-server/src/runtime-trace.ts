import { randomUUID } from "node:crypto";

import type {
  SessionTerminalOutcome,
  SessionTraceEvent,
  SessionTraceRef,
  SessionTraceRefKind,
} from "@agenter/session-system";

const createTraceToken = (): string => randomUUID().replace(/-/g, "");

export const createTraceId = (): string => `trace_${createTraceToken()}`;
export const createSpanId = (): string => `span_${createTraceToken()}`;
export const createTraceEventId = (): string => `event_${createTraceToken()}`;

export const createTraceRef = (
  kind: SessionTraceRefKind,
  ref: string,
  input?: {
    label?: string;
    attributes?: Record<string, unknown>;
  },
): SessionTraceRef => ({
  kind,
  ref,
  label: input?.label,
  attributes: input?.attributes ? { ...input.attributes } : undefined,
});

export const createTraceEvent = (
  name: string,
  input?: {
    timestamp?: number;
    status?: SessionTraceEvent["status"];
    refs?: SessionTraceRef[];
    attributes?: Record<string, unknown>;
  },
): SessionTraceEvent => ({
  id: createTraceEventId(),
  name,
  timestamp: input?.timestamp ?? Date.now(),
  status: input?.status,
  refs: input?.refs ? [...input.refs] : undefined,
  attributes: input?.attributes ? { ...input.attributes } : undefined,
});

const toReasonString = (reason: unknown): string | undefined => {
  if (typeof reason === "string") {
    return reason;
  }
  if (reason instanceof Error) {
    return reason.message;
  }
  return undefined;
};

export const mapAbortReasonToOutcome = (reason: unknown): SessionTerminalOutcome => {
  const message = toReasonString(reason);
  if (message === "session.abort" || message === "loopbus.abort") {
    return {
      code: "aborted",
      message,
      reason: message,
    };
  }
  if (message === "session.stop" || message === "session.pause" || message === "loopbus.pause") {
    return {
      code: "stopped",
      message,
      reason: message,
      retryable: true,
    };
  }
  return {
    code: "cancelled",
    message,
    reason: message,
    retryable: true,
  };
};

export const toTerminalOutcomeFromError = (error: unknown): SessionTerminalOutcome => {
  if (error instanceof Error) {
    return {
      code: "error",
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    };
  }
  return {
    code: "error",
    message: String(error),
    error,
  };
};
