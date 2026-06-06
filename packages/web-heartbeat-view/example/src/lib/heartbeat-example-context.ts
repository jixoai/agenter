import { getContext, setContext } from "svelte";

import type { HeartbeatExampleState } from "./heartbeat-example-state.svelte";

const heartbeatExampleContext = Symbol("heartbeat-example");

export const setHeartbeatExampleState = (state: HeartbeatExampleState): void => {
  setContext(heartbeatExampleContext, state);
};

export const useHeartbeatExampleState = (): HeartbeatExampleState => {
  const state = getContext<HeartbeatExampleState | null>(heartbeatExampleContext);
  if (!state) {
    throw new Error("Heartbeat example state is missing from Framework7 route context.");
  }
  return state;
};
