import type { RuntimeClientState } from "@agenter/client-sdk";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { RuntimeStoreReader } from "../src/app-context";
import { useRuntimeStoreSelector } from "../src/app-context";

const createState = (): RuntimeClientState => ({
  connected: true,
  connectionStatus: "connected",
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  chatsBySession: {},
  chatCyclesBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  loopbusStateLogsBySession: {},
  loopbusTracesBySession: {},
  apiCallsBySession: {},
  modelCallsBySession: {},
  apiCallRecordingBySession: {},
  notifications: [],
  unreadBySession: {},
});

type Listener = (state: RuntimeClientState) => void;

const createRuntimeStoreReader = (
  initialState: RuntimeClientState,
): RuntimeStoreReader & {
  publish: (nextState: RuntimeClientState) => void;
} => {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (nextState) => {
      state = nextState;
      for (const listener of listeners) {
        listener(state);
      }
    },
  };
};

describe("Feature: runtime selector isolation", () => {
  test("Scenario: Given unrelated runtime updates When one selector slice changes Then only the matching subscriber rerenders", async () => {
    const store = createRuntimeStoreReader(createState());
    const renderCount = {
      connected: 0,
      sessions: 0,
    };

    const ConnectedProbe = () => {
      renderCount.connected += 1;
      const connected = useRuntimeStoreSelector(store, (state) => state.connected);
      return <output data-testid="connected-probe">{connected ? "connected" : "disconnected"}</output>;
    };

    const SessionsProbe = () => {
      renderCount.sessions += 1;
      const sessionCount = useRuntimeStoreSelector(store, (state) => state.sessions.length);
      return <output data-testid="sessions-probe">{sessionCount}</output>;
    };

    render(
      <div>
        <ConnectedProbe />
        <SessionsProbe />
      </div>,
    );

    expect(screen.getByTestId("connected-probe")).toHaveTextContent("connected");
    expect(screen.getByTestId("sessions-probe")).toHaveTextContent("0");
    expect(renderCount).toEqual({
      connected: 1,
      sessions: 1,
    });

    act(() => {
      store.publish({
        ...store.getState(),
        sessions: [
          {
            id: "session-1",
            name: "Shell",
            cwd: "/repo/demo",
            avatar: "jon",
            createdAt: "2026-03-20T01:00:00.000Z",
            updatedAt: "2026-03-20T01:00:00.000Z",
            status: "running",
            storageState: "active",
            sessionRoot: "/tmp/session-1",
            storeTarget: "global",
          },
        ],
      });
    });

    expect(screen.getByTestId("sessions-probe")).toHaveTextContent("1");
    expect(renderCount).toEqual({
      connected: 1,
      sessions: 2,
    });

    act(() => {
      store.publish({
        ...store.getState(),
        connected: false,
        connectionStatus: "reconnecting",
      });
    });

    expect(screen.getByTestId("connected-probe")).toHaveTextContent("disconnected");
    expect(renderCount).toEqual({
      connected: 2,
      sessions: 2,
    });
  });
});
