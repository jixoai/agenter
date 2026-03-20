import type { ModelDebugOutput, SessionEntry, WorkspaceEntry } from "@agenter/client-sdk";
import { createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAppController, useRuntimeSelector } from "./app-context";
import { NoticeBanner } from "./components/ui/notice-banner";
import { surfaceToneClassName } from "./components/ui/surface";
import { Tabs, type TabItem } from "./components/ui/tabs";
import { ChatPanel } from "./features/chat/ChatPanel";
import { phaseToStatus, resolveChatRouteNotice, resolveSessionToolbarState } from "./features/chat/chat-route-status";
import { LoopBusPanel } from "./features/loopbus/LoopBusPanel";
import { ModelPanel } from "./features/model/ModelPanel";
import { CycleInspectorPanel } from "./features/process/CycleInspectorPanel";
import { QuickStartView } from "./features/quickstart/QuickStartView";
import { WorkspacePickerDialog } from "./features/sessions/WorkspacePickerDialog";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { AppRoot } from "./features/shell/AppRoot";
import { WorkspaceShellFrame } from "./features/shell/WorkspaceShellFrame";
import { MasterDetailPage } from "./features/shell/master-detail-page";
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

const resolveSession = (sessions: SessionEntry[], sessionId?: string): SessionEntry | null =>
  sessionId ? (sessions.find((item) => item.id === sessionId) ?? null) : null;

const resolveWorkspace = (workspaces: WorkspaceEntry[], workspacePath: string): WorkspaceEntry | null =>
  workspaces.find((item) => item.path === workspacePath) ?? null;

