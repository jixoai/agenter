import type { RuntimeClientState, SessionEntry } from "@agenter/client-sdk";

export interface TuiViewModel {
  connected: boolean;
  activeSessionId: string | null;
  sessions: SessionEntry[];
  messages: RuntimeClientState["chatsBySession"][string];
  tasks: RuntimeClientState["tasksBySession"][string];
  phaseText: string;
}

export const buildViewModel = (state: RuntimeClientState, activeSessionId: string | null): TuiViewModel => {
  const activeRuntime = activeSessionId ? state.runtimes[activeSessionId] : undefined;
  return {
    connected: state.connected,
    activeSessionId,
    sessions: state.sessions,
    messages: activeSessionId ? state.chatsBySession[activeSessionId] ?? [] : [],
    tasks: activeSessionId ? state.tasksBySession[activeSessionId] ?? [] : [],
    phaseText: activeRuntime ? `${activeRuntime.loopPhase} / ${activeRuntime.stage}` : "idle",
  };
};
