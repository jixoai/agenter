import { z } from "zod";

import type { InstanceMeta } from "./instance-registry";
import type { InstanceRuntimeSnapshot } from "./instance-runtime";

export const APP_PROTOCOL_VERSION = 1 as const;

export const settingsKindSchema = z.enum(["settings", "agenter", "system", "template", "contract"]);
export type SettingsKind = z.infer<typeof settingsKindSchema>;

export interface RuntimeSnapshotPayload {
  version: typeof APP_PROTOCOL_VERSION;
  timestamp: number;
  lastEventId: number;
  instances: InstanceMeta[];
  runtimes: Record<string, InstanceRuntimeSnapshot>;
}

export interface RuntimeEventEnvelope<TType extends string = string, TPayload = unknown> {
  version: typeof APP_PROTOCOL_VERSION;
  eventId: number;
  timestamp: number;
  type: TType;
  instanceId?: string;
  payload: TPayload;
}

export type RuntimeEventType =
  | "instance.updated"
  | "instance.deleted"
  | "chat.message"
  | "runtime.phase"
  | "runtime.stage"
  | "runtime.stats"
  | "runtime.focusedTerminal"
  | "terminal.snapshot"
  | "terminal.status"
  | "runtime.error";

export type AnyRuntimeEvent = RuntimeEventEnvelope<RuntimeEventType, unknown>;
