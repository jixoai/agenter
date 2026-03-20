import type { RuntimeSnapshot, SessionEntry } from "@agenter/client-sdk";

import type { SessionToolbarTone } from "./SessionToolbar";
import { isLikelyErrorNotice, normalizeUserNotice } from "../../shared/notice";

type RouteSession = Pick<SessionEntry, "status">;
type RouteRuntime = Pick<RuntimeSnapshot["runtimes"][string], "started" | "loopPhase" | "stage"> & {
  terminalCount: number;
};

export const phaseToStatus = (session: RouteSession | null, runtime?: RouteRuntime): string => {
  if (!session) {
    return "idle";
  }
  if (session.status === "error") {
    return "error";
  }
  if (session.status === "stopped") {
    return "stopped";
  }
  if (session.status === "starting" && !runtime?.started) {
    return "starting";
  }
  if (runtime?.started) {
    if (runtime.loopPhase === "waiting_commits") {
      return "idle";
    }
    if (runtime.loopPhase === "calling_model") {
      return "waiting model";
    }
    if (runtime.loopPhase === "applying_outputs") {
      return "applying outputs";
    }
    if (runtime.loopPhase === "collecting_inputs") {
      return "syncing";
    }
    if (runtime.loopPhase === "persisting_cycle") {
      return "recording cycle";
    }
    if (runtime.stage === "observe") {
      return "waiting terminal";
    }
    if (runtime.stage === "plan" || runtime.stage === "decide") {
      return "thinking";
    }
    if (runtime.stage === "act") {
      return "executing";
    }
    if (runtime.stage === "done") {
      return "done";
    }
    return "active";
  }
  if (session.status === "starting") {
    return "starting";
  }
  return "idle";
};

export const resolveSessionToolbarState = (
  session: RouteSession | null,
  runtime?: RouteRuntime,
): {
  label: string;
  tone: SessionToolbarTone;
  actionLabel: string;
  action: "start" | "stop";
  disabled: boolean;
} => {
  if (!session) {
    return {
      label: "No session",
      tone: "neutral",
      actionLabel: "Start session",
      action: "start",
      disabled: true,
    };
  }
  if (session.status === "error") {
    return {
      label: "Session error",
      tone: "danger",
      actionLabel: "Start session",
      action: "start",
      disabled: false,
    };
  }
  if (session.status === "stopped") {
    return {
      label: "Session stopped",
      tone: "neutral",
      actionLabel: "Start session",
      action: "start",
      disabled: false,
    };
  }
  if (session.status === "starting") {
    return {
      label: "Session starting",
      tone: "warning",
      actionLabel: "Stop session",
      action: "stop",
      disabled: false,
    };
  }
  if (runtime?.started || session.status === "running") {
    return {
      label: "Session running",
      tone: "active",
      actionLabel: "Stop session",
      action: "stop",
      disabled: false,
    };
  }
  return {
    label: "Session stopped",
    tone: "neutral",
    actionLabel: "Start session",
    action: "start",
    disabled: false,
  };
};

export const resolveChatRouteNotice = (input: {
  notice: string;
  session: RouteSession | null;
  runtime?: RouteRuntime;
}): { tone: "info" | "warning" | "destructive"; message: string } | null => {
  if (input.notice && isLikelyErrorNotice(input.notice)) {
    return {
      tone: "destructive",
      message: normalizeUserNotice(input.notice, "Something failed while preparing this session."),
    };
  }

  if (!input.session) {
    return null;
  }

  if (input.session.status === "error") {
    return {
      tone: "destructive",
      message: "Session failed. Start it again to retry.",
    };
  }

  if (input.session.status === "stopped") {
    return {
      tone: "warning",
      message: "Session is stopped. Start it to continue.",
    };
  }

  if (!input.runtime?.started) {
    return {
      tone: "warning",
      message: "Session is stopped. Start it to continue.",
    };
  }

  if (input.runtime.terminalCount === 0) {
    return {
      tone: "info",
      message: "Session is running without a terminal. Open Settings if this workspace should boot one automatically.",
    };
  }

  return null;
};
