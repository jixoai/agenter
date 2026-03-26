import type { RuntimeSchedulerContainmentState, RuntimeSnapshot, SessionEntry } from "@agenter/client-sdk";
import type { AsyncSurfaceState } from "../../components/ui/async-surface";
import type { LongListPagingState } from "../../shared/long-list-paging";

import { isLikelyErrorNotice, normalizeUserNotice } from "../../shared/notice";

export type SessionStatusTone = "neutral" | "active" | "warning" | "danger";

type RouteSession = Pick<SessionEntry, "status" | "lastError">;
type RouteRuntime = Pick<RuntimeSnapshot["runtimes"][string], "started" | "schedulerPhase" | "stage"> & {
  terminalCount: number;
  lastError: string | null;
  scheduler: RuntimeSchedulerContainmentState | null;
};

export const phaseToStatus = (session: RouteSession | null, runtime?: RouteRuntime): string => {
  if (!session) {
    return "idle";
  }
  if (session.status === "error") {
    return "error";
  }
  if (session.status === "paused") {
    return "paused";
  }
  if (session.status === "stopped") {
    return "stopped";
  }
  if (session.status === "starting" && !runtime?.started) {
    return "starting";
  }
  if (runtime?.started) {
    if (runtime.scheduler?.runtimeStatus === "blocked") {
      return "attention blocked";
    }
    if (runtime.scheduler?.runtimeStatus === "backoff") {
      return "attention backoff";
    }
    if (runtime.scheduler?.runtimeStatus === "waiting" && runtime.scheduler.waitingReason === "attention_debt") {
      return "attention pending";
    }
    if (runtime.schedulerPhase === "waiting_commits") {
      return "idle";
    }
    if (runtime.schedulerPhase === "calling_model") {
      return "waiting model";
    }
    if (runtime.schedulerPhase === "applying_outputs") {
      return "applying outputs";
    }
    if (runtime.schedulerPhase === "collecting_inputs") {
      return "syncing";
    }
    if (runtime.schedulerPhase === "persisting_cycle") {
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

export const resolveSessionStatusPillState = (
  session: RouteSession | null,
  runtime?: RouteRuntime,
): {
  label: string;
  tone: SessionStatusTone;
  primaryActionLabel: string;
  primaryAction: "start" | "stop";
  disabled: boolean;
} => {
  if (!session) {
    return {
      label: "No session",
      tone: "neutral",
      primaryActionLabel: "Start session",
      primaryAction: "start",
      disabled: true,
    };
  }
  if (session.status === "error") {
    return {
      label: "Session error",
      tone: "danger",
      primaryActionLabel: "Start session",
      primaryAction: "start",
      disabled: false,
    };
  }
  if (session.status === "paused") {
    return {
      label: "Session paused",
      tone: "warning",
      primaryActionLabel: "Resume session",
      primaryAction: "start",
      disabled: false,
    };
  }
  if (session.status === "stopped") {
    return {
      label: "Session stopped",
      tone: "neutral",
      primaryActionLabel: "Start session",
      primaryAction: "start",
      disabled: false,
    };
  }
  if (session.status === "starting") {
    return {
      label: "Session starting",
      tone: "warning",
      primaryActionLabel: "Stop session",
      primaryAction: "stop",
      disabled: false,
    };
  }
  if (runtime?.started) {
    if (runtime.scheduler?.runtimeStatus === "blocked") {
      return {
        label: "Attention blocked",
        tone: "warning",
        primaryActionLabel: "Stop session",
        primaryAction: "stop",
        disabled: false,
      };
    }
    if (runtime.scheduler?.runtimeStatus === "backoff") {
      return {
        label: "Attention retrying",
        tone: "warning",
        primaryActionLabel: "Stop session",
        primaryAction: "stop",
        disabled: false,
      };
    }
    if (runtime.scheduler?.runtimeStatus === "waiting" && runtime.scheduler.waitingReason === "attention_debt") {
      return {
        label: "Attention pending",
        tone: "active",
        primaryActionLabel: "Stop session",
        primaryAction: "stop",
        disabled: false,
      };
    }
  }
  if (runtime?.started || session.status === "running") {
    return {
      label: "Session running",
      tone: "active",
      primaryActionLabel: "Stop session",
      primaryAction: "stop",
      disabled: false,
    };
  }
  return {
    label: "Session stopped",
    tone: "neutral",
    primaryActionLabel: "Start session",
    primaryAction: "start",
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

  if (input.runtime?.lastError && isLikelyErrorNotice(input.runtime.lastError)) {
    return {
      tone: "destructive",
      message: normalizeUserNotice(input.runtime.lastError, "Something failed while preparing this session."),
    };
  }

  if (input.runtime?.scheduler?.runtimeStatus === "blocked") {
    return {
      tone: "warning",
      message: normalizeUserNotice(
        input.runtime.scheduler.blockedReason ?? "",
        "Attention work is blocked. Inspect Devtools for the unresolved cause.",
      ),
    };
  }

  if (input.runtime?.scheduler?.runtimeStatus === "backoff") {
    return {
      tone: "warning",
      message:
        input.runtime.scheduler.backoffMs && input.runtime.scheduler.backoffMs > 0
          ? `Attention work is waiting to retry in ${input.runtime.scheduler.backoffMs} ms.`
          : "Attention work is waiting to retry.",
    };
  }

  if (input.session.status === "error") {
    return {
      tone: "destructive",
      message: normalizeUserNotice(
        input.session.lastError ?? input.runtime?.lastError ?? "",
        "Session failed. Start it again to retry.",
      ),
    };
  }

  if (input.runtime?.started && input.runtime.terminalCount === 0) {
    return {
      tone: "info",
      message: "Session is running without a terminal. Open Settings if this workspace should boot one automatically.",
    };
  }

  return null;
};

export const resolveChatConversationState = (input: {
  connected: boolean;
  hasData: boolean;
  chatPaging: LongListPagingState;
  cyclePaging: LongListPagingState;
}): AsyncSurfaceState => {
  if (!input.connected) {
    return input.hasData ? "ready-idle" : "empty-idle";
  }

  if (
    !input.chatPaging.hydrated ||
    !input.cyclePaging.hydrated ||
    input.chatPaging.loading ||
    input.cyclePaging.loading
  ) {
    return input.hasData ? "ready-loading" : "empty-loading";
  }

  return input.hasData ? "ready-idle" : "empty-idle";
};
