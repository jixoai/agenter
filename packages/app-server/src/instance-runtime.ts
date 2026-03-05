import type { RuntimeEvent, RuntimeEventMap, SessionRuntimeOptions, SessionRuntimeSnapshot } from "./session-runtime";
import { SessionRuntime } from "./session-runtime";

export type InstanceRuntimeSnapshot = SessionRuntimeSnapshot;
export type InstanceRuntimeOptions = SessionRuntimeOptions;

export type { RuntimeEvent, RuntimeEventMap };

export const InstanceRuntime = SessionRuntime;
