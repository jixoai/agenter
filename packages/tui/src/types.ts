import type { RuntimeClientState, SessionInstance } from "@agenter/client-sdk";

export interface TuiViewModel {
  connected: boolean;
  activeInstanceId: string | null;
  instances: SessionInstance[];
  messages: RuntimeClientState["chatsByInstance"][string];
  phaseText: string;
}

export const buildViewModel = (state: RuntimeClientState, activeInstanceId: string | null): TuiViewModel => {
  const activeRuntime = activeInstanceId ? state.runtimes[activeInstanceId] : undefined;
  return {
    connected: state.connected,
    activeInstanceId,
    instances: state.instances,
    messages: activeInstanceId ? state.chatsByInstance[activeInstanceId] ?? [] : [],
    phaseText: activeRuntime ? `${activeRuntime.loopPhase} / ${activeRuntime.stage}` : "idle",
  };
};
