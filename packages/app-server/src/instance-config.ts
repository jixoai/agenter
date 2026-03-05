import type { ResolvedSessionConfig, SessionTerminalConfig } from "./session-config";
import { resolveSessionConfig } from "./session-config";

export type InstanceTerminalConfig = SessionTerminalConfig;
export type ResolvedInstanceConfig = ResolvedSessionConfig;

export const resolveInstanceConfig = resolveSessionConfig;
