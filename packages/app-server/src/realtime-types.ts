import { z } from "zod";

import type { SessionMeta } from "./session-catalog";
import type { SessionRuntimeSnapshot } from "./session-runtime";

export const APP_PROTOCOL_VERSION = 1 as const;

export const settingsKindSchema = z.enum(["settings", "agenter", "system", "template", "contract"]);
export type SettingsKind = z.infer<typeof settingsKindSchema>;

export interface RuntimeSnapshotPayload {
  version: typeof APP_PROTOCOL_VERSION;
  timestamp: number;
  lastEventId: number;
  sessions: SessionMeta[];
  runtimes: Record<string, SessionRuntimeSnapshot>;
}

export interface RuntimeEventEnvelope<TType extends string = string, TPayload = unknown> {
  version: typeof APP_PROTOCOL_VERSION;
  eventId: number;
  timestamp: number;
  type: TType;
  sessionId?: string;
  payload: TPayload;
}

export type RuntimeEventType =
  | "session.updated"
  | "session.deleted"
  | "chat.message"
  | "notification.updated"
  | "runtime.phase"
  | "runtime.stage"
  | "runtime.stats"
  | "runtime.focusedTerminal"
  | "runtime.loopbus.snapshot"
  | "runtime.loopbus.stateLog"
  | "runtime.loopbus.trace"
  | "runtime.loopbus.inputSignal"
  | "runtime.modelCall"
  | "runtime.apiCall"
  | "runtime.apiRecording"
  | "runtime.cycle.updated"
  | "terminal.snapshot"
  | "terminal.status"
  | "task.updated"
  | "task.deleted"
  | "task.triggered"
  | "task.source.changed"
  | "runtime.error";

export type AnyRuntimeEvent = RuntimeEventEnvelope<RuntimeEventType, unknown>;
