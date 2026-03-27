import type { CachedResourceState, MessageChannelEntry } from "@agenter/client-sdk";
import { createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
import type { WebChatMessage } from "@agenter/web-chat-view";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppController, useRuntimeSelector } from "./app-context";
import { NoticeBanner } from "./components/ui/notice-banner";
import { ViewportMask } from "./components/ui/overflow-surface";
import { surfaceToneClassName } from "./components/ui/surface";
import { Tabs, type TabItem } from "./components/ui/tabs";
import { AttentionInspectorPanel } from "./features/attention/AttentionInspectorPanel";
import {
  buildSessionDevtoolsSearch,
  validateSessionDevtoolsSearch,
  type DevtoolsPanelId,
} from "./features/attention/attention-devtools-route";
import { EMPTY_RUNTIME_ATTENTION_STATE, type AttentionSelectionState } from "./features/attention/attention-view-model";
import { MessageChannelSurface } from "./features/chat/MessageChannelSurface";
import { resolveChatRouteNotice, resolveSessionStatusPillState } from "./features/chat/chat-route-status";
import { extractInternalFailureNotice, isInternalFailureMessage } from "./features/chat/internal-system-messages";
import { SystemsPanel } from "./features/devtools/SystemsPanel";
import { ObservabilityPanel } from "./features/devtools/observability/ObservabilityPanel";
import { CycleInspectorPanel } from "./features/process/CycleInspectorPanel";
import { QuickStartView } from "./features/quickstart/QuickStartView";
import { WorkspacePickerDialog } from "./features/sessions/WorkspacePickerDialog";
import { GlobalSettingsPanel } from "./features/settings/GlobalSettingsPanel";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import type { SettingsEffectiveGraph, SettingsLayerItem } from "./features/settings/settings-graph-types";
import { AppRoot } from "./features/shell/AppRoot";
import { SessionStatusPillMenu } from "./features/shell/SessionStatusPillMenu";
import { WorkspaceShellFrame } from "./features/shell/WorkspaceShellFrame";
import { MasterDetailPage } from "./features/shell/master-detail-page";
import { SessionTerminalsSurface } from "./features/terminal/SessionTerminalsSurface";
import {
  equalChatRuntimeState,
  equalSessionChromeState,
  equalWorkspaceChromeState,
  selectChatRuntimeState,
  selectSessionChromeState,
  selectWorkspaceChromeState,
} from "./features/shell/runtime-selectors";
import { useAdaptiveViewport } from "./features/shell/useAdaptiveViewport";
import { WorkspaceSessionsPanel } from "./features/workspaces/WorkspaceSessionsPanel";
import { WorkspacesPanel } from "./features/workspaces/WorkspacesPanel";
import { cn } from "./lib/utils";
import { normalizeUserNotice } from "./shared/notice";

const DETAIL_TABS: TabItem[] = [
  { id: "attention", label: "Attention" },
  { id: "cycles", label: "Cycles" },
  { id: "systems", label: "Systems" },
  { id: "observability", label: "Observability" },
];

const WORKSPACES_SESSIONS_SPLIT_STORAGE_KEY = "agenter:webui:workspaces-sessions-split-percent";
const EMPTY_MESSAGES: never[] = [];
const EMPTY_MESSAGE_CHANNELS_RESOURCE = {
  data: [],
  loaded: false,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: null,
} as const satisfies CachedResourceState<MessageChannelEntry[]>;
const EMPTY_CYCLES: never[] = [];
const EMPTY_LOGS: never[] = [];
const EMPTY_TRACES: never[] = [];
const EMPTY_MODEL_CALLS: never[] = [];
const EMPTY_MODEL_CALL_DELTAS: never[] = [];
const EMPTY_API_CALLS: never[] = [];
const EMPTY_API_CALL_RECORDING = { enabled: false, refCount: 0 } as const;
const EMPTY_ATTENTION = EMPTY_RUNTIME_ATTENTION_STATE;
const EMPTY_SETTINGS_EFFECTIVE: SettingsEffectiveGraph = {
  content: "{}\n",
  value: {},
  schema: {
    type: "object",
  },
  provenance: {},
};

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
  chatId: readSearchString(search.chatId),
});

const validateWorkspaceDevtoolsSearch = (search: Record<string, unknown>) => ({
  workspacePath: readSearchString(search.workspacePath) ?? "",
  sessionId: readSearchString(search.sessionId),
  chatId: readSearchString(search.chatId),
  cycleId: readPositiveInt(search.cycleId),
});

const validateWorkspaceOnlySearch = (search: Record<string, unknown>) => ({
  workspacePath: readSearchString(search.workspacePath) ?? "",
  sessionId: readSearchString(search.sessionId),
  chatId: readSearchString(search.chatId),
});

const renderWorkspaceRouteTarget = (
  workspacePath: string,
  sessionId?: string,
  options?: { cycleId?: number; chatId?: string },
) => ({
  workspacePath,
  sessionId,
  chatId: options?.chatId,
  cycleId: options?.cycleId,
});

