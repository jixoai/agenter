export type TerminalProcessPhase = "not_started" | "running" | "killed";
export type TerminalStopReason = "killed" | "exited" | "startup_failed";
export type TerminalLifecycleTransition = "bootstrapping" | "killing";

export interface TerminalObservedIdentity {
  currentPath?: string;
  currentTitle?: string;
}

export interface TerminalLifecycleState {
  processPhase: TerminalProcessPhase;
  archivedAt?: number | null;
  lastStopReason?: TerminalStopReason | null;
  lastExitCode?: number | null;
  lastExitSignal?: string | null;
  lastStoppedAt?: number | null;
}

export const INITIAL_TERMINAL_LIFECYCLE_STATE: TerminalLifecycleState = {
  processPhase: "not_started",
  archivedAt: null,
  lastStopReason: null,
  lastExitCode: null,
  lastExitSignal: null,
  lastStoppedAt: null,
};
