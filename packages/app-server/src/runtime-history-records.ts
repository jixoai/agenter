import type { SessionCollectedInput, SessionTerminalOutcome, SessionTraceRef } from "@agenter/session-system";

import type { ChatMessage, ChatToolInvocation } from "./types";

export interface RuntimeCycleRecord {
  id: number;
  seq: number;
  prevCycleId: number | null;
  createdAt: number;
  updatedAt: number;
  wake: { source: string };
  collectedInputs: SessionCollectedInput[];
  extendsRecord: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface RuntimeLoopStateLogRecord {
  id: number;
  timestamp: number;
  stateVersion: number;
  event: string;
  prevHash: string | null;
  stateHash: string;
  patch: unknown;
}

export interface RuntimeLoopTraceLink {
  kind: string;
  traceId?: string;
  spanId?: string;
  ref?: SessionTraceRef;
  attributes?: Record<string, unknown>;
}

export interface RuntimeLoopTraceEvent {
  id: string;
  name: string;
  timestamp: number;
  status?: string;
  attributes?: Record<string, unknown>;
}

export interface RuntimeLoopTraceRecord {
  id: number;
  seq: number;
  cycleId: number;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  kind: string;
  name: string;
  status: "running" | "done" | "error" | "cancelled";
  startedAt: number;
  endedAt: number;
  refs: SessionTraceRef[];
  links: RuntimeLoopTraceLink[];
  events: RuntimeLoopTraceEvent[];
  attributes: Record<string, unknown>;
  outcome?: SessionTerminalOutcome;
}

export interface RuntimeTerminalActivityRecord {
  id: number;
  terminalId: string;
  createdAt: number;
  kind: "cycle_input" | "message" | "terminal_read" | "terminal_write";
  cycleId: number | null;
  actorId?: string;
  role?: ChatMessage["role"];
  channel?: ChatMessage["channel"] | "user_input";
  title: string;
  content: string;
  tool?: ChatToolInvocation;
  detail?: unknown;
}
