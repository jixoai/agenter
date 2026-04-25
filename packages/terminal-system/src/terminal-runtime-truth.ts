export type TerminalProcessPhase = "not_started" | "running" | "stopped";
export type TerminalStopReason = "killed" | "exited" | "startup_failed";

export interface TerminalObservedIdentity {
  currentPath?: string;
  currentTitle?: string;
}

export interface TerminalLifecycleState {
  processPhase: TerminalProcessPhase;
  lastStopReason?: TerminalStopReason | null;
  lastExitCode?: number | null;
  lastExitSignal?: string | null;
  lastStoppedAt?: number | null;
}

export const INITIAL_TERMINAL_LIFECYCLE_STATE: TerminalLifecycleState = {
  processPhase: "not_started",
  lastStopReason: null,
  lastExitCode: null,
  lastExitSignal: null,
  lastStoppedAt: null,
};