const renderWorkspaceRouteTarget = (workspacePath: string, sessionId?: string, options?: { cycleId?: number }) => ({
  workspacePath,
  sessionId,
  ...(options?.cycleId ? { cycleId: options.cycleId } : {}),
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
    ? resolveWorkspace(workspaces, controller.selectedWorkspacePath)
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
  const search = workspaceChatRoute.useSearch();
  const connected = useRuntimeSelector((state) => state.connected);
  const sessions = useRuntimeSelector((state) => state.sessions);
  const workspaces = useRuntimeSelector((state) => state.workspaces);
  const runtime = useRuntimeSelector((state) => (search.sessionId ? state.runtimes[search.sessionId] : undefined));
  const cycles = useRuntimeSelector((state) =>
    search.sessionId ? (state.chatCyclesBySession[search.sessionId] ?? EMPTY_CYCLES) : EMPTY_CYCLES,
  );
  const messages = useRuntimeSelector((state) =>
    search.sessionId ? (state.chatsBySession[search.sessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const setChatVisibility = controller.setChatVisibility;
  const consumeNotifications = controller.consumeNotifications;
  const session = resolveSession(sessions, search.sessionId);
  const workspace = resolveWorkspace(workspaces, search.workspacePath);
  const aiStatus = phaseToStatus(session, runtime);
  const sessionToolbar = resolveSessionToolbarState(session, runtime);
  const routeNotice = resolveChatRouteNotice({
    notice: controller.notice,
    session,
    runtime,
  });
  const [latestVisibleMessageId, setLatestVisibleMessageId] = useState<string | null>(null);
  const pageFocusedRef = useRef(true);

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
      onNavigate={(tab) => {
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
      }}
    >
      {search.sessionId ? (
        <ChatPanel
          workspacePath={search.workspacePath}
          messages={messages}
          cycles={cycles}
          aiStatus={aiStatus}
          sessionStateLabel={sessionToolbar.label}
          sessionStateTone={sessionToolbar.tone}
          routeNotice={routeNotice}
          disabled={!search.sessionId}
          imageEnabled={runtime?.modelCapabilities.imageInput ?? false}
          sessionActionLabel={sessionToolbar.actionLabel}
          sessionActionDisabled={sessionToolbar.disabled}
          onSessionAction={() => {
            if (!search.sessionId) {
              return;
            }
            if (sessionToolbar.action === "stop") {
              void controller.stopSession(search.sessionId);
              return;
            }
            void controller.startSession(search.sessionId);
          }}
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
  const search = workspaceDevtoolsRoute.useSearch();
  const [detailsTab, setDetailsTab] = useState<"cycles" | "terminal" | "tasks" | "loopbus" | "model">("cycles");
  const connected = useRuntimeSelector((state) => state.connected);
  const sessions = useRuntimeSelector((state) => state.sessions);
  const workspaces = useRuntimeSelector((state) => state.workspaces);
  const runtime = useRuntimeSelector((state) => (search.sessionId ? state.runtimes[search.sessionId] : undefined));
  const cycles = useRuntimeSelector((state) =>
    search.sessionId ? (state.chatCyclesBySession[search.sessionId] ?? EMPTY_CYCLES) : EMPTY_CYCLES,
  );
  const tasks = useRuntimeSelector((state) =>
    search.sessionId ? (state.tasksBySession[search.sessionId] ?? EMPTY_TASKS) : EMPTY_TASKS,
  );
  const terminalSnapshots = useRuntimeSelector((state) =>
    search.sessionId ? state.terminalSnapshotsBySession[search.sessionId] : undefined,
  );
  const loopbusStateLogs = useRuntimeSelector((state) =>
    search.sessionId ? (state.loopbusStateLogsBySession[search.sessionId] ?? EMPTY_LOGS) : EMPTY_LOGS,
  );
  const loopbusTraces = useRuntimeSelector((state) =>
    search.sessionId ? (state.loopbusTracesBySession[search.sessionId] ?? EMPTY_TRACES) : EMPTY_TRACES,
  );
  const modelCalls = useRuntimeSelector((state) =>
    search.sessionId ? (state.modelCallsBySession[search.sessionId] ?? EMPTY_MODEL_CALLS) : EMPTY_MODEL_CALLS,
  );
  const apiCalls = useRuntimeSelector((state) =>
    search.sessionId ? (state.apiCallsBySession[search.sessionId] ?? EMPTY_API_CALLS) : EMPTY_API_CALLS,
  );
  const apiCallRecording = useRuntimeSelector((state) =>
    search.sessionId
      ? (state.apiCallRecordingBySession[search.sessionId] ?? EMPTY_API_CALL_RECORDING)
      : EMPTY_API_CALL_RECORDING,
  );
  const refreshModelDebug = controller.refreshModelDebug;
  const session = resolveSession(sessions, search.sessionId);
  const workspace = resolveWorkspace(workspaces, search.workspacePath);
  const routeNotice = resolveChatRouteNotice({
    notice: controller.notice,
    session,
    runtime,
  });
  const devtoolsSurfaceLoading =
    Boolean(search.sessionId) && !runtime && session?.status !== "stopped" && session?.status !== "error";
  const latestModelCallKey = (() => {
    const latest = modelCalls.at(-1);
    if (!latest) {
      return "none";
    }
    return `${latest.id}:${latest.status}:${latest.completedAt ?? "pending"}`;
  })();
  const latestApiCallId = apiCalls.at(-1)?.id ?? 0;
  const modelDebug = useMemo<ModelDebugOutput | null>(() => {
    if (controller.modelDebugSessionId === search.sessionId && controller.modelDebug) {
      return controller.modelDebug;
    }
    if (!search.sessionId) {
      return null;
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
  }, [apiCalls, controller.modelDebug, controller.modelDebugSessionId, modelCalls, search.sessionId]);
  const usingModelDebugFallback =
    (controller.modelDebugSessionId !== search.sessionId || controller.modelDebug === null) && modelDebug !== null;

  useEffect(() => {
    if (search.cycleId) {
      setDetailsTab("cycles");
    }
  }, [search.cycleId]);

  useEffect(() => {
    if (!connected || detailsTab !== "model" || !search.sessionId) {
      return;
    }
    void refreshModelDebug(search.sessionId);
  }, [connected, detailsTab, latestApiCallId, latestModelCallKey, refreshModelDebug, search.sessionId]);

  const renderPanel = () => {
    if (!search.sessionId) {
      return (
        <section className={cn(surfaceToneClassName("panel"), "flex h-full items-center justify-center p-6")}>
          <p className="text-sm text-slate-600">Select or start a session to inspect Devtools.</p>
        </section>
      );
    }
    if (detailsTab === "terminal") {
      return <TerminalPanel runtime={runtime} snapshots={terminalSnapshots} loading={devtoolsSurfaceLoading} />;
    }
    if (detailsTab === "tasks") {
      return <TasksPanel tasks={tasks} loading={devtoolsSurfaceLoading && tasks.length === 0} />;
    }
    if (detailsTab === "cycles") {
      return (
        <CycleInspectorPanel
          cycles={cycles}
          loading={devtoolsSurfaceLoading && cycles.length === 0}
          selectedCycleId={search.cycleId ? `cycle:${search.cycleId}` : null}
        />
      );
    }
    if (detailsTab === "model") {
      return (
        <ModelPanel
          debug={modelDebug}
          loading={usingModelDebugFallback ? false : controller.modelDebugLoading}
          error={usingModelDebugFallback ? null : controller.modelDebugError}
          onRefresh={() => {
            if (!search.sessionId) {
              return;
            }
            void refreshModelDebug(search.sessionId);
          }}
        />
      );
    }
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
        hasMoreTrace={search.sessionId ? (controller.tracePaging[search.sessionId]?.hasMore ?? true) : false}
        loadingTrace={search.sessionId ? (controller.tracePaging[search.sessionId]?.loading ?? false) : false}
        onLoadMoreTrace={() => {
          if (!search.sessionId) {
            return;
          }
          void controller.loadMoreTrace(search.sessionId);
        }}
        hasMoreModel={search.sessionId ? (controller.modelPaging[search.sessionId]?.hasMore ?? true) : false}
        loadingModel={search.sessionId ? (controller.modelPaging[search.sessionId]?.loading ?? false) : false}
        onLoadMoreModel={() => {
          if (!search.sessionId) {
            return;
          }
          void controller.loadMoreModel(search.sessionId);
        }}
      />
    );
  };

  return (
    <WorkspaceShellFrame
      workspacePath={search.workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="devtools"
      onNavigate={(tab) => {
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
      }}
    >
      <section className={cn(surfaceToneClassName("panel"), "flex h-full flex-col p-4")}>
        <Tabs
          items={DETAIL_TABS}
          value={detailsTab}
          onValueChange={(value) => setDetailsTab(value as typeof detailsTab)}
        />
        {routeNotice ? (
          <div className="mt-3">
            <NoticeBanner tone={routeNotice.tone}>{routeNotice.message}</NoticeBanner>
          </div>
        ) : null}
        <div className="mt-4 flex-1">{renderPanel()}</div>
      </section>
    </WorkspaceShellFrame>
  );
};

const WorkspaceSettingsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const search = workspaceSettingsRoute.useSearch();
  const connected = useRuntimeSelector((state) => state.connected);
  const workspaces = useRuntimeSelector((state) => state.workspaces);
  const refreshSettingsLayers = controller.refreshSettingsLayers;
  const workspace = resolveWorkspace(workspaces, search.workspacePath);

  useEffect(() => {
    if (!connected || !search.workspacePath) {
      return;
    }
    void refreshSettingsLayers(search.workspacePath);
  }, [connected, refreshSettingsLayers, search.workspacePath]);

  return (
    <WorkspaceShellFrame
      workspacePath={search.workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="settings"
      onNavigate={(tab) => {
        if (tab === "settings") {
          return;
        }
        void navigate({
          to: tab === "chat" ? "/workspace/chat" : "/workspace/devtools",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
        });
      }}
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
