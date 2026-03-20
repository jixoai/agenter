import { describe, expect, test } from "vitest";

import { phaseToStatus, resolveChatRouteNotice, resolveSessionToolbarState } from "../src/features/chat/chat-route-status";

describe("Feature: chat route status resolution", () => {
  test("Scenario: Given an unknown backend notice When resolving the route notice Then the UI exposes a stable recovery message", () => {
    expect(
      resolveChatRouteNotice({
        notice: "Unknown error",
        session: {
          status: "running",
        },
        runtime: {
          started: true,
          terminals: [{ terminalId: "iflow", running: true, status: "IDLE", seq: 1, cwd: "/repo/demo" }],
          loopPhase: "waiting_commits",
          stage: "idle",
        },
      }),
    ).toEqual({
      tone: "destructive",
      message: "Something failed while preparing this session.",
    });
  });

  test("Scenario: Given a stopped session When resolving toolbar and activity state Then the chat surface offers one start action", () => {
    const session = {
      status: "stopped",
    } as const;

    expect(phaseToStatus(session, undefined)).toBe("stopped");
    expect(resolveSessionToolbarState(session, undefined)).toEqual({
      label: "Session stopped",
      tone: "neutral",
      actionLabel: "Start session",
      action: "start",
      disabled: false,
    });
  });

  test("Scenario: Given a stale started runtime after stop When resolving toolbar notice and activity Then stopped semantics win over runtime leftovers", () => {
    const session = {
      status: "stopped",
    } as const;
    const runtime = {
      started: true,
      terminals: [{ terminalId: "iflow", running: true, status: "IDLE", seq: 1, cwd: "/repo/demo" }],
      loopPhase: "calling_model",
      stage: "act",
    } as const;

    expect(phaseToStatus(session, runtime)).toBe("stopped");
    expect(resolveSessionToolbarState(session, runtime)).toEqual({
      label: "Session stopped",
      tone: "neutral",
      actionLabel: "Start session",
      action: "start",
      disabled: false,
    });
    expect(
      resolveChatRouteNotice({
        notice: "",
        session,
        runtime,
      }),
    ).toEqual({
      tone: "warning",
      message: "Session is stopped. Start it to continue.",
    });
  });
});
