import type { ModelDebugOutput } from "@agenter/client-sdk";
import { createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppController, useRuntimeSelector } from "./app-context";
import { NoticeBanner } from "./components/ui/notice-banner";
import { ViewportMask } from "./components/ui/overflow-surface";
import { surfaceToneClassName } from "./components/ui/surface";
import { Tabs, type TabItem } from "./components/ui/tabs";
import { ChatPanel } from "./features/chat/ChatPanel";
import { phaseToStatus, resolveChatRouteNotice, resolveSessionToolbarState } from "./features/chat/chat-route-status";
import { SessionToolbar } from "./features/chat/SessionToolbar";
import { LoopBusPanel } from "./features/loopbus/LoopBusPanel";
import { ModelPanel } from "./features/model/ModelPanel";
import { CycleInspectorPanel } from "./features/process/CycleInspectorPanel";
import { QuickStartView } from "./features/quickstart/QuickStartView";
import { WorkspacePickerDialog } from "./features/sessions/WorkspacePickerDialog";
import { GlobalSettingsPanel } from "./features/settings/GlobalSettingsPanel";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { AppRoot } from "./features/shell/AppRoot";
import {
  equalChatRuntimeState,
  equalSessionChromeState,
  equalWorkspaceChromeState,
  selectChatRuntimeState,
  selectSessionChromeState,
  selectWorkspaceChromeState,
} from "./features/shell/runtime-selectors";
import { WorkspaceShellFrame } from "./features/shell/WorkspaceShellFrame";
import { MasterDetailPage } from "./features/shell/master-detail-page";
import { useAdaptiveViewport } from "./features/shell/useAdaptiveViewport";
import { TasksPanel } from "./features/tasks/TasksPanel";
import { TerminalPanel } from "./features/terminal/TerminalPanel";
import { WorkspaceSessionsPanel } from "./features/workspaces/WorkspaceSessionsPanel";
import { WorkspacesPanel } from "./features/workspaces/WorkspacesPanel";
import { cn } from "./lib/utils";

const DETAIL_TABS: TabItem[] = [
  { id: "cycles", label: "Cycles" },
  { id: "terminal", label: "Terminal" },
  { id: "tasks", label: "Tasks" },
  { id: "loopbus", label: "LoopBus" },
  { id: "model", label: "Model" },
];

const WORKSPACES_SESSIONS_SPLIT_STORAGE_KEY = "agenter:webui:workspaces-sessions-split-percent";
const EMPTY_MESSAGES: never[] = [];
const EMPTY_CYCLES: never[] = [];
const EMPTY_TASKS: never[] = [];
const EMPTY_LOGS: never[] = [];
const EMPTY_TRACES: never[] = [];
const EMPTY_MODEL_CALLS: never[] = [];
const EMPTY_API_CALLS: never[] = [];
const EMPTY_API_CALL_RECORDING = { enabled: false, refCount: 0 } as const;

const readSearchString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readPositiveInt = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const validateWorkspaceRouteSearch = (search: Record<string, unknown>) => ({
  workspacePath: readSearchString(search.workspacePath) ?? "",
  sessionId: readSearchString(search.sessionId),
});

const validateWorkspaceDevtoolsSearch = (search: Record<string, unknown>) => ({
  workspacePath: readSearchString(search.workspacePath) ?? "",
  sessionId: readSearchString(search.sessionId),
  cycleId: readPositiveInt(search.cycleId),
});

const validateWorkspaceOnlySearch = (search: Record<string, unknown>) => ({
  workspacePath: readSearchString(search.workspacePath) ?? "",
  sessionId: readSearchString(search.sessionId),
});

const renderWorkspaceRouteTarget = (workspacePath: string, sessionId?: string, options?: { cycleId?: number }) => ({
  workspacePath,
  sessionId,
  cycleId: options?.cycleId,
});

const normalizeLoopbusLogs = (
  items: Array<{
    id: number;
    timestamp: number;
    stateVersion: number;
    event: string;
    prevHash?: string | null;
    stateHash?: string;
    patch?: Array<{ op: "add" | "replace" | "remove"; path: string; value?: unknown }>;
  }>,
) =>
  items.map((item) => ({
    ...item,
    prevHash: item.prevHash ?? null,
    stateHash: item.stateHash ?? "",
    patch: item.patch ?? [],
  }));

