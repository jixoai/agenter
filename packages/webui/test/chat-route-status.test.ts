import { describe, expect, test } from "vitest";

import {
  phaseToStatus,
  resolveChatConversationState,
  resolveChatRouteNotice,
  resolveSessionStatusPillState,
} from "../src/features/chat/chat-route-status";

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
          terminalCount: 1,
          loopPhase: "waiting_commits",
          stage: "idle",
        },
      }),
    ).toEqual({
      tone: "destructive",
      message: "Something failed while preparing this session.",
    });
  });

  test("Scenario: Given a stopped session When resolving the route pill and activity state Then the chat surface offers one start action", () => {
    const session: Parameters<typeof phaseToStatus>[0] = {
      status: "stopped",
    };

    expect(phaseToStatus(session, undefined)).toBe("stopped");
    expect(resolveSessionStatusPillState(session, undefined)).toEqual({
      label: "Session stopped",
      tone: "neutral",
      primaryActionLabel: "Start session",
      primaryAction: "start",
      disabled: false,
    });
  });

  test("Scenario: Given a paused session When resolving the route pill and notice Then the chat surface offers resume while avoiding duplicated warning banners", () => {
    const session: Parameters<typeof phaseToStatus>[0] = {
      status: "paused",
    };
    const runtime: NonNullable<Parameters<typeof phaseToStatus>[1]> = {
      started: true,
      terminalCount: 1,
      loopPhase: "waiting_commits",
      stage: "idle",
    };

    expect(phaseToStatus(session, runtime)).toBe("paused");
    expect(resolveSessionStatusPillState(session, runtime)).toEqual({
      label: "Session paused",
      tone: "warning",
      primaryActionLabel: "Resume session",
      primaryAction: "start",
      disabled: false,
    });
    expect(
      resolveChatRouteNotice({
        notice: "",
        session,
        runtime,
      }),
    ).toBeNull();
  });

  test("Scenario: Given a stale started runtime after stop When resolving the pill notice and activity Then stopped semantics win over runtime leftovers", () => {
    const session: Parameters<typeof phaseToStatus>[0] = {
      status: "stopped",
    };
    const runtime: NonNullable<Parameters<typeof phaseToStatus>[1]> = {
      started: true,
      terminalCount: 1,
      loopPhase: "calling_model",
      stage: "act",
    };

    expect(phaseToStatus(session, runtime)).toBe("stopped");
    expect(resolveSessionStatusPillState(session, runtime)).toEqual({
      label: "Session stopped",
      tone: "neutral",
      primaryActionLabel: "Start session",
      primaryAction: "start",
      disabled: false,
    });
    expect(
      resolveChatRouteNotice({
        notice: "",
        session,
        runtime,
      }),
    ).toBeNull();
  });

  test("Scenario: Given chat hydration states When resolving the conversation surface Then empty-loading and ready-loading only appear during initial history hydration", () => {
    expect(
      resolveChatConversationState({
        connected: true,
        hasData: false,
        chatPaging: { hydrated: false, hasMore: true, loading: true, loadingOlder: false },
        cyclePaging: { hydrated: false, hasMore: true, loading: true, loadingOlder: false },
      }),
    ).toBe("empty-loading");

    expect(
      resolveChatConversationState({
        connected: true,
        hasData: true,
        chatPaging: { hydrated: false, hasMore: true, loading: true, loadingOlder: false },
        cyclePaging: { hydrated: true, hasMore: true, loading: false, loadingOlder: false },
      }),
    ).toBe("ready-loading");

    expect(
      resolveChatConversationState({
        connected: true,
        hasData: true,
        chatPaging: { hydrated: true, hasMore: true, loading: false, loadingOlder: false },
        cyclePaging: { hydrated: true, hasMore: true, loading: false, loadingOlder: false },
      }),
    ).toBe("ready-idle");

    expect(
      resolveChatConversationState({
        connected: false,
        hasData: false,
        chatPaging: { hydrated: false, hasMore: true, loading: true, loadingOlder: false },
        cyclePaging: { hydrated: false, hasMore: true, loading: true, loadingOlder: false },
      }),
    ).toBe("empty-idle");
  });
});
