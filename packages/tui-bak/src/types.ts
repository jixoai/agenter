import type { RuntimeChatMessage, RuntimeClientState, SessionEntry } from "@agenter/client-sdk";

type TuiChatMessage = RuntimeChatMessage & { role: "user" | "assistant" };

export interface TuiViewModel {
  connected: boolean;
  activeSessionId: string | null;
  sessions: SessionEntry[];
  messages: TuiChatMessage[];
  tasks: RuntimeClientState["tasksBySession"][string];
  loopbusTraces: RuntimeClientState["observabilityTracesBySession"][string];
  modelCalls: RuntimeClientState["modelCallsBySession"][string];
  apiRecording: RuntimeClientState["apiCallRecordingBySession"][string] | { enabled: boolean; refCount: number };
  phaseText: string;
}

export const buildViewModel = (state: RuntimeClientState, activeSessionId: string | null): TuiViewModel => {
  const activeRuntime = activeSessionId ? state.runtimes[activeSessionId] : undefined;
  const messages = activeSessionId ? (state.chatsBySession[activeSessionId] ?? []) : [];
  return {
    connected: state.connected,
    activeSessionId,
    sessions: state.sessions,
    messages: messages.filter((message): message is TuiChatMessage => message.role === "user" || message.role === "assistant"),
    tasks: activeSessionId ? (state.tasksBySession[activeSessionId] ?? []) : [],
    loopbusTraces: activeSessionId ? (state.observabilityTracesBySession?.[activeSessionId] ?? []) : [],
    modelCalls: activeSessionId ? (state.modelCallsBySession?.[activeSessionId] ?? []) : [],
    apiRecording: activeSessionId
      ? (state.apiCallRecordingBySession?.[activeSessionId] ?? { enabled: false, refCount: 0 })
      : { enabled: false, refCount: 0 },
    phaseText: activeRuntime ? `${activeRuntime.schedulerPhase} / ${activeRuntime.stage}` : "idle",
  };
};