const toBootstrapChannelMessages = (
  channel: MessageChannelEntry | null,
  messages: Array<{
    id: string;
    chatId?: string;
    role: "user" | "assistant";
    content: string;
    messageKind?: "text" | "error" | "interactive";
    messagePayload?: {
      error?: {
        title?: string;
        code?: string;
        detail?: string;
      };
      interactive?: {
        version: "v1";
        kind: "form";
        title: string;
        description?: string;
        submitLabel?: string;
        fields: Array<{
          id: string;
          label: string;
          placeholder?: string;
          required?: boolean;
          multiline?: boolean;
          initialValue?: string;
        }>;
      };
    };
    timestamp: number;
    cycleId?: number | null;
    channel?: "to_user" | "self_talk" | "tool";
    format?: "plain" | "markdown";
    attachments?: Array<{
      assetId: string;
      kind: "image" | "video" | "file";
      name: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
    }>;
  }>,
): WebChatMessage[] => {
  if (!channel) {
    return [];
  }
  return messages
    .filter((message) => {
      if (message.chatId !== channel.chatId) {
        return false;
      }
      if (isInternalFailureMessage(message)) {
        return false;
      }
      if (message.role === "assistant" && message.channel && message.channel !== "to_user") {
        return false;
      }
      return true;
    })
    .map((message, index) => ({
      rowId: Number.isFinite(Number(message.id)) ? Number(message.id) : index + 1,
      messageId: message.id,
      chatId: channel.chatId,
      from: message.role === "assistant" ? channel.owner : "User",
      to: message.role === "assistant" ? undefined : channel.owner,
      kind: message.messageKind ?? "text",
      content: message.content,
      createdAt: message.timestamp,
      metadata: {
        ...(message.channel ? { channel: message.channel } : {}),
        ...(message.format ? { format: message.format } : {}),
        ...(message.cycleId != null ? { cycleId: message.cycleId } : {}),
      },
      attachments: message.attachments?.map((attachment) => ({ ...attachment })),
      payload: message.messagePayload,
    }));
};

const normalizeSchedulerStateLogs = (
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
  onOpenAttentionRef,
}: {
  sessionId: string;
  loading: boolean;
  selectedCycleId: string | null;
  detailMode: "split" | "sheet";
  onOpenAttentionRef: (selection: AttentionSelectionState) => void;
}) => {
  const controller = useAppController();
  const cycles = useRuntimeSelector((state) => state.chatCyclesBySession[sessionId] ?? EMPTY_CYCLES);
  const attention = useRuntimeSelector((state) => state.attentionBySession?.[sessionId] ?? EMPTY_ATTENTION);
  const modelCalls = useRuntimeSelector((state) => state.modelCallsBySession[sessionId] ?? EMPTY_MODEL_CALLS);
  const modelCallDeltas = useRuntimeSelector(
    (state) => state.modelCallDeltasBySession?.[sessionId] ?? EMPTY_MODEL_CALL_DELTAS,
  );
  const runtimeTraces = useRuntimeSelector((state) => state.observabilityTracesBySession[sessionId] ?? EMPTY_TRACES);
  const pagingState = controller.getLongListPagingState({ resource: "cycles", sessionId });
  return (
    <CycleInspectorPanel
      cycles={cycles}
      attention={attention}
      modelCalls={modelCalls}
      modelCallDeltas={modelCallDeltas}
      traces={runtimeTraces}
      loading={loading}
      selectedCycleId={selectedCycleId}
      detailMode={detailMode}
      pagingState={pagingState}
      onOpenAttentionRef={onOpenAttentionRef}
      onLoadMore={() => {
        void controller.loadMoreChatCycles(sessionId);
      }}
    />
  );
};

const DevtoolsAttentionSurface = ({
  sessionId,
  loading,
  selection,
  detailView,
  queryText,
  onDetailViewChange,
  onQueryTextChange,
  onSelectionChange,
}: {
  sessionId: string;
  loading: boolean;
  selection: AttentionSelectionState;
  detailView: "context" | "items";
  queryText: string;
  onDetailViewChange: (view: "context" | "items") => void;
  onQueryTextChange: (query: string) => void;
  onSelectionChange: (selection: AttentionSelectionState) => void;
}) => {
  const attention = useRuntimeSelector((state) => state.attentionBySession?.[sessionId] ?? EMPTY_ATTENTION);
  const controller = useAppController();
  return (
    <AttentionInspectorPanel
      sessionId={sessionId}
      attention={attention}
      loading={loading}
      queryAttention={controller.queryAttention}
      selectedContextId={selection.contextId}
      selectedItemId={selection.itemId}
      detailView={detailView}
      onDetailViewChange={onDetailViewChange}
      queryText={queryText}
      onQueryTextChange={onQueryTextChange}
      onSelectionChange={onSelectionChange}
    />
  );
};

