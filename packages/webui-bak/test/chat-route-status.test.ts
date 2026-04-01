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
          lastError: undefined,
        },
        runtime: {
          started: true,
          terminalCount: 1,
          schedulerPhase: "waiting_commits",
          stage: "idle",
          lastError: null,
          scheduler: null,
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
      lastError: undefined,
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
      lastError: undefined,
    };
    const runtime: NonNullable<Parameters<typeof phaseToStatus>[1]> = {
      started: true,
      terminalCount: 1,
      schedulerPhase: "waiting_commits",
      stage: "idle",
      lastError: null,
      scheduler: null,
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
      lastError: undefined,
    };
    const runtime: NonNullable<Parameters<typeof phaseToStatus>[1]> = {
      started: true,
      terminalCount: 1,
      schedulerPhase: "calling_model",
      stage: "act",
      lastError: null,
      scheduler: null,
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

  test("Scenario: Given the runtime reports a provider failure When resolving the route notice Then the UI surfaces the concrete backend error instead of a generic no-progress state", () => {
    expect(
      resolveChatRouteNotice({
        notice: "",
        session: {
          status: "running",
          lastError: undefined,
        },
        runtime: {
          started: true,
          terminalCount: 1,
          schedulerPhase: "waiting_commits",
          stage: "idle",
          lastError: "402 status code ({\"error\":{\"message\":\"Insufficient Balance\"}})",
          scheduler: null,
        },
      }),
    ).toEqual({
      tone: "destructive",
      message: "Provider request failed: Insufficient Balance",
    });
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

  test("Scenario: Given unresolved attention debt in backoff When resolving route status Then the UI stays explicit about retry instead of looking idle", () => {
    const session: Parameters<typeof phaseToStatus>[0] = {
      status: "running",
      lastError: undefined,
    };
    const runtime: NonNullable<Parameters<typeof phaseToStatus>[1]> = {
      started: true,
      terminalCount: 1,
      schedulerPhase: "waiting_commits",
      stage: "idle",
      lastError: null,
      scheduler: {
        runtimeStatus: "backoff",
        waitingReason: "attention_backoff",
        nextAutoWakeAt: Date.now() + 600,
        backoffMs: 600,
        retryCount: 2,
        blockedReason: null,
        lastProgressAt: Date.now() - 1_000,
        lastError: null,
      },
    };

    expect(phaseToStatus(session, runtime)).toBe("attention backoff");
    expect(resolveSessionStatusPillState(session, runtime)).toEqual({
      label: "Attention retrying",
      tone: "warning",
      primaryActionLabel: "Stop session",
      primaryAction: "stop",
      disabled: false,
    });
    expect(resolveChatRouteNotice({ notice: "", session, runtime })).toEqual({
      tone: "warning",
      message: "Attention work is waiting to retry in 600 ms.",
    });
  });

  test("Scenario: Given unresolved attention debt is waiting When resolving route status Then the UI keeps attention debt visible instead of idle completion", () => {
    const session: Parameters<typeof phaseToStatus>[0] = {
      status: "running",
      lastError: undefined,
    };
    const runtime: NonNullable<Parameters<typeof phaseToStatus>[1]> = {
      started: true,
      terminalCount: 1,
      schedulerPhase: "waiting_commits",
      stage: "idle",
      lastError: null,
      scheduler: {
        runtimeStatus: "waiting",
        waitingReason: "attention_debt",
        nextAutoWakeAt: null,
        backoffMs: null,
        retryCount: 1,
        blockedReason: null,
        lastProgressAt: Date.now() - 5_000,
        lastError: null,
      },
    };

    expect(phaseToStatus(session, runtime)).toBe("attention pending");
    expect(resolveSessionStatusPillState(session, runtime)).toEqual({
      label: "Attention pending",
      tone: "active",
      primaryActionLabel: "Stop session",
      primaryAction: "stop",
      disabled: false,
    });
    expect(resolveChatRouteNotice({ notice: "", session, runtime })).toBeNull();
  });
});