const DevtoolsCyclesSurface = ({
  sessionId,
  loading,
  selectedCycleId,
  detailMode,
}: {
  sessionId: string;
  loading: boolean;
  selectedCycleId: string | null;
  detailMode: "split" | "sheet";
}) => {
  const cycles = useRuntimeSelector((state) => state.chatCyclesBySession[sessionId] ?? EMPTY_CYCLES);
  return (
    <CycleInspectorPanel
      cycles={cycles}
      loading={loading}
      selectedCycleId={selectedCycleId}
      detailMode={detailMode}
    />
  );
};

const DevtoolsTerminalSurface = ({
  sessionId,
  loading,
}: {
  sessionId: string;
  loading: boolean;
}) => {
  const runtime = useRuntimeSelector((state) => state.runtimes[sessionId]);
  const snapshots = useRuntimeSelector((state) => state.terminalSnapshotsBySession[sessionId]);
  const terminalReads = useRuntimeSelector((state) => state.terminalReadsBySession[sessionId]);
  const cycles = useRuntimeSelector((state) => state.chatCyclesBySession[sessionId] ?? EMPTY_CYCLES);

  return (
    <TerminalPanel
      runtime={runtime}
      snapshots={snapshots}
      terminalReads={runtime?.terminalReads ?? terminalReads}
      cycles={cycles}
      loading={loading}
    />
  );
};

const DevtoolsTasksSurface = ({
  sessionId,
  loading,
}: {
  sessionId: string;
  loading: boolean;
}) => {
  const tasks = useRuntimeSelector((state) => state.tasksBySession[sessionId] ?? EMPTY_TASKS);
  return <TasksPanel tasks={tasks} loading={loading} />;
};

const DevtoolsLoopBusSurface = ({
  sessionId,
}: {
  sessionId: string;
}) => {
  const controller = useAppController();
  const runtime = useRuntimeSelector((state) => state.runtimes[sessionId]);
  const loopbusStateLogs = useRuntimeSelector((state) => state.loopbusStateLogsBySession[sessionId] ?? EMPTY_LOGS);
  const loopbusTraces = useRuntimeSelector((state) => state.loopbusTracesBySession[sessionId] ?? EMPTY_TRACES);
  const modelCalls = useRuntimeSelector((state) => state.modelCallsBySession[sessionId] ?? EMPTY_MODEL_CALLS);
  const apiCalls = useRuntimeSelector((state) => state.apiCallsBySession[sessionId] ?? EMPTY_API_CALLS);
  const apiCallRecording = useRuntimeSelector(
    (state) => state.apiCallRecordingBySession[sessionId] ?? EMPTY_API_CALL_RECORDING,
  );

  return (
    <LoopBusPanel
      stage={runtime?.stage ?? "idle"}
      kernel={runtime?.loopKernelState ?? null}
      inputSignals={
        runtime?.loopInputSignals ?? {
          user: { version: 0, timestamp: null },
          terminal: { version: 0, timestamp: null },
          task: { version: 0, timestamp: null },
          attention: { version: 0, timestamp: null },
        }
      }
      logs={normalizeLoopbusLogs(loopbusStateLogs)}
      traces={loopbusTraces}
      modelCalls={modelCalls}
      apiCalls={apiCalls}
      apiRecording={apiCallRecording}
      hasMoreTrace={controller.tracePaging[sessionId]?.hasMore ?? true}
      loadingTrace={controller.tracePaging[sessionId]?.loading ?? false}
      onLoadMoreTrace={() => {
        void controller.loadMoreTrace(sessionId);
      }}
      hasMoreModel={controller.modelPaging[sessionId]?.hasMore ?? true}
      loadingModel={controller.modelPaging[sessionId]?.loading ?? false}
      onLoadMoreModel={() => {
        void controller.loadMoreModel(sessionId);
      }}
    />
  );
};