const DevtoolsObservabilitySurface = ({ sessionId }: { sessionId: string }) => {
  const controller = useAppController();
  const runtime = useRuntimeSelector((state) => state.runtimes[sessionId]);
  const attention = useRuntimeSelector((state) => state.attentionBySession?.[sessionId] ?? EMPTY_ATTENTION);
  const schedulerLogs = useRuntimeSelector((state) => state.schedulerLogsBySession[sessionId] ?? EMPTY_LOGS);
  const runtimeTraces = useRuntimeSelector((state) => state.observabilityTracesBySession[sessionId] ?? EMPTY_TRACES);
  const modelCalls = useRuntimeSelector((state) => state.modelCallsBySession[sessionId] ?? EMPTY_MODEL_CALLS);
  const apiCalls = useRuntimeSelector((state) => state.apiCallsBySession[sessionId] ?? EMPTY_API_CALLS);
  const apiCallRecording = useRuntimeSelector(
    (state) => state.apiCallRecordingBySession[sessionId] ?? EMPTY_API_CALL_RECORDING,
  );

  return (
    <ObservabilityPanel
      stage={runtime?.stage ?? "idle"}
      kernel={runtime?.schedulerState ?? null}
      inputSignals={
        runtime?.schedulerSignals ?? {
          user: { version: 0, timestamp: null },
          terminal: { version: 0, timestamp: null },
          task: { version: 0, timestamp: null },
          attention: { version: 0, timestamp: null },
        }
      }
      attention={attention}
      logs={normalizeSchedulerStateLogs(schedulerLogs)}
      traces={runtimeTraces}
      modelCalls={modelCalls}
      apiCalls={apiCalls}
      apiRecording={apiCallRecording}
      hasMoreTrace={controller.getLongListPagingState({ resource: "observability-trace", sessionId }).hasMore}
      loadingTrace={controller.getLongListPagingState({ resource: "observability-trace", sessionId }).loadingOlder}
      onLoadMoreTrace={() => {
        void controller.loadMoreTrace(sessionId);
      }}
      hasMoreModel={controller.getLongListPagingState({ resource: "model-calls", sessionId }).hasMore}
      loadingModel={controller.getLongListPagingState({ resource: "model-calls", sessionId }).loadingOlder}
      onLoadMoreModel={() => {
        void controller.loadMoreModel(sessionId);
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
  const search = workspaceChatRoute.useSearch();
  const connected = useRuntimeSelector((state) => state.connected);
  const session = useRuntimeSelector(selectSessionChromeState(search.sessionId), equalSessionChromeState);
  const workspace = useRuntimeSelector(selectWorkspaceChromeState(search.workspacePath), equalWorkspaceChromeState);
  const runtime = useRuntimeSelector(selectChatRuntimeState(search.sessionId), equalChatRuntimeState);
  const runtimeChatMessages = useRuntimeSelector((state) =>
    search.sessionId ? state.chatsBySession[search.sessionId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES,
  );
  const channelsResource = useRuntimeSelector(
    (state) => (search.sessionId ? state.messageChannelsBySession[search.sessionId] : undefined) ?? EMPTY_MESSAGE_CHANNELS_RESOURCE,
  );
  const setChatVisibility = controller.setChatVisibility;
  const consumeNotifications = controller.consumeNotifications;
  const routeRuntime = runtime ?? undefined;
  const sessionStatusPill = resolveSessionStatusPillState(session, routeRuntime);
  const baseRouteNotice = resolveChatRouteNotice({
    notice: controller.notice,
    session,
    runtime: routeRuntime,
  });
  const [latestVisibleMessageId, setLatestVisibleMessageId] = useState<string | null>(null);
  const pageFocusedRef = useRef(true);
  const focusedChatKeyRef = useRef<string | null>(null);
  const channels = channelsResource.data;
  const channelsLoading = channelsResource.loading || channelsResource.refreshing;
  const channelsError = channelsResource.error;
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.chatId === search.chatId) ?? channels[0] ?? null,
    [channels, search.chatId],
  );
  const selectedChatId = selectedChannel?.chatId ?? null;
  const bootstrapMessages = useMemo(
    () => toBootstrapChannelMessages(selectedChannel, runtimeChatMessages),
    [runtimeChatMessages, selectedChannel],
  );
  const legacyRouteNotice = useMemo(() => {
    const message = extractInternalFailureNotice(
      runtimeChatMessages.filter((chatMessage) => (selectedChatId ? chatMessage.chatId === selectedChatId : true)),
    );
    return message
      ? {
          tone: "destructive" as const,
          message: normalizeUserNotice(message, "Something failed while preparing this session."),
        }
      : null;
  }, [runtimeChatMessages, selectedChatId]);
  const routeNotice =
    channelsError && !baseRouteNotice
      ? { tone: "destructive" as const, message: channelsError }
      : (baseRouteNotice ?? legacyRouteNotice);
  const handleChatHeaderAction = useCallback(() => {
    if (!search.sessionId) {
      return;
    }
    if (sessionStatusPill.primaryAction === "stop") {
      void controller.stopSession(search.sessionId);
      return;
    }
    void controller.startSession(search.sessionId);
  }, [controller, search.sessionId, sessionStatusPill.primaryAction]);
  const handleAbortSession = useCallback(() => {
    if (!search.sessionId) {
      return;
    }
    void controller.abortSession(search.sessionId);
  }, [controller, search.sessionId]);

  const handleWorkspaceChatNavigate = useCallback(
    (tab: "chat" | "terminals" | "devtools" | "settings") => {
      if (tab === "chat") {
        void navigate({
          to: "/workspace/chat",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId, {
            chatId: selectedChannel?.chatId,
          }),
        });
        return;
      }
      if (tab === "settings") {
        void navigate({
          to: "/workspace/settings",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId, {
            chatId: selectedChannel?.chatId,
          }),
        });
        return;
      }
      if (tab === "terminals") {
        void navigate({
          to: "/workspace/terminals",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId, {
            chatId: selectedChannel?.chatId,
          }),
        });
        return;
      }
      if (!search.sessionId) {
        return;
      }
      void navigate({
        to: "/session/$sessionId/devtools",
        params: { sessionId: search.sessionId },
        search: buildSessionDevtoolsSearch({ panel: "attention" }),
      });
    },
    [navigate, search.sessionId, search.workspacePath, selectedChannel?.chatId],
  );

  useEffect(() => {
    setLatestVisibleMessageId(null);
  }, [search.sessionId]);

  useEffect(() => {
    const sessionId = search.sessionId;
    if (!connected || !sessionId || channelsResource.loaded || channelsResource.loading || channelsResource.refreshing) {
      return;
    }
    void controller.ensureMessageChannels(sessionId);
  }, [channelsResource.loaded, channelsResource.loading, channelsResource.refreshing, connected, controller, search.sessionId]);

  useEffect(() => {
    if (!search.sessionId || !channelsResource.loaded) {
      return;
    }
    const selected = channels.find((item) => item.chatId === search.chatId) ?? channels[0] ?? null;
    if (selected && selected.chatId !== search.chatId) {
      void navigate({
        to: "/workspace/chat",
        replace: true,
        search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId, { chatId: selected.chatId }),
      });
    }
  }, [channels, channelsResource.loaded, navigate, search.chatId, search.sessionId, search.workspacePath]);

  useEffect(() => {
    const sessionId = search.sessionId;
    const chatId = selectedChannel?.chatId;
    const focusKey = sessionId && chatId ? `${sessionId}:${chatId}` : null;
    if (!sessionId || !chatId || !routeRuntime?.started || focusedChatKeyRef.current === focusKey) {
      return;
    }
    focusedChatKeyRef.current = focusKey;
    void controller
      .focusMessageChannels({
        sessionId,
        op: "replace",
        channels: [{ chatId, accessToken: selectedChannel.accessToken }],
      })
      .catch(() => {
        focusedChatKeyRef.current = null;
      });
  }, [controller, routeRuntime?.started, search.sessionId, selectedChannel?.accessToken, selectedChannel?.chatId]);

  useEffect(() => {
    const sessionId = search.sessionId;
    const chatId = selectedChannel?.chatId;
    if (!connected || !sessionId || !chatId) {
      return;
    }

    pageFocusedRef.current =
      typeof document.hasFocus === "function" ? document.hasFocus() || document.visibilityState === "visible" : true;

    const syncVisibility = (focused = pageFocusedRef.current) => {
      const visible = document.visibilityState === "visible";
      const nextFocused = visible && focused;
      void setChatVisibility({ sessionId, chatId, visible, focused: nextFocused });
      if (visible && nextFocused && latestVisibleMessageId) {
        void consumeNotifications({
          sessionId,
          chatId,
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
      void setChatVisibility({ sessionId, chatId, visible: false, focused: false });
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    connected,
    consumeNotifications,
    latestVisibleMessageId,
    search.sessionId,
    selectedChannel?.chatId,
    setChatVisibility,
  ]);

  return (
    <WorkspaceShellFrame
      workspacePath={search.workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="chat"
      onNavigate={handleWorkspaceChatNavigate}
      headerStatusSlot={
        search.sessionId ? (
          <SessionStatusPillMenu
            triggerVariant="icon"
            statusLabel={sessionStatusPill.label}
            tone={sessionStatusPill.tone}
            primaryActionLabel={sessionStatusPill.primaryActionLabel}
            primaryActionDisabled={sessionStatusPill.disabled}
            onPrimaryAction={handleChatHeaderAction}
            onAbort={handleAbortSession}
          />
        ) : null
      }
    >
      {search.sessionId ? (
        <MessageChannelSurface
          sessionId={search.sessionId}
          workspacePath={search.workspacePath}
          channels={channels}
          selectedChatId={selectedChannel?.chatId ?? null}
          channelsLoading={channelsLoading}
          channelsError={channelsError}
          disabled={!routeRuntime?.started}
          imageCompatible={runtime?.imageInput ?? false}
          routeNotice={routeNotice}
          initialMessages={bootstrapMessages}
          assistantAvatarUrl={
            session ? controller.runtimeStore.avatarIconUrl(session.avatar, search.workspacePath) : null
          }
          assistantAvatarLabel={session?.avatar ?? "Assistant"}
          userAvatarLabel="You"
          onSelectChannel={(chatId) => {
            void navigate({
              to: "/workspace/chat",
              search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId, { chatId }),
            });
          }}
          onCreateChannel={(kind) => {
            const sessionId = search.sessionId;
            if (!sessionId) {
              return;
            }
            const nextCount = channels.filter((channel) => channel.kind === kind).length + 1;
            const title = kind === "room" ? `Room ${nextCount}` : `Chat ${nextCount}`;
            void controller
              .createMessageChannel({
                sessionId,
                kind,
                title,
                focus: true,
              })
              .then((created) => {
                void navigate({
                  to: "/workspace/chat",
                  search: renderWorkspaceRouteTarget(search.workspacePath, sessionId, { chatId: created.chatId }),
                });
              });
          }}
          onSendMessage={({ channel, payload }) => {
            const sessionId = search.sessionId;
            if (!sessionId) {
              return Promise.resolve();
            }
            return controller.sendMessageChannel({
              sessionId,
              chatId: channel.chatId,
              accessToken: channel.accessToken,
              payload,
            });
          }}
          onUpdateChannel={async (input) => {
            const sessionId = search.sessionId;
            if (!sessionId) {
              throw new Error("session runtime is not active");
            }
            const channel = await controller.updateMessageChannel({
              sessionId,
              chatId: input.channel.chatId,
              accessToken: input.channel.accessToken,
              patch: input.patch,
            });
            return channel;
          }}
          onListChannelGrants={async (channel) => {
            const sessionId = search.sessionId;
            if (!sessionId) {
              throw new Error("session runtime is not active");
            }
            return await controller.listMessageChannelGrants({
              sessionId,
              chatId: channel.chatId,
              accessToken: channel.accessToken,
            });
          }}
          onIssueChannelGrant={async (input) => {
            const sessionId = search.sessionId;
            if (!sessionId) {
              throw new Error("session runtime is not active");
            }
            return await controller.issueMessageChannelGrant({
              sessionId,
              chatId: input.channel.chatId,
              accessToken: input.channel.accessToken,
              role: input.role,
              label: input.label,
              participantId: input.participantId,
            });
          }}
          onRevokeChannelGrant={async (input) => {
            const sessionId = search.sessionId;
            if (!sessionId) {
              throw new Error("session runtime is not active");
            }
            return await controller.revokeMessageChannelGrant({
              sessionId,
              chatId: input.channel.chatId,
              accessToken: input.channel.accessToken,
              grantId: input.grantId,
            });
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
            if (command === "/compact" && selectedChannel) {
              await controller.sendMessageChannel({
                sessionId: search.sessionId,
                chatId: selectedChannel.chatId,
                accessToken: selectedChannel.accessToken,
                payload: { text: "/compact", assets: [] },
              });
            }
          }}
          onSearchPaths={controller.searchWorkspacePaths}
          onLatestVisibleAssistantMessageIdChange={setLatestVisibleMessageId}
          onOpenDevtools={(cycleId) => {
            if (!search.sessionId) {
              return;
            }
            void navigate({
              to: "/session/$sessionId/devtools",
              params: { sessionId: search.sessionId },
              search: buildSessionDevtoolsSearch({
                panel: cycleId ? "cycles" : "attention",
                cycleId,
              }),
            });
          }}
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

const WorkspaceTerminalsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const search = workspaceTerminalsRoute.useSearch();
  const session = useRuntimeSelector(selectSessionChromeState(search.sessionId), equalSessionChromeState);
  const workspace = useRuntimeSelector(selectWorkspaceChromeState(search.workspacePath), equalWorkspaceChromeState);
  const routeRuntime = useRuntimeSelector(selectChatRuntimeState(search.sessionId), equalChatRuntimeState);
  const sessionStatusPill = resolveSessionStatusPillState(session, routeRuntime ?? undefined);
  const hasRuntime = useRuntimeSelector((state) =>
    search.sessionId ? Boolean(state.runtimes[search.sessionId]) : false,
  );
  const routeNotice = resolveChatRouteNotice({
    notice: controller.notice,
    session,
    runtime: routeRuntime ?? undefined,
  });
  const terminalsSurfaceLoading =
    Boolean(search.sessionId) &&
    !hasRuntime &&
    session?.status !== "stopped" &&
    session?.status !== "paused" &&
    session?.status !== "error";

  const handleWorkspaceTerminalsNavigate = useCallback(
    (tab: "chat" | "terminals" | "devtools" | "settings") => {
      if (tab === "settings") {
        void navigate({
          to: "/workspace/settings",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
        });
        return;
      }
      if (tab === "chat") {
        void navigate({
          to: "/workspace/chat",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId, { chatId: search.chatId }),
        });
        return;
      }
      if (tab === "devtools") {
        if (!search.sessionId) {
          return;
        }
        void navigate({
          to: "/session/$sessionId/devtools",
          params: { sessionId: search.sessionId },
          search: buildSessionDevtoolsSearch({ panel: "attention" }),
        });
      }
    },
    [navigate, search.chatId, search.sessionId, search.workspacePath],
  );
  const handleSessionPrimaryAction = useCallback(() => {
    if (!search.sessionId) {
      return;
    }
    if (sessionStatusPill.primaryAction === "stop") {
      void controller.stopSession(search.sessionId);
      return;
    }
    void controller.startSession(search.sessionId);
  }, [controller, search.sessionId, sessionStatusPill.primaryAction]);
  const handleAbortSession = useCallback(() => {
    if (!search.sessionId) {
      return;
    }
    void controller.abortSession(search.sessionId);
  }, [controller, search.sessionId]);

  return (
    <WorkspaceShellFrame
      workspacePath={search.workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="terminals"
      onNavigate={handleWorkspaceTerminalsNavigate}
      headerStatusSlot={
        search.sessionId ? (
          <SessionStatusPillMenu
            triggerVariant="icon"
            statusLabel={sessionStatusPill.label}
            tone={sessionStatusPill.tone}
            primaryActionLabel={sessionStatusPill.primaryActionLabel}
            primaryActionDisabled={sessionStatusPill.disabled}
            onPrimaryAction={handleSessionPrimaryAction}
            onAbort={handleAbortSession}
          />
        ) : null
      }
    >
      <section
        className={cn(
          surfaceToneClassName("panel"),
          "grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2.5 p-2.5 md:p-3",
        )}
      >
        {routeNotice ? <NoticeBanner tone={routeNotice.tone}>{routeNotice.message}</NoticeBanner> : null}
        <ViewportMask className="h-full">
          {search.sessionId ? (
            <SessionTerminalsSurface sessionId={search.sessionId} loading={terminalsSurfaceLoading} />
          ) : (
            <section className={cn(surfaceToneClassName("panel"), "flex h-full items-center justify-center p-6")}>
              <div className="space-y-3 text-center">
                <h2 className="typo-title-3 text-slate-900">No session selected</h2>
                <p className="text-sm text-slate-600">Create or resume a session from Workspaces to inspect terminals.</p>
              </div>
            </section>
          )}
        </ViewportMask>
      </section>
    </WorkspaceShellFrame>
  );
};

const SessionDevtoolsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const adaptiveViewport = useAdaptiveViewport();
  const params = sessionDevtoolsRoute.useParams();
  const search = sessionDevtoolsRoute.useSearch();
  const sessionId = params.sessionId;
  const session = useRuntimeSelector(selectSessionChromeState(sessionId), equalSessionChromeState);
  const workspacePath = session?.cwd ?? "";
  const workspace = useRuntimeSelector(selectWorkspaceChromeState(workspacePath), equalWorkspaceChromeState);
  const routeRuntime = useRuntimeSelector(selectChatRuntimeState(sessionId), equalChatRuntimeState);
  const sessionStatusPill = resolveSessionStatusPillState(session, routeRuntime ?? undefined);
  const hasRuntime = useRuntimeSelector((state) => Boolean(state.runtimes[sessionId]));
  const routeNotice = resolveChatRouteNotice({
    notice: controller.notice,
    session,
    runtime: routeRuntime ?? undefined,
  });
  const devtoolsSurfaceLoading =
    !hasRuntime && session?.status !== "stopped" && session?.status !== "paused" && session?.status !== "error";
  const attentionSelection = useMemo<AttentionSelectionState>(
    () => ({
      contextId: search.contextId ?? null,
      itemId: search.commitId ?? null,
    }),
    [search.commitId, search.contextId],
  );

  const navigateDevtools = useCallback(
    (patch: Partial<ReturnType<typeof validateSessionDevtoolsSearch>>, options?: { replace?: boolean }) => {
      void navigate({
        to: "/session/$sessionId/devtools",
        params: { sessionId },
        replace: options?.replace,
        search: (current) => buildSessionDevtoolsSearch(patch, current),
      });
    },
    [navigate, sessionId],
  );

  const handleDetailsTabChange = useCallback(
    (value: string) => {
      const panel: DevtoolsPanelId =
        value === "cycles" || value === "systems" || value === "observability" || value === "attention"
          ? value
          : "attention";
      navigateDevtools({ panel });
    },
    [navigateDevtools],
  );

  const handleSessionPrimaryAction = useCallback(() => {
    if (sessionStatusPill.primaryAction === "stop") {
      void controller.stopSession(sessionId);
      return;
    }
    void controller.startSession(sessionId);
  }, [controller, sessionId, sessionStatusPill.primaryAction]);

  const handleAbortSession = useCallback(() => {
    void controller.abortSession(sessionId);
  }, [controller, sessionId]);

  const handleWorkspaceDevtoolsNavigate = useCallback(
    (tab: "chat" | "terminals" | "devtools" | "settings") => {
      if (tab === "devtools") {
        return;
      }
      if (tab === "settings") {
        void navigate({
          to: "/workspace/settings",
          search: renderWorkspaceRouteTarget(workspacePath, sessionId),
        });
        return;
      }
      if (tab === "terminals") {
        void navigate({
          to: "/workspace/terminals",
          search: renderWorkspaceRouteTarget(workspacePath, sessionId),
        });
        return;
      }
      void navigate({
        to: "/workspace/chat",
        search: renderWorkspaceRouteTarget(workspacePath, sessionId),
      });
    },
    [navigate, sessionId, workspacePath],
  );

  const handleOpenAttentionRef = useCallback(
    (selection: AttentionSelectionState) => {
      navigateDevtools({
        panel: "attention",
        contextId: selection.contextId ?? undefined,
        commitId: selection.itemId ?? undefined,
        attentionView: selection.itemId ? "items" : "context",
      });
    },
    [navigateDevtools],
  );

  const renderPanel = () => {
    if (search.panel === "attention") {
      return (
        <DevtoolsAttentionSurface
          sessionId={sessionId}
          loading={devtoolsSurfaceLoading}
          selection={attentionSelection}
          detailView={search.attentionView}
          queryText={search.attentionQuery ?? ""}
          onDetailViewChange={(view) => {
            navigateDevtools({ panel: "attention", attentionView: view });
          }}
          onQueryTextChange={(query) => {
            navigateDevtools(
              {
                panel: "attention",
                attentionView: "items",
                attentionQuery: query.trim().length > 0 ? query : undefined,
              },
              { replace: true },
            );
          }}
          onSelectionChange={(selection) => {
            navigateDevtools({
              panel: "attention",
              contextId: selection.contextId ?? undefined,
              commitId: selection.itemId ?? undefined,
            });
          }}
        />
      );
    }
    if (search.panel === "systems") {
      return <SystemsPanel sessionId={sessionId} loading={devtoolsSurfaceLoading} />;
    }
    if (search.panel === "cycles") {
      return (
        <DevtoolsCyclesSurface
          sessionId={sessionId}
          loading={devtoolsSurfaceLoading}
          selectedCycleId={search.cycleId ? `cycle:${search.cycleId}` : null}
          detailMode={adaptiveViewport.compact ? "sheet" : "split"}
          onOpenAttentionRef={handleOpenAttentionRef}
        />
      );
    }
    return <DevtoolsObservabilitySurface sessionId={sessionId} />;
  };

  return (
    <WorkspaceShellFrame
      workspacePath={workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="devtools"
      onNavigate={handleWorkspaceDevtoolsNavigate}
      headerStatusSlot={
        <SessionStatusPillMenu
          triggerVariant="icon"
          statusLabel={sessionStatusPill.label}
          tone={sessionStatusPill.tone}
          primaryActionLabel={sessionStatusPill.primaryActionLabel}
          primaryActionDisabled={sessionStatusPill.disabled}
          onPrimaryAction={handleSessionPrimaryAction}
          onAbort={handleAbortSession}
        />
      }
    >
      <section className={cn(surfaceToneClassName("panel"), "flex h-full flex-col gap-2.5 p-2.5 md:p-3")}>
        <div className="shrink-0">
          <Tabs items={DETAIL_TABS} value={search.panel} onValueChange={handleDetailsTabChange} />
        </div>
        <div
          className={cn(
            "grid min-h-0 flex-1",
            routeNotice ? "grid-rows-[auto_minmax(0,1fr)] gap-2.5" : "grid-rows-[minmax(0,1fr)]",
          )}
        >
          {routeNotice ? <NoticeBanner tone={routeNotice.tone}>{routeNotice.message}</NoticeBanner> : null}
          <ViewportMask className="h-full">{renderPanel()}</ViewportMask>
        </div>
      </section>
    </WorkspaceShellFrame>
  );
};

const WorkspaceDevtoolsRedirectRouteView = () => {
  const navigate = useNavigate();
  const search = workspaceDevtoolsRoute.useSearch();

  useEffect(() => {
    if (!search.sessionId) {
      return;
    }
    void navigate({
      to: "/session/$sessionId/devtools",
      params: { sessionId: search.sessionId },
      replace: true,
      search: buildSessionDevtoolsSearch({
        panel: search.cycleId ? "cycles" : "attention",
        cycleId: search.cycleId,
      }),
    });
  }, [navigate, search.cycleId, search.sessionId]);

  return (
    <section className={cn(surfaceToneClassName("panel"), "flex h-full items-center justify-center p-6")}>
      <p className="text-sm text-slate-600">Redirecting to session Devtools...</p>
    </section>
  );
};

const WorkspaceSettingsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const adaptiveViewport = useAdaptiveViewport();
  const search = workspaceSettingsRoute.useSearch();
  const connected = useRuntimeSelector((state) => state.connected);
  const session = useRuntimeSelector(selectSessionChromeState(search.sessionId), equalSessionChromeState);
  const routeRuntime = useRuntimeSelector(selectChatRuntimeState(search.sessionId), equalChatRuntimeState);
  const workspace = useRuntimeSelector(selectWorkspaceChromeState(search.workspacePath), equalWorkspaceChromeState);
  const sessionStatusPill = resolveSessionStatusPillState(session, routeRuntime ?? undefined);
  const ensureSettingsLayers = controller.ensureSettingsLayers;
  const refreshSettingsLayers = controller.refreshSettingsLayers;

  useEffect(() => {
    if (!connected || !search.workspacePath) {
      return;
    }
    void ensureSettingsLayers(search.workspacePath);
  }, [connected, ensureSettingsLayers, search.workspacePath]);
  const handleWorkspaceSettingsNavigate = useCallback(
    (tab: "chat" | "terminals" | "devtools" | "settings") => {
      if (tab === "settings") {
        return;
      }
      if (tab === "terminals") {
        void navigate({
          to: "/workspace/terminals",
          search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
        });
        return;
      }
      if (tab === "devtools") {
        if (!search.sessionId) {
          return;
        }
        void navigate({
          to: "/session/$sessionId/devtools",
          params: { sessionId: search.sessionId },
          search: buildSessionDevtoolsSearch({ panel: "attention" }),
        });
        return;
      }
      void navigate({
        to: "/workspace/chat",
        search: renderWorkspaceRouteTarget(search.workspacePath, search.sessionId),
      });
    },
    [navigate, search.sessionId, search.workspacePath],
  );
  const handleSessionPrimaryAction = useCallback(() => {
    if (!search.sessionId) {
      return;
    }
    if (sessionStatusPill.primaryAction === "stop") {
      void controller.stopSession(search.sessionId);
      return;
    }
    void controller.startSession(search.sessionId);
  }, [controller, search.sessionId, sessionStatusPill.primaryAction]);
  const handleAbortSession = useCallback(() => {
    if (!search.sessionId) {
      return;
    }
    void controller.abortSession(search.sessionId);
  }, [controller, search.sessionId]);

  return (
    <WorkspaceShellFrame
      workspacePath={search.workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="settings"
      onNavigate={handleWorkspaceSettingsNavigate}
      headerStatusSlot={
        search.sessionId ? (
          <SessionStatusPillMenu
            triggerVariant="icon"
            statusLabel={sessionStatusPill.label}
            tone={sessionStatusPill.tone}
            primaryActionLabel={sessionStatusPill.primaryActionLabel}
            primaryActionDisabled={sessionStatusPill.disabled}
            onPrimaryAction={handleSessionPrimaryAction}
            onAbort={handleAbortSession}
          />
        ) : null
      }
    >
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2.5">
        <ViewportMask className="h-full">
          {search.workspacePath ? (
            <SettingsPanel
              disabled={!search.workspacePath}
              loading={controller.settingsLoading}
              status={controller.settingsStatus}
              effective={controller.settingsEffective}
              layers={controller.settingsLayers}
              selectedLayerId={controller.selectedLayerId}
              layerContent={controller.layerDraft}
              detailMode={adaptiveViewport.compact ? "sheet" : "split"}
              onSelectLayer={(layerId) => {
                controller.setSelectedLayerId(layerId);
                controller.setLayerDraft("");
              }}
              onLayerContentChange={controller.setLayerDraft}
              onRefreshLayers={() => {
                void refreshSettingsLayers(search.workspacePath);
              }}
              onLoadLayer={(layerId) => {
                void controller.loadSelectedLayer(search.workspacePath, layerId);
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
        </ViewportMask>
      </div>
    </WorkspaceShellFrame>
  );
};

const GlobalSettingsRouteView = () => {
  const controller = useAppController();
  const connected = useRuntimeSelector((state) => state.connected);
  const adaptiveViewport = useAdaptiveViewport();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle");
  const [effective, setEffective] = useState<SettingsEffectiveGraph>(EMPTY_SETTINGS_EFFECTIVE);
  const [layers, setLayers] = useState<SettingsLayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerDraft, setLayerDraft] = useState("{}\n");
  const [layerMtimeMs, setLayerMtimeMs] = useState(0);
  const [avatars, setAvatars] = useState<Array<{ nickname: string; active: boolean; iconUrl: string }>>([]);
  const [activeAvatar, setActiveAvatar] = useState("");

  const loadLayer = async (layerId: string) => {
    setLoading(true);
    try {
      const file = await controller.runtimeStore.readScopedSettingsLayer({
        scope: "global",
        layerId,
      });
      setLayerDraft(file.content);
      setLayerMtimeMs(file.mtimeMs);
      setStatus(`loaded: ${file.path}`);
    } catch (error) {
      controller.setNotice(String(error instanceof Error ? error.message : error));
      setStatus("load failed");
    } finally {
      setLoading(false);
    }
  };

  const selectPreferredLayer = (items: SettingsLayerItem[], previous: string | null): string | null => {
    if (previous && items.some((layer) => layer.layerId === previous)) {
      return previous;
    }
    return items.find((layer) => layer.editable)?.layerId ?? items[0]?.layerId ?? null;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [settingsScope, avatarCatalog] = await Promise.all([
        controller.runtimeStore.listScopedSettings({ scope: "global" }),
        controller.runtimeStore.listAvatarCatalog(),
      ]);
      setEffective(settingsScope.effective);
      setLayers(settingsScope.layers);
      setAvatars(avatarCatalog.items);
      setActiveAvatar(avatarCatalog.activeAvatar);
      const nextLayerId = selectPreferredLayer(settingsScope.layers, selectedLayerId);
      setSelectedLayerId(nextLayerId);
      if (nextLayerId) {
        const file = await controller.runtimeStore.readScopedSettingsLayer({
          scope: "global",
          layerId: nextLayerId,
        });
        setLayerDraft(file.content);
        setLayerMtimeMs(file.mtimeMs);
      } else {
        setLayerDraft("{}\n");
        setLayerMtimeMs(0);
      }
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
        detailMode={adaptiveViewport.compact ? "sheet" : "split"}
        effective={effective}
        layers={layers}
        selectedLayerId={selectedLayerId}
        layerContent={layerDraft}
        avatars={avatars}
        activeAvatar={activeAvatar}
        onSelectLayer={(layerId) => {
          setSelectedLayerId(layerId);
        }}
        onLayerContentChange={setLayerDraft}
        onRefreshLayers={() => {
          void refresh();
        }}
        onLoadLayer={(layerId) => {
          void loadLayer(layerId);
        }}
        onSaveLayer={() => {
          if (!selectedLayerId) {
            return;
          }
          setSaving(true);
          void controller.runtimeStore
            .saveScopedSettingsLayer({
              scope: "global",
              layerId: selectedLayerId,
              content: layerDraft,
              baseMtimeMs: layerMtimeMs,
            })
            .then((result) => {
              if (!result.ok) {
                if (result.reason === "conflict") {
                  setLayerDraft(result.latest.content);
                  setLayerMtimeMs(result.latest.mtimeMs);
                  setStatus("save conflict");
                  return;
                }
                setStatus(result.message);
                return;
              }
              setLayerDraft(result.file.content);
              setLayerMtimeMs(result.file.mtimeMs);
              setEffective(result.effective);
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

const workspaceTerminalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace/terminals",
  validateSearch: validateWorkspaceOnlySearch,
  component: WorkspaceTerminalsRouteView,
});

const workspaceDevtoolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace/devtools",
  validateSearch: validateWorkspaceDevtoolsSearch,
  component: WorkspaceDevtoolsRedirectRouteView,
});

const sessionDevtoolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId/devtools",
  validateSearch: validateSessionDevtoolsSearch,
  component: SessionDevtoolsRouteView,
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
  workspaceTerminalsRoute,
  workspaceDevtoolsRoute,
  sessionDevtoolsRoute,
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
