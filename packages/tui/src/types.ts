import type { RuntimeClientState, SessionEntry } from "@agenter/client-sdk";

export interface TuiViewModel {
  connected: boolean;
  activeSessionId: string | null;
  sessions: SessionEntry[];
  messages: RuntimeClientState["chatsBySession"][string];
  tasks: RuntimeClientState["tasksBySession"][string];
  loopbusTraces: RuntimeClientState["loopbusTracesBySession"][string];
  modelCalls: RuntimeClientState["modelCallsBySession"][string];
  apiRecording: RuntimeClientState["apiCallRecordingBySession"][string] | { enabled: boolean; refCount: number };
  phaseText: string;
}

export const buildViewModel = (state: RuntimeClientState, activeSessionId: string | null): TuiViewModel => {
  const activeRuntime = activeSessionId ? state.runtimes[activeSessionId] : undefined;
  return {
    connected: state.connected,
    activeSessionId,
    sessions: state.sessions,
    messages: activeSessionId ? (state.chatsBySession[activeSessionId] ?? []) : [],
    tasks: activeSessionId ? (state.tasksBySession[activeSessionId] ?? []) : [],
    loopbusTraces: activeSessionId ? (state.loopbusTracesBySession?.[activeSessionId] ?? []) : [],
    modelCalls: activeSessionId ? (state.modelCallsBySession?.[activeSessionId] ?? []) : [],
    apiRecording: activeSessionId
      ? (state.apiCallRecordingBySession?.[activeSessionId] ?? { enabled: false, refCount: 0 })
      : { enabled: false, refCount: 0 },
    phaseText: activeRuntime ? `${activeRuntime.loopPhase} / ${activeRuntime.stage}` : "idle",
  };
};