const DevtoolsModelSurface = ({
  sessionId,
  loading,
}: {
  sessionId: string;
  loading: boolean;
}) => {
  const controller = useAppController();
  const connected = useRuntimeSelector((state) => state.connected);
  const modelCalls = useRuntimeSelector((state) => state.modelCallsBySession[sessionId] ?? EMPTY_MODEL_CALLS);
  const apiCalls = useRuntimeSelector((state) => state.apiCallsBySession[sessionId] ?? EMPTY_API_CALLS);
  const refreshModelDebug = controller.refreshModelDebug;
  const retainApiCallStream = controller.retainApiCallStream;

  const latestModelCallKey = useMemo(() => {
    const latest = modelCalls.at(-1);
    if (!latest) {
      return "none";
    }
    return `${latest.id}:${latest.status}:${latest.completedAt ?? "pending"}`;
  }, [modelCalls]);
  const latestApiCallId = apiCalls.at(-1)?.id ?? 0;

  useEffect(() => {
    return retainApiCallStream(sessionId);
  }, [retainApiCallStream, sessionId]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    void refreshModelDebug(sessionId);
  }, [connected, latestApiCallId, latestModelCallKey, refreshModelDebug, sessionId]);

  const modelDebug = useMemo<ModelDebugOutput | null>(() => {
    if (controller.modelDebugSessionId === sessionId && controller.modelDebug) {
      return controller.modelDebug;
    }
    if (modelCalls.length === 0 && apiCalls.length === 0) {
      return null;
    }
    return {
      config: null,
      history: [],
      stats: null,
      latestModelCall: modelCalls.at(-1) ?? null,
      recentModelCalls: modelCalls,
      recentApiCalls: apiCalls,
    };
  }, [apiCalls, controller.modelDebug, controller.modelDebugSessionId, modelCalls, sessionId]);

  const usingModelDebugFallback =
    (controller.modelDebugSessionId !== sessionId || controller.modelDebug === null) && modelDebug !== null;

  return (
    <ModelPanel
      debug={modelDebug}
      loading={usingModelDebugFallback ? loading : loading || controller.modelDebugLoading}
      error={usingModelDebugFallback ? null : controller.modelDebugError}
      onRefresh={() => {
        void refreshModelDebug(sessionId);
      }}
    />
  );
};

const QuickStartRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const recentWorkspaces = useRuntimeSelector((state) => state.recentWorkspaces);

  return (
    <>
      <QuickStartView
        workspacePath={controller.quickstartWorkspacePath}
        draftResolution={controller.quickstartDraft}
        recentSessions={controller.quickstartRecentSessions}
        loadingDraft={controller.quickstartDraftLoading}
        starting={controller.quickstartBusy}
        onOpenWorkspacePicker={() => setWorkspacePickerOpen(true)}
        onEnterWorkspace={async () => {
          const sessionId = await controller.enterWorkspace();
          if (!sessionId) {
            return;
          }
          await navigate({
            to: "/workspace/chat",
            search: renderWorkspaceRouteTarget(controller.quickstartWorkspacePath, sessionId),
          });
        }}
        onSubmit={async (payload) => {
          const sessionId = await controller.quickstartSubmit(payload);
          if (!sessionId) {
            return;
          }
          await navigate({
            to: "/workspace/chat",
            search: renderWorkspaceRouteTarget(controller.quickstartWorkspacePath, sessionId),
          });
        }}
        onSearchPaths={controller.searchWorkspacePaths}
        onResumeSession={async (sessionId) => {
          await controller.resumeSession(sessionId, controller.quickstartWorkspacePath);
          await navigate({
            to: "/workspace/chat",
            search: renderWorkspaceRouteTarget(controller.quickstartWorkspacePath, sessionId),
          });
        }}
      />

      <WorkspacePickerDialog
        open={workspacePickerOpen}
        initialPath={controller.quickstartWorkspacePath}
        recentWorkspaces={recentWorkspaces}
        onClose={() => setWorkspacePickerOpen(false)}
        onPick={(path) => controller.setQuickstartWorkspacePath(path)}
        listDirectories={controller.listDirectories}
        validateDirectory={controller.validateDirectory}
      />
    </>
  );
};

const WorkspacesRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const connected = useRuntimeSelector((state) => state.connected);
  const workspaces = useRuntimeSelector((state) => state.workspaces);
  const recentWorkspaces = useRuntimeSelector((state) => state.recentWorkspaces);
  const sessions = useRuntimeSelector((state) => state.sessions);
  const unreadBySession = useRuntimeSelector((state) => state.unreadBySession);
  const workspacesLoading = !connected && workspaces.length === 0;
  const unreadByWorkspace = useMemo(() => {
    const result: Record<string, number> = {};
    for (const session of sessions) {
      const count = unreadBySession[session.id] ?? 0;
      if (count === 0) {
        continue;
      }
      result[session.cwd] = (result[session.cwd] ?? 0) + count;
    }
    return result;
  }, [sessions, unreadBySession]);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const selectedWorkspace = controller.selectedWorkspacePath
    ? (workspaces.find((item) => item.path === controller.selectedWorkspacePath) ?? null)
    : null;

  return (
    <MasterDetailPage
      main={
        <WorkspacesPanel
          loading={workspacesLoading}
          recentPaths={recentWorkspaces}
          workspaces={workspaces}
          unreadByWorkspace={unreadByWorkspace}
          selectedPath={controller.selectedWorkspacePath}
          onSelectPath={(path) => controller.setSelectedWorkspacePath(path)}
          onToggleFavorite={(path) => {
            void controller.toggleWorkspaceFavorite(path);
          }}
          onDeleteWorkspace={(path) => {
            void controller.deleteWorkspace(path);
          }}
          onCreateSessionInWorkspace={(path) => {
            void controller.createWorkspaceSession(path).then((sessionId) => {
              if (!sessionId) {
                return;
              }
              void navigate({
                to: "/workspace/chat",
                search: renderWorkspaceRouteTarget(path, sessionId),
              });
            });
          }}
          onCleanMissing={() => {
            void controller.cleanMissingWorkspaces();
          }}
        />
      }
      detail={
        <WorkspaceSessionsPanel
          workspace={selectedWorkspace}
          sessions={controller.workspaceSessions}
          unreadBySession={unreadBySession}
          counts={controller.workspaceSessionCounts}
          tab={controller.workspaceSessionsTab}
          selectedSessionId={controller.selectedWorkspaceSessionId}
          loading={controller.workspaceSessionsLoading}
          loadingMore={controller.workspaceSessionsLoadingMore}
          hasMore={controller.workspaceSessionCursor !== null}
          onChangeTab={controller.setWorkspaceSessionsTab}
          onSelectSession={controller.setSelectedWorkspaceSessionId}
          onLoadMore={() => {
            void controller.loadMoreWorkspaceSessions();
          }}
          onCreateSessionInWorkspace={(path) => {
            void controller.createWorkspaceSession(path).then((sessionId) => {
              if (!sessionId) {
                return;
              }
              void navigate({
                to: "/workspace/chat",
                search: renderWorkspaceRouteTarget(path, sessionId),
              });
            });
          }}
          onOpenSession={(sessionId) => {
            void controller.resumeSession(sessionId, selectedWorkspace?.path).then(() => {
              void navigate({
                to: "/workspace/chat",
                search: renderWorkspaceRouteTarget(selectedWorkspace?.path ?? "", sessionId),
              });
            });
          }}
          onStopSession={(sessionId) => {
            void controller.stopWorkspaceSession(sessionId);
          }}
          onToggleSessionFavorite={(sessionId) => {
            void controller.toggleSessionFavorite(sessionId);
          }}
          onArchiveSession={(sessionId) => {
            void controller.archiveWorkspaceSession(sessionId);
          }}
          onRestoreSession={(sessionId) => {
            void controller.restoreWorkspaceSession(sessionId);
          }}
          onDeleteSession={(sessionId) => {
            void controller.deleteWorkspaceSession(sessionId);
          }}
        />
      }
      detailTitle="Sessions"
      mobileDetailOpen={mobileDetailOpen}
      onMobileDetailOpenChange={setMobileDetailOpen}
      detailSelectionKey={controller.selectedWorkspacePath}
      autoOpenMobileOnSelection
      desktopResizable
      desktopSplitStorageKey={WORKSPACES_SESSIONS_SPLIT_STORAGE_KEY}
      defaultDesktopMainWidthPercent={58}
      minDesktopMainWidthPercent={40}
      maxDesktopMainWidthPercent={78}
    />
  );
};

const WorkspaceChatRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const adaptiveViewport = useAdaptiveViewport();
  const search = workspaceChatRoute.useSearch();
  const connected = useRuntimeSelector((state) => state.connected);
  const session = useRuntimeSelector(selectSessionChromeState(search.sessionId), equalSessionChromeState);
  const workspace = useRuntimeSelector(
    selectWorkspaceChromeState(search.workspacePath),
    equalWorkspaceChromeState,
  );
  const runtime = useRuntimeSelector(selectChatRuntimeState(search.sessionId), equalChatRuntimeState);
  const cycles = useRuntimeSelector((state) =>
    search.sessionId ? (state.chatCyclesBySession[search.sessionId] ?? EMPTY_CYCLES) : EMPTY_CYCLES,
  );
  const messages = useRuntimeSelector((state) =>
    search.sessionId ? (state.chatsBySession[search.sessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const setChatVisibility = controller.setChatVisibility;
  const consumeNotifications = controller.consumeNotifications;
  const routeRuntime = runtime ?? undefined;
  const aiStatus = phaseToStatus(session, routeRuntime);
  const sessionToolbar = resolveSessionToolbarState(session, routeRuntime);
  const routeNotice = resolveChatRouteNotice({
    notice: controller.notice,
    session,
    runtime: routeRuntime,
  });
  const [latestVisibleMessageId, setLatestVisibleMessageId] = useState<string | null>(null);
  const pageFocusedRef = useRef(true);
  const handleChatHeaderAction = useCallback(() => {
    if (!search.sessionId) {
      return;
    }
    if (sessionToolbar.action === "stop") {
      void controller.stopSession(search.sessionId);
      return;
    }
    void controller.startSession(search.sessionId);
  }, [controller, search.sessionId, sessionToolbar.action]);
  const handleAbortSession = useCallback(() => {
    if (!search.sessionId) {
      return;
    }
    void controller.abortSession(search.sessionId);
  }, [controller, search.sessionId]);

  const handleWorkspaceChatNavigate = useCallback(
    (tab: "chat" | "devtools" | "settings") => {
      if (tab === "settings") {
        void navigate({
          to: "/workspace/settings",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
        });
        return;
      }
      void navigate({
        to: tab === "chat" ? "/workspace/chat" : "/workspace/devtools",
        search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
      });
    },
    [navigate, search.sessionId, search.workspacePath],
  );

  useEffect(() => {
    setLatestVisibleMessageId(null);
  }, [search.sessionId]);

  useEffect(() => {
    const sessionId = search.sessionId;
    if (!connected || !sessionId) {
      return;
    }

    pageFocusedRef.current =
      typeof document.hasFocus === "function" ? document.hasFocus() || document.visibilityState === "visible" : true;

    const syncVisibility = (focused = pageFocusedRef.current) => {
      const visible = document.visibilityState === "visible";
      const nextFocused = visible && focused;
      void setChatVisibility({ sessionId, visible, focused: nextFocused });
      if (visible && nextFocused && latestVisibleMessageId) {
        void consumeNotifications({
          sessionId,
          upToMessageId: latestVisibleMessageId,
        });
      }
    };

    const handleFocus = () => {
      pageFocusedRef.current = true;
      syncVisibility(true);
    };

    const handleBlur = () => {
      pageFocusedRef.current = false;
      syncVisibility(false);
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      const nextFocused = isVisible
        ? pageFocusedRef.current || (typeof document.hasFocus === "function" ? document.hasFocus() : true)
        : false;
      pageFocusedRef.current = nextFocused;
      syncVisibility(nextFocused);
    };

    syncVisibility();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      void setChatVisibility({ sessionId, visible: false, focused: false });
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connected, consumeNotifications, latestVisibleMessageId, search.sessionId, setChatVisibility]);

  return (
    <WorkspaceShellFrame
      workspacePath={search.workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="chat"
      navMode={adaptiveViewport.workspaceNavMode}
      headerActions={
        search.sessionId ? (
          <SessionToolbar
            sessionStateLabel={sessionToolbar.label}
            sessionStateTone={sessionToolbar.tone}
            actionLabel={sessionToolbar.actionLabel}
            actionDisabled={sessionToolbar.disabled}
            onAction={handleChatHeaderAction}
            onAbort={handleAbortSession}
          />
        ) : null
      }
      onNavigate={handleWorkspaceChatNavigate}
    >
      {search.sessionId ? (
        <ChatPanel
          sessionId={search.sessionId}
          workspacePath={search.workspacePath}
          messages={messages}
          cycles={cycles}
          aiStatus={aiStatus}
          sessionStateLabel={sessionToolbar.label}
          routeNotice={routeNotice}
          disabled={!search.sessionId}
          imageEnabled
          imageCompatible={runtime?.imageInput ?? false}
          assistantAvatarUrl={session ? controller.runtimeStore.avatarIconUrl(session.avatar, search.workspacePath) : null}
          assistantAvatarLabel={session?.avatar ?? "Assistant"}
          userAvatarLabel="You"
          hasMore={search.sessionId ? (controller.chatPaging[search.sessionId]?.hasMore ?? true) : false}
          loadingMore={search.sessionId ? (controller.chatPaging[search.sessionId]?.loading ?? false) : false}
          onLoadMore={() => {
            if (!search.sessionId) {
              return;
            }
            void controller.loadMoreChatMessages(search.sessionId);
          }}
          onSubmit={(payload) => {
            if (!search.sessionId) {
              return Promise.resolve();
            }
            return controller.sendChat(search.sessionId, payload);
          }}
          onCommand={async (command) => {
            if (!search.sessionId) {
              return;
            }
            if (command === "/start") {
              await controller.startSession(search.sessionId);
              return;
            }
            if (command === "/stop") {
              await controller.stopSession(search.sessionId);
              return;
            }
            if (command === "/compact") {
              await controller.sendChat(search.sessionId, { text: "/compact", assets: [] });
            }
          }}
          onSearchPaths={controller.searchWorkspacePaths}
          onOpenDevtools={(cycleId) => {
            void navigate({
              to: "/workspace/devtools",
              search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId, { cycleId }),
            });
          }}
          onLatestVisibleAssistantMessageIdChange={setLatestVisibleMessageId}
        />
      ) : (
        <section className={cn(surfaceToneClassName("panel"), "flex h-full items-center justify-center p-6")}>
          <div className="space-y-3 text-center">
            <h2 className="typo-title-3 text-slate-900">No session selected</h2>
            <p className="text-sm text-slate-600">Create or resume a session from Workspaces to start chatting.</p>
          </div>
        </section>
      )}
    </WorkspaceShellFrame>
  );
};

const WorkspaceDevtoolsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const adaptiveViewport = useAdaptiveViewport();
  const search = workspaceDevtoolsRoute.useSearch();
  const [detailsTab, setDetailsTab] = useState<"cycles" | "terminal" | "tasks" | "loopbus" | "model">("cycles");
  const session = useRuntimeSelector(selectSessionChromeState(search.sessionId), equalSessionChromeState);
  const workspace = useRuntimeSelector(
    selectWorkspaceChromeState(search.workspacePath),
    equalWorkspaceChromeState,
  );
  const routeRuntime = useRuntimeSelector(selectChatRuntimeState(search.sessionId), equalChatRuntimeState);
  const hasRuntime = useRuntimeSelector((state) => (search.sessionId ? Boolean(state.runtimes[search.sessionId]) : false));
  const routeNotice = resolveChatRouteNotice({
    notice: controller.notice,
    session,
    runtime: routeRuntime ?? undefined,
  });
  const devtoolsSurfaceLoading =
    Boolean(search.sessionId) &&
    !hasRuntime &&
    session?.status !== "stopped" &&
    session?.status !== "paused" &&
    session?.status !== "error";
  const handleDetailsTabChange = useCallback((value: string) => {
    setDetailsTab(value === "terminal" || value === "tasks" || value === "loopbus" || value === "model" ? value : "cycles");
  }, []);

  const handleWorkspaceDevtoolsNavigate = useCallback(
    (tab: "chat" | "devtools" | "settings") => {
      if (tab === "settings") {
        void navigate({
          to: "/workspace/settings",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
        });
        return;
      }
      void navigate({
        to: tab === "chat" ? "/workspace/chat" : "/workspace/devtools",
        search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
      });
    },
    [navigate, search.sessionId, search.workspacePath],
  );

  useEffect(() => {
    if (search.cycleId) {
      setDetailsTab("cycles");
    }
  }, [search.cycleId]);

  const renderPanel = () => {
    if (!search.sessionId) {
      return (
        <section className={cn(surfaceToneClassName("panel"), "flex h-full items-center justify-center p-6")}>
          <p className="text-sm text-slate-600">Select or start a session to inspect Devtools.</p>
        </section>
      );
    }
    if (detailsTab === "terminal") {
      return <DevtoolsTerminalSurface sessionId={search.sessionId} loading={devtoolsSurfaceLoading} />;
    }
    if (detailsTab === "tasks") {
      return <DevtoolsTasksSurface sessionId={search.sessionId} loading={devtoolsSurfaceLoading} />;
    }
    if (detailsTab === "cycles") {
      return (
        <DevtoolsCyclesSurface
          sessionId={search.sessionId}
          loading={devtoolsSurfaceLoading}
          selectedCycleId={search.cycleId ? `cycle:${search.cycleId}` : null}
          detailMode={adaptiveViewport.workspaceNavMode === "bottom" ? "sheet" : "split"}
        />
      );
    }
    if (detailsTab === "model") {
      return <DevtoolsModelSurface sessionId={search.sessionId} loading={devtoolsSurfaceLoading} />;
    }
    return <DevtoolsLoopBusSurface sessionId={search.sessionId} />;
  };

  return (
    <WorkspaceShellFrame
      workspacePath={search.workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="devtools"
      navMode={adaptiveViewport.workspaceNavMode}
      onNavigate={handleWorkspaceDevtoolsNavigate}
    >
      <section className={cn(surfaceToneClassName("panel"), "grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 md:p-4")}>
        <Tabs items={DETAIL_TABS} value={detailsTab} onValueChange={handleDetailsTabChange} />
        <div
          className={cn(
            "grid h-full",
            routeNotice ? "grid-rows-[auto_minmax(0,1fr)] gap-3" : "grid-rows-[minmax(0,1fr)]",
          )}
        >
          {routeNotice ? <NoticeBanner tone={routeNotice.tone}>{routeNotice.message}</NoticeBanner> : null}
          <ViewportMask className="h-full">{renderPanel()}</ViewportMask>
        </div>
      </section>
    </WorkspaceShellFrame>
  );
};

const WorkspaceSettingsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const adaptiveViewport = useAdaptiveViewport();
  const search = workspaceSettingsRoute.useSearch();
  const connected = useRuntimeSelector((state) => state.connected);
  const workspace = useRuntimeSelector(
    selectWorkspaceChromeState(search.workspacePath),
    equalWorkspaceChromeState,
  );
  const refreshSettingsLayers = controller.refreshSettingsLayers;

  useEffect(() => {
    if (!connected || !search.workspacePath) {
      return;
    }
    void refreshSettingsLayers(search.workspacePath);
  }, [connected, refreshSettingsLayers, search.workspacePath]);
  const handleWorkspaceSettingsNavigate = useCallback(
    (tab: "chat" | "devtools" | "settings") => {
      if (tab === "settings") {
        return;
      }
      void navigate({
        to: tab === "chat" ? "/workspace/chat" : "/workspace/devtools",
        search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
      });
    },
    [navigate, search.sessionId, search.workspacePath],
  );

  return (
    <WorkspaceShellFrame
      workspacePath={search.workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="settings"
      navMode={adaptiveViewport.workspaceNavMode}
      onNavigate={handleWorkspaceSettingsNavigate}
    >
      {search.workspacePath ? (
        <SettingsPanel
          disabled={!search.workspacePath}
          loading={controller.settingsLoading}
          status={controller.settingsStatus}
          effectiveContent={controller.settingsEffective}
          layers={controller.settingsLayers}
          selectedLayerId={controller.selectedLayerId}
          layerContent={controller.layerDraft}
          detailMode={adaptiveViewport.workspaceNavMode === "bottom" ? "sheet" : "split"}
          onSelectLayer={(layerId) => {
            controller.setSelectedLayerId(layerId);
            controller.setLayerDraft("");
          }}
          onLayerContentChange={controller.setLayerDraft}
          onRefreshLayers={() => {
            void refreshSettingsLayers(search.workspacePath);
          }}
          onLoadLayer={() => {
            if (!controller.selectedLayerId) {
              return;
            }
            void controller.loadSelectedLayer(search.workspacePath, controller.selectedLayerId);
          }}
          onSaveLayer={() => {
            if (!controller.selectedLayerId) {
              return;
            }
            void controller.saveSelectedLayer(search.workspacePath, controller.selectedLayerId);
          }}
        />
      ) : (
        <section className={cn(surfaceToneClassName("panel"), "flex h-full items-center justify-center p-6")}>
          <div className="space-y-3 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-amber-600" />
            <p className="text-sm text-slate-600">Choose a workspace before editing settings.</p>
          </div>
        </section>
      )}
    </WorkspaceShellFrame>
  );
};

const GlobalSettingsRouteView = () => {
  const controller = useAppController();
  const connected = useRuntimeSelector((state) => state.connected);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle");
  const [content, setContent] = useState("{}\n");
  const [mtimeMs, setMtimeMs] = useState(0);
  const [avatars, setAvatars] = useState<Array<{ nickname: string; active: boolean; iconUrl: string }>>([]);
  const [activeAvatar, setActiveAvatar] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [settingsFile, avatarCatalog] = await Promise.all([
        controller.runtimeStore.readGlobalSettings(),
        controller.runtimeStore.listAvatarCatalog(),
      ]);
      setContent(settingsFile.content);
      setMtimeMs(settingsFile.mtimeMs);
      setAvatars(avatarCatalog.items);
      setActiveAvatar(avatarCatalog.activeAvatar);
      setStatus(`Loaded ${avatarCatalog.items.length} avatars`);
    } catch (error) {
      controller.setNotice(String(error instanceof Error ? error.message : error));
      setStatus("load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!connected) {
      return;
    }
    void refresh();
  }, [connected]);

  return (
    <section className={cn(surfaceToneClassName("panel"), "flex h-full flex-col")}>
      <GlobalSettingsPanel
        loading={loading}
        saving={saving}
        status={status}
        settingsContent={content}
        avatars={avatars}
        activeAvatar={activeAvatar}
        onSettingsContentChange={setContent}
        onSaveSettings={() => {
          setSaving(true);
          void controller.runtimeStore
            .saveGlobalSettings({ content, baseMtimeMs: mtimeMs })
            .then((result) => {
              if (!result.ok) {
                setContent(result.latest.content);
                setMtimeMs(result.latest.mtimeMs);
                setStatus("save conflict");
                return;
              }
              setContent(result.file.content);
              setMtimeMs(result.file.mtimeMs);
              setStatus("saved");
              return refresh();
            })
            .catch((error) => {
              controller.setNotice(String(error instanceof Error ? error.message : error));
              setStatus("save failed");
            })
            .finally(() => {
              setSaving(false);
            });
        }}
        onCreateAvatar={async (nickname) => {
          await controller.runtimeStore.createAvatar(nickname);
          await refresh();
        }}
        onUploadAvatarIcon={async (nickname, file) => {
          await controller.runtimeStore.uploadAvatarIcon(nickname, file);
          await refresh();
        }}
      />
    </section>
  );
};

const rootRoute = createRootRoute({
  component: AppRoot,
});

const quickStartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: QuickStartRouteView,
});

const workspacesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces",
  component: WorkspacesRouteView,
});

const globalSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: GlobalSettingsRouteView,
});

const workspaceChatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace/chat",
  validateSearch: validateWorkspaceRouteSearch,
  component: WorkspaceChatRouteView,
});

const workspaceDevtoolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace/devtools",
  validateSearch: validateWorkspaceDevtoolsSearch,
  component: WorkspaceDevtoolsRouteView,
});

const workspaceSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace/settings",
  validateSearch: validateWorkspaceOnlySearch,
  component: WorkspaceSettingsRouteView,
});

const routeTree = rootRoute.addChildren([
  quickStartRoute,
  workspacesRoute,
  globalSettingsRoute,
  workspaceChatRoute,
  workspaceDevtoolsRoute,
  workspaceSettingsRoute,
]);

export const createAppRouter = () =>
  createRouter({
    routeTree,
  });

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
