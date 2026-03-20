import type { RuntimeClientState, RuntimeSnapshot, SessionEntry } from "@agenter/client-sdk";

export interface SessionChromeState {
  id: string;
  name: string;
  cwd: string;
  status: SessionEntry["status"];
  avatar: string;
}

export interface WorkspaceChromeState {
  path: string;
  missing: boolean;
}

export interface HeaderRuntimeState {
  started: boolean;
  loopPhase: RuntimeSnapshot["runtimes"][string]["loopPhase"];
}

export interface ChatRuntimeState extends HeaderRuntimeState {
  stage: RuntimeSnapshot["runtimes"][string]["stage"];
  terminalCount: number;
  imageInput: boolean;
}

export interface RunningSessionState {
  sessionId: string;
  name: string;
  workspacePath: string;
  status: SessionEntry["status"];
  unreadCount: number;
}

export const selectSessionChromeState =
  (sessionId?: string) =>
  (state: RuntimeClientState): SessionChromeState | null => {
    if (!sessionId) {
      return null;
    }
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) {
      return null;
    }
    return {
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      status: session.status,
      avatar: session.avatar,
    };
  };

export const equalSessionChromeState = (
  left: SessionChromeState | null,
  right: SessionChromeState | null,
): boolean => {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.cwd === right.cwd &&
    left.status === right.status &&
    left.avatar === right.avatar
  );
};

export const selectWorkspaceChromeState =
  (workspacePath: string) =>
  (state: RuntimeClientState): WorkspaceChromeState | null => {
    const workspace = state.workspaces.find((item) => item.path === workspacePath);
    if (!workspace) {
      return null;
    }
    return {
      path: workspace.path,
      missing: Boolean(workspace.missing),
    };
  };

export const equalWorkspaceChromeState = (
  left: WorkspaceChromeState | null,
  right: WorkspaceChromeState | null,
): boolean => {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.path === right.path && left.missing === right.missing;
};

export const selectHeaderRuntimeState =
  (sessionId?: string) =>
  (state: RuntimeClientState): HeaderRuntimeState | null => {
    if (!sessionId) {
      return null;
    }
    const runtime = state.runtimes[sessionId];
    if (!runtime) {
      return null;
    }
    return {
      started: runtime.started,
      loopPhase: runtime.loopPhase,
    };
  };

export const equalHeaderRuntimeState = (
  left: HeaderRuntimeState | null,
  right: HeaderRuntimeState | null,
): boolean => {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.started === right.started && left.loopPhase === right.loopPhase;
};

export const selectChatRuntimeState =
  (sessionId?: string) =>
  (state: RuntimeClientState): ChatRuntimeState | null => {
    if (!sessionId) {
      return null;
    }
    const runtime = state.runtimes[sessionId];
    if (!runtime) {
      return null;
    }
    return {
      started: runtime.started,
      loopPhase: runtime.loopPhase,
      stage: runtime.stage,
      terminalCount: runtime.terminals.length,
      imageInput: runtime.modelCapabilities.imageInput,
    };
  };

export const equalChatRuntimeState = (
  left: ChatRuntimeState | null,
  right: ChatRuntimeState | null,
): boolean => {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.started === right.started &&
    left.loopPhase === right.loopPhase &&
    left.stage === right.stage &&
    left.terminalCount === right.terminalCount &&
    left.imageInput === right.imageInput
  );
};

export const selectUnreadTotal = (state: RuntimeClientState): number => {
  return Object.values(state.unreadBySession).reduce((total, value) => total + value, 0);
};

export const selectRunningSessionsState = (state: RuntimeClientState): RunningSessionState[] => {
  return state.sessions
    .filter((session) => session.status === "running" || session.status === "starting")
    .map((session) => ({
      sessionId: session.id,
      name: session.name,
      workspacePath: session.cwd,
      status: session.status,
      unreadCount: state.unreadBySession[session.id] ?? 0,
    }));
};

export const equalRunningSessionsState = (
  left: RunningSessionState[],
  right: RunningSessionState[],
): boolean => {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => {
    const other = right[index];
    return (
      item?.sessionId === other?.sessionId &&
      item?.name === other?.name &&
      item?.workspacePath === other?.workspacePath &&
      item?.status === other?.status &&
      item?.unreadCount === other?.unreadCount
    );
  });
};
