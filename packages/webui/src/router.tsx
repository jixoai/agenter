import type { CachedResourceState, MessageChannelEntry, ProfileListItem } from "@agenter/client-sdk";
import type { WebChatMessage } from "@agenter/web-chat-view";
import { createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
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
import { useIconServiceUrls } from "./features/profile/icon-service";
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
import {
  equalChatRuntimeState,
  equalSessionChromeState,
  equalWorkspaceChromeState,
  selectChatRuntimeState,
  selectSessionChromeState,
  selectWorkspaceChromeState,
} from "./features/shell/runtime-selectors";
import { useAdaptiveViewport } from "./features/shell/useAdaptiveViewport";
import { SessionTerminalsSurface } from "./features/terminal/SessionTerminalsSurface";
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
const EMPTY_UNREAD_COUNTS: Record<string, number> = {};
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
const PROFILE_AUTH_STORAGE_KEY = "agenter:webui:profile-auth";
const PROFILE_AUTH_MESSAGE_SOURCE = "agenter-profile-service";

type DurableProfileItem = ProfileListItem & { profileId: string };

type ProfileEditorDraft = {
  nickname: string;
  displayName: string;
  phone: string;
  address: string;
};

type StoredProfileAuth = {
  token: string;
  profileId: string | null;
};

const readSearchString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readProfileReference = (value: unknown): string => (typeof value === "string" && value.trim().length > 0 ? value.trim() : "");

const patchActiveProfileReference = (content: string, profileReference: string): string => {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    parsed.profileReference = profileReference;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return `{\n  "profileReference": "${profileReference}"\n}\n`;
  }
};

const isDurableProfileItem = (profile: ProfileListItem): profile is DurableProfileItem =>
  typeof profile.profileId === "string" && profile.profileId.trim().length > 0;

const createEmptyProfileDraft = (): ProfileEditorDraft => ({
  nickname: "",
  displayName: "",
  phone: "",
  address: "",
});

const toProfileDraft = (profile: DurableProfileItem | null): ProfileEditorDraft => ({
  nickname: profile?.metadata.nickname ?? "",
  displayName: profile?.metadata.displayName ?? "",
  phone: profile?.metadata.phone ?? "",
  address: profile?.metadata.address ?? "",
});

const selectPreferredProfileReference = (
  profiles: DurableProfileItem[],
  input: { preferred?: string | null; active?: string | null; authenticated?: string | null },
): string | null => {
  const candidates = [input.preferred, input.active, input.authenticated];
  for (const candidate of candidates) {
    if (candidate && profiles.some((profile) => profile.profileId === candidate)) {
      return candidate;
    }
  }
  return profiles[0]?.profileId ?? null;
};

const readStoredProfileAuth = (): StoredProfileAuth => {
  if (typeof window === "undefined") {
    return { token: "", profileId: null };
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_AUTH_STORAGE_KEY);
    if (!raw) {
      return { token: "", profileId: null };
    }
    const parsed = JSON.parse(raw) as { token?: unknown; profileId?: unknown };
    return {
      token: typeof parsed.token === "string" ? parsed.token : "",
      profileId: typeof parsed.profileId === "string" && parsed.profileId.trim().length > 0 ? parsed.profileId : null,
    };
  } catch {
    return { token: "", profileId: null };
  }
};

const writeStoredProfileAuth = (auth: StoredProfileAuth): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (!auth.token) {
    window.localStorage.removeItem(PROFILE_AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(PROFILE_AUTH_STORAGE_KEY, JSON.stringify(auth));
};

const openProfilePopup = (url: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  const popupUrl = new URL(url, window.location.origin);
  popupUrl.searchParams.set("openerOrigin", window.location.origin);
  window.open(popupUrl.toString(), "_blank", "popup=yes,width=560,height=720");
};

const validateSessionChatSearch = (search: Record<string, unknown>) => ({
  chatId: readSearchString(search.chatId),
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
    updatedAt?: number;
    visibleAt?: number;
    attentionState?: "queued" | "loaded";
    attentionLoadedAt?: number;
    editable?: boolean;
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
    .map((message, index) => {
      const attentionState = message.attentionState ?? "loaded";
      const visibleAt = message.visibleAt ?? (attentionState === "loaded" ? message.updatedAt ?? message.timestamp : undefined);
      return {
        rowId: Number.isFinite(Number(message.id)) ? Number(message.id) : index + 1,
        messageId: message.id,
        chatId: channel.chatId,
        from: message.role === "assistant" ? channel.owner : "User",
        to: message.role === "assistant" ? undefined : channel.owner,
        kind: message.messageKind ?? "text",
        content: message.content,
        createdAt: message.timestamp,
        updatedAt: message.updatedAt ?? message.timestamp,
        visibleAt,
        attentionState,
        attentionLoadedAt:
          message.attentionLoadedAt ?? (attentionState === "loaded" ? visibleAt ?? message.updatedAt ?? message.timestamp : undefined),
        editable: message.editable ?? attentionState === "queued",
        metadata: {
          ...(message.channel ? { channel: message.channel } : {}),
          ...(message.format ? { format: message.format } : {}),
          ...(message.cycleId != null ? { cycleId: message.cycleId } : {}),
        },
        attachments: message.attachments?.map((attachment) => ({ ...attachment })),
        payload: message.messagePayload,
      };
    });
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
  detailView: "context" | "items" | "search";
  queryText: string;
  onDetailViewChange: (view: "context" | "items" | "search") => void;
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
        bootstrapConfig={controller.quickstartBootstrapConfig}
        bootstrapLoading={controller.quickstartBootstrapLoading}
        onOpenWorkspacePicker={() => setWorkspacePickerOpen(true)}
        onEnterWorkspace={async () => {
          const sessionId = await controller.enterWorkspace();
          if (!sessionId) {
            return;
          }
          await navigate({
            to: "/session/$sessionId/chats",
            params: { sessionId },
            search: { chatId: undefined },
          });
        }}
        onSaveBootstrapConfig={controller.saveQuickstartBootstrapConfig}
        onSubmit={async (payload) => {
          const sessionId = await controller.quickstartSubmit(payload);
          if (!sessionId) {
            return;
          }
          await navigate({
            to: "/session/$sessionId/chats",
            params: { sessionId },
            search: { chatId: undefined },
          });
        }}
        onSearchPaths={controller.searchWorkspacePaths}
        onResumeSession={async (sessionId) => {
          await controller.resumeSession(sessionId, controller.quickstartWorkspacePath);
          await navigate({
            to: "/session/$sessionId/chats",
            params: { sessionId },
            search: { chatId: undefined },
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
                to: "/session/$sessionId/chats",
                params: { sessionId },
                search: { chatId: undefined },
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
                to: "/session/$sessionId/chats",
                params: { sessionId },
                search: { chatId: undefined },
              });
            });
          }}
          onOpenSession={(sessionId) => {
            void controller.resumeSession(sessionId, selectedWorkspace?.path).then(() => {
              void navigate({
                to: "/session/$sessionId/chats",
                params: { sessionId },
                search: { chatId: undefined },
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

const SessionChatsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const params = sessionChatsRoute.useParams();
  const search = sessionChatsRoute.useSearch();
  const sessionId = params.sessionId;
  const connected = useRuntimeSelector((state) => state.connected);
  const session = useRuntimeSelector(selectSessionChromeState(sessionId), equalSessionChromeState);
  const workspacePath = session?.cwd ?? "";
  const workspace = useRuntimeSelector(selectWorkspaceChromeState(workspacePath), equalWorkspaceChromeState);
  const runtime = useRuntimeSelector(selectChatRuntimeState(sessionId), equalChatRuntimeState);
  const runtimeChatMessages = useRuntimeSelector((state) => state.chatsBySession[sessionId] ?? EMPTY_MESSAGES);
  const unreadByChat = useRuntimeSelector((state) => state.unreadByChat[sessionId] ?? EMPTY_UNREAD_COUNTS);
  const channelsResource = useRuntimeSelector(
    (state) => state.messageChannelsBySession[sessionId] ?? EMPTY_MESSAGE_CHANNELS_RESOURCE,
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
  const routeFocusSyncRef = useRef<string | null>(null);
  const channels = channelsResource.data;
  const channelsLoading = channelsResource.loading || channelsResource.refreshing;
  const channelsError = channelsResource.error;
  const iconUrls = useIconServiceUrls(controller.runtimeStore);
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
    if (sessionStatusPill.primaryAction === "stop") {
      void controller.stopSession(sessionId);
      return;
    }
    void controller.startSession(sessionId);
  }, [controller, sessionId, sessionStatusPill.primaryAction]);
  const handleAbortSession = useCallback(() => {
    void controller.abortSession(sessionId);
  }, [controller, sessionId]);

  const handleSessionChatsNavigate = useCallback(
    (tab: "chat" | "terminals" | "devtools" | "settings") => {
      if (tab === "chat") {
        void navigate({
          to: "/session/$sessionId/chats",
          params: { sessionId },
          search: { chatId: selectedChannel?.chatId },
        });
        return;
      }
      if (tab === "settings") {
        void navigate({
          to: "/session/$sessionId/settings",
          params: { sessionId },
        });
        return;
      }
      if (tab === "terminals") {
        void navigate({
          to: "/session/$sessionId/terminals",
          params: { sessionId },
        });
        return;
      }
      void navigate({
        to: "/session/$sessionId/devtools",
        params: { sessionId },
        search: buildSessionDevtoolsSearch({ panel: "attention" }),
      });
    },
    [navigate, selectedChannel?.chatId, sessionId],
  );

  useEffect(() => {
    setLatestVisibleMessageId(null);
  }, [sessionId]);

  useEffect(() => {
    if (!connected || channelsResource.loaded || channelsResource.loading || channelsResource.refreshing) {
      return;
    }
    void controller.ensureMessageChannels(sessionId);
  }, [
    channelsResource.loaded,
    channelsResource.loading,
    channelsResource.refreshing,
    connected,
    controller,
    sessionId,
  ]);

  useEffect(() => {
    if (!channelsResource.loaded) {
      return;
    }
    const selected = channels.find((item) => item.chatId === search.chatId) ?? channels[0] ?? null;
    if (selected && selected.chatId !== search.chatId) {
      void navigate({
        to: "/session/$sessionId/chats",
        params: { sessionId },
        replace: true,
        search: { chatId: selected.chatId },
      });
    }
  }, [channels, channelsResource.loaded, navigate, search.chatId, sessionId]);

  useEffect(() => {
    if (!connected || !channelsResource.loaded || !search.chatId || !selectedChannel) {
      return;
    }
    if (selectedChannel.chatId !== search.chatId) {
      return;
    }
    const syncKey = `${sessionId}:${selectedChannel.chatId}:${selectedChannel.accessToken}`;
    if (routeFocusSyncRef.current === syncKey) {
      return;
    }
    routeFocusSyncRef.current = syncKey;
    void controller
      .focusMessageChannels({
        sessionId,
        op: "replace",
        channels: [{ chatId: selectedChannel.chatId, accessToken: selectedChannel.accessToken }],
      })
      .catch(() => {
        if (routeFocusSyncRef.current === syncKey) {
          routeFocusSyncRef.current = null;
        }
      });
  }, [
    channelsResource.loaded,
    connected,
    controller,
    search.chatId,
    selectedChannel?.accessToken,
    selectedChannel?.chatId,
    sessionId,
  ]);

  useEffect(() => {
    const chatId = selectedChannel?.chatId;
    if (!connected || !chatId) {
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
  }, [connected, consumeNotifications, latestVisibleMessageId, selectedChannel?.chatId, sessionId, setChatVisibility]);

  return (
    <WorkspaceShellFrame
      workspacePath={workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="chat"
      onNavigate={handleSessionChatsNavigate}
      headerStatusSlot={
        <SessionStatusPillMenu
          triggerVariant="icon"
          statusLabel={sessionStatusPill.label}
          tone={sessionStatusPill.tone}
          primaryActionLabel={sessionStatusPill.primaryActionLabel}
          primaryActionDisabled={sessionStatusPill.disabled}
          onPrimaryAction={handleChatHeaderAction}
          onAbort={handleAbortSession}
        />
      }
    >
      <MessageChannelSurface
        sessionId={sessionId}
        workspacePath={workspacePath}
        channels={channels}
        unreadByChat={unreadByChat}
        selectedChatId={selectedChannel?.chatId ?? null}
        channelsLoading={channelsLoading}
        channelsError={channelsError}
        disabled={!routeRuntime?.started}
        imageCompatible={runtime?.imageInput ?? false}
        routeNotice={routeNotice}
        initialMessages={bootstrapMessages}
        assistantAvatarUrl={iconUrls.profile(session?.avatar)}
        assistantAvatarLabel={session?.avatar ?? "Assistant"}
        userAvatarLabel="You"
        onSelectChannel={(chatId) => {
          void navigate({
            to: "/session/$sessionId/chats",
            params: { sessionId },
            search: { chatId },
          });
        }}
        onCreateChannel={async (input) => {
          const created = await controller.createMessageChannel({
            sessionId,
            kind: input.kind,
            title: input.title,
            participants: input.participants,
            metadata: input.metadata,
            adminToken: input.adminToken,
            focus: false,
          });
          await navigate({
            to: "/session/$sessionId/chats",
            params: { sessionId },
            search: { chatId: created.chatId },
          });
        }}
        onFocusChannel={async (channel) => {
          await controller.focusMessageChannels({
            sessionId,
            op: channel.focused ? "remove" : "add",
            channels: [{ chatId: channel.chatId, accessToken: channel.accessToken }],
          });
          await navigate({
            to: "/session/$sessionId/chats",
            params: { sessionId },
            search: { chatId: channel.chatId },
          });
        }}
        onArchiveChannel={async (channel) => {
          await controller.archiveMessageChannel({
            sessionId,
            chatId: channel.chatId,
            accessToken: channel.accessToken,
          });
          const remaining = await controller.listMessageChannels(sessionId);
          const nextSelected = remaining.find((item) => item.focused) ?? remaining[0] ?? null;
          await navigate({
            to: "/session/$sessionId/chats",
            params: { sessionId },
            search: { chatId: nextSelected?.chatId },
          });
        }}
        onSendMessage={({ channel, payload }) =>
          controller.sendMessageChannel({
            sessionId,
            chatId: channel.chatId,
            accessToken: channel.accessToken,
            payload,
          })
        }
        onUpdateChannel={async (input) =>
          await controller.updateMessageChannel({
            sessionId,
            chatId: input.channel.chatId,
            accessToken: input.channel.accessToken,
            patch: input.patch,
          })
        }
        onListChannelGrants={async (channel) =>
          await controller.listMessageChannelGrants({
            sessionId,
            chatId: channel.chatId,
            accessToken: channel.accessToken,
          })
        }
        onIssueChannelGrant={async (input) =>
          await controller.issueMessageChannelGrant({
            sessionId,
            chatId: input.channel.chatId,
            accessToken: input.channel.accessToken,
            role: input.role,
            label: input.label,
            participantId: input.participantId,
          })
        }
        onRevokeChannelGrant={async (input) =>
          await controller.revokeMessageChannelGrant({
            sessionId,
            chatId: input.channel.chatId,
            accessToken: input.channel.accessToken,
            grantId: input.grantId,
          })
        }
        onCommand={async (command) => {
          if (command === "/start") {
            await controller.startSession(sessionId);
            return;
          }
          if (command === "/stop") {
            await controller.stopSession(sessionId);
            return;
          }
          if (command === "/compact" && selectedChannel) {
            await controller.sendMessageChannel({
              sessionId,
              chatId: selectedChannel.chatId,
              accessToken: selectedChannel.accessToken,
              payload: { text: "/compact", assets: [] },
            });
          }
        }}
        onSearchPaths={controller.searchWorkspacePaths}
        onLatestVisibleAssistantMessageIdChange={setLatestVisibleMessageId}
        onOpenDevtools={(cycleId) => {
          void navigate({
            to: "/session/$sessionId/devtools",
            params: { sessionId },
            search: buildSessionDevtoolsSearch({
              panel: cycleId ? "cycles" : "attention",
              cycleId,
            }),
          });
        }}
      />
    </WorkspaceShellFrame>
  );
};

const SessionTerminalsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const params = sessionTerminalsRoute.useParams();
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
  const terminalsSurfaceLoading =
    !hasRuntime && session?.status !== "stopped" && session?.status !== "paused" && session?.status !== "error";

  const handleSessionTerminalsNavigate = useCallback(
    (tab: "chat" | "terminals" | "devtools" | "settings") => {
      if (tab === "settings") {
        void navigate({
          to: "/session/$sessionId/settings",
          params: { sessionId },
        });
        return;
      }
      if (tab === "chat") {
        void navigate({
          to: "/session/$sessionId/chats",
          params: { sessionId },
          search: { chatId: undefined },
        });
        return;
      }
      if (tab === "devtools") {
        void navigate({
          to: "/session/$sessionId/devtools",
          params: { sessionId },
          search: buildSessionDevtoolsSearch({ panel: "attention" }),
        });
      }
    },
    [navigate, sessionId],
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

  return (
    <WorkspaceShellFrame
      workspacePath={workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="terminals"
      onNavigate={handleSessionTerminalsNavigate}
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
      <section
        className={cn(surfaceToneClassName("panel"), "grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2.5 p-2.5 md:p-3")}
      >
        {routeNotice ? <NoticeBanner tone={routeNotice.tone}>{routeNotice.message}</NoticeBanner> : null}
        <ViewportMask className="h-full">
          <SessionTerminalsSurface sessionId={sessionId} loading={terminalsSurfaceLoading} />
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
        search: buildSessionDevtoolsSearch(patch, search),
      });
    },
    [navigate, search, sessionId],
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

  const handleSessionDevtoolsNavigate = useCallback(
    (tab: "chat" | "terminals" | "devtools" | "settings") => {
      if (tab === "devtools") {
        return;
      }
      if (tab === "settings") {
        void navigate({
          to: "/session/$sessionId/settings",
          params: { sessionId },
        });
        return;
      }
      if (tab === "terminals") {
        void navigate({
          to: "/session/$sessionId/terminals",
          params: { sessionId },
        });
        return;
      }
      void navigate({
        to: "/session/$sessionId/chats",
        params: { sessionId },
        search: { chatId: undefined },
      });
    },
    [navigate, sessionId],
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
      onNavigate={handleSessionDevtoolsNavigate}
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

const SessionSettingsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const adaptiveViewport = useAdaptiveViewport();
  const params = sessionSettingsRoute.useParams();
  const sessionId = params.sessionId;
  const connected = useRuntimeSelector((state) => state.connected);
  const session = useRuntimeSelector(selectSessionChromeState(sessionId), equalSessionChromeState);
  const workspacePath = session?.cwd ?? "";
  const routeRuntime = useRuntimeSelector(selectChatRuntimeState(sessionId), equalChatRuntimeState);
  const workspace = useRuntimeSelector(selectWorkspaceChromeState(workspacePath), equalWorkspaceChromeState);
  const sessionStatusPill = resolveSessionStatusPillState(session, routeRuntime ?? undefined);
  const ensureSettingsLayers = controller.ensureSettingsLayers;
  const refreshSettingsLayers = controller.refreshSettingsLayers;

  useEffect(() => {
    if (!connected || !workspacePath) {
      return;
    }
    void ensureSettingsLayers(workspacePath);
  }, [connected, ensureSettingsLayers, workspacePath]);
  const handleSessionSettingsNavigate = useCallback(
    (tab: "chat" | "terminals" | "devtools" | "settings") => {
      if (tab === "settings") {
        return;
      }
      if (tab === "terminals") {
        void navigate({
          to: "/session/$sessionId/terminals",
          params: { sessionId },
        });
        return;
      }
      if (tab === "devtools") {
        void navigate({
          to: "/session/$sessionId/devtools",
          params: { sessionId },
          search: buildSessionDevtoolsSearch({ panel: "attention" }),
        });
        return;
      }
      void navigate({
        to: "/session/$sessionId/chats",
        params: { sessionId },
        search: { chatId: undefined },
      });
    },
    [navigate, sessionId],
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

  return (
    <WorkspaceShellFrame
      workspacePath={workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab="settings"
      onNavigate={handleSessionSettingsNavigate}
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
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2.5">
        <ViewportMask className="h-full">
          {workspacePath ? (
            <SettingsPanel
              disabled={!workspacePath}
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
                void refreshSettingsLayers(workspacePath);
              }}
              onLoadLayer={(layerId) => {
                void controller.loadSelectedLayer(workspacePath, layerId);
              }}
              onSaveLayer={() => {
                if (!controller.selectedLayerId) {
                  return;
                }
                void controller.saveSelectedLayer(workspacePath, controller.selectedLayerId);
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
  const profileServiceOrigin = useRuntimeSelector((state) => {
    const endpoint = state.profileService?.endpoint;
    if (!endpoint) {
      return null;
    }
    try {
      return new URL(endpoint).origin;
    } catch {
      return null;
    }
  });
  const adaptiveViewport = useAdaptiveViewport();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("idle");
  const [profileStatus, setProfileStatus] = useState("No stored durable profile auth token.");
  const [effective, setEffective] = useState<SettingsEffectiveGraph>(EMPTY_SETTINGS_EFFECTIVE);
  const [layers, setLayers] = useState<SettingsLayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerDraft, setLayerDraft] = useState("{}\n");
  const [layerMtimeMs, setLayerMtimeMs] = useState(0);
  const [profiles, setProfiles] = useState<DurableProfileItem[]>([]);
  const [activeProfileReference, setActiveProfileReference] = useState("");
  const [selectedProfileReference, setSelectedProfileReference] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileEditorDraft>(createEmptyProfileDraft());
  const [emailDraft, setEmailDraft] = useState("");
  const [verificationCodeDraft, setVerificationCodeDraft] = useState("");
  const [pendingRegistrationTicket, setPendingRegistrationTicket] = useState<string | null>(null);
  const [pendingRegistrationUrl, setPendingRegistrationUrl] = useState<string | null>(null);
  const [profileAuth, setProfileAuth] = useState<StoredProfileAuth>(() => readStoredProfileAuth());
  const pendingRegistrationOrigin = useMemo(() => {
    if (!pendingRegistrationUrl) {
      return null;
    }
    try {
      return new URL(pendingRegistrationUrl).origin;
    } catch {
      return null;
    }
  }, [pendingRegistrationUrl]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.profileId === selectedProfileReference) ?? null,
    [profiles, selectedProfileReference],
  );

  useEffect(() => {
    writeStoredProfileAuth(profileAuth);
  }, [profileAuth]);

  useEffect(() => {
    setProfileDraft(toProfileDraft(selectedProfile));
  }, [selectedProfile]);

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

  const refresh = useCallback(
    async (preferredProfileReference?: string | null) => {
      setLoading(true);
      try {
        const [settingsScope, profileList] = await Promise.all([
          controller.runtimeStore.listScopedSettings({ scope: "global" }),
          controller.runtimeStore.listProfiles(),
        ]);
        const durableProfiles = profileList.items.filter(isDurableProfileItem);
        const effectiveProfileReference = readProfileReference(
          (settingsScope.effective.value as { profileReference?: unknown } | undefined)?.profileReference,
        );

        setEffective(settingsScope.effective);
        setLayers(settingsScope.layers);
        setProfiles(durableProfiles);
        setActiveProfileReference(effectiveProfileReference);

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

        const nextSelectedProfileReference = selectPreferredProfileReference(durableProfiles, {
          preferred: preferredProfileReference ?? selectedProfileReference,
          active: effectiveProfileReference,
          authenticated: profileAuth.profileId,
        });
        setSelectedProfileReference(nextSelectedProfileReference);
        setStatus(`Loaded ${durableProfiles.length} durable profiles`);
      } catch (error) {
        controller.setNotice(String(error instanceof Error ? error.message : error));
        setStatus("load failed");
      } finally {
        setLoading(false);
      }
    },
    [controller, profileAuth.profileId, selectedLayerId, selectedProfileReference],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin &&
        event.origin !== profileServiceOrigin &&
        event.origin !== pendingRegistrationOrigin
      ) {
        return;
      }
      const data = event.data;
      if (!data || typeof data !== "object") {
        return;
      }
      const message = data as { source?: unknown; kind?: unknown; token?: unknown; profileId?: unknown };
      if (message.source !== PROFILE_AUTH_MESSAGE_SOURCE || message.kind !== "auth-success" || typeof message.token !== "string") {
        return;
      }
      const nextAuth: StoredProfileAuth = {
        token: message.token,
        profileId: typeof message.profileId === "string" && message.profileId.trim().length > 0 ? message.profileId : null,
      };
      setProfileAuth(nextAuth);
      setPendingRegistrationTicket(null);
      setPendingRegistrationUrl(null);
      setProfileStatus(nextAuth.profileId ? `Authenticated durable profile ${nextAuth.profileId}.` : "Authenticated durable profile.");
      if (nextAuth.profileId) {
        setSelectedProfileReference(nextAuth.profileId);
        setActiveProfileReference((current) => current || nextAuth.profileId!);
        setLayerDraft((current) => patchActiveProfileReference(current, nextAuth.profileId!));
      }
      void refresh(nextAuth.profileId);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [pendingRegistrationOrigin, profileServiceOrigin, refresh]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    void refresh();
  }, [connected, refresh]);

  return (
    <section className={cn(surfaceToneClassName("panel"), "flex h-full flex-col")}>
      <GlobalSettingsPanel
        loading={loading}
        saving={saving}
        status={status}
        profileStatus={profileStatus}
        detailMode={adaptiveViewport.compact ? "sheet" : "split"}
        effective={effective}
        layers={layers}
        selectedLayerId={selectedLayerId}
        layerContent={layerDraft}
        profiles={profiles}
        activeProfileReference={activeProfileReference}
        selectedProfileReference={selectedProfileReference}
        profileDraft={profileDraft}
        emailDraft={emailDraft}
        verificationCodeDraft={verificationCodeDraft}
        authToken={profileAuth.token}
        authenticatedProfileId={profileAuth.profileId}
        pendingRegistrationTicket={pendingRegistrationTicket}
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
        onSelectProfile={(reference) => {
          setSelectedProfileReference(reference);
        }}
        onSetActiveProfile={(reference) => {
          setActiveProfileReference(reference);
          setLayerDraft((current) => patchActiveProfileReference(current, reference));
        }}
        onProfileDraftChange={setProfileDraft}
        onEmailDraftChange={setEmailDraft}
        onVerificationCodeDraftChange={setVerificationCodeDraft}
        onStartEmailChallenge={async () => {
          const email = emailDraft.trim();
          if (!email) {
            setProfileStatus("Email is required before starting OTP.");
            return;
          }
          const result = await controller.runtimeStore.startProfileEmailChallenge(email);
          setProfileStatus(`OTP issued for ${email}. Check the endpoint log. challenge=${result.challengeId}`);
        }}
        onVerifyEmailChallenge={async () => {
          const email = emailDraft.trim();
          const code = verificationCodeDraft.trim();
          if (!email || !code) {
            setProfileStatus("Email and verification code are required.");
            return;
          }
          const result = await controller.runtimeStore.verifyProfileEmailChallenge({
            email,
            code,
            token: profileAuth.token || undefined,
          });
          const verifiedProfileId = typeof result.profile.profileId === "string" ? result.profile.profileId : null;
          setPendingRegistrationTicket(result.registrationTicket);
          setPendingRegistrationUrl(result.registrationUrl);
          setProfileStatus("Email verified. Open passkey registration to finish durable auth.");
          if (verifiedProfileId) {
            setSelectedProfileReference(verifiedProfileId);
            setActiveProfileReference((current) => current || verifiedProfileId);
            setLayerDraft((current) => patchActiveProfileReference(current, verifiedProfileId));
          }
          await refresh(verifiedProfileId);
          openProfilePopup(result.registrationUrl);
        }}
        onOpenPasskeyRegistration={() => {
          const registrationUrl =
            pendingRegistrationUrl ??
            (pendingRegistrationTicket ? controller.runtimeStore.webauthnRegistrationUrl(pendingRegistrationTicket) : null);
          if (!registrationUrl) {
            setProfileStatus("Profile-service endpoint is not ready yet.");
            return;
          }
          openProfilePopup(registrationUrl);
        }}
        onOpenPasskeyAuthentication={() => {
          if (!selectedProfileReference) {
            return;
          }
          const authenticationUrl = controller.runtimeStore.webauthnAuthenticationUrl(selectedProfileReference);
          if (!authenticationUrl) {
            setProfileStatus("Profile-service endpoint is not ready yet.");
            return;
          }
          openProfilePopup(authenticationUrl);
        }}
        onUploadProfileIcon={async (reference, file) => {
          if (!profileAuth.token || profileAuth.profileId !== reference) {
            setProfileStatus("Authenticate the selected profile before uploading its icon.");
            return;
          }
          await controller.runtimeStore.uploadProfileIcon(reference, profileAuth.token, file);
          setProfileStatus(`Uploaded icon for ${reference}.`);
          await refresh(reference);
        }}
        onSaveProfile={async () => {
          if (!selectedProfile || !profileAuth.token || profileAuth.profileId !== selectedProfile.profileId) {
            setProfileStatus("Authenticate the selected profile before saving metadata.");
            return;
          }
          await controller.runtimeStore.updateProfile({
            reference: selectedProfile.profileId,
            token: profileAuth.token,
            patch: {
              ...(profileDraft.nickname.trim() ? { nickname: profileDraft.nickname.trim() } : {}),
              ...(profileDraft.displayName.trim() ? { displayName: profileDraft.displayName.trim() } : {}),
              ...(profileDraft.phone.trim() ? { phone: profileDraft.phone.trim() } : {}),
              ...(profileDraft.address.trim() ? { address: profileDraft.address.trim() } : {}),
            },
          });
          setProfileStatus(`Saved metadata for ${selectedProfile.profileId}.`);
          await refresh(selectedProfile.profileId);
        }}
        onClearProfileAuth={() => {
          setProfileAuth({ token: "", profileId: null });
          setPendingRegistrationTicket(null);
          setPendingRegistrationUrl(null);
          setProfileStatus("Cleared stored durable profile auth token.");
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

const sessionDevtoolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId/devtools",
  validateSearch: validateSessionDevtoolsSearch,
  component: SessionDevtoolsRouteView,
});

const sessionChatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId/chats",
  validateSearch: validateSessionChatSearch,
  component: SessionChatsRouteView,
});

const sessionTerminalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId/terminals",
  component: SessionTerminalsRouteView,
});

const sessionSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/session/$sessionId/settings",
  component: SessionSettingsRouteView,
});

const routeTree = rootRoute.addChildren([
  quickStartRoute,
  workspacesRoute,
  globalSettingsRoute,
  sessionChatsRoute,
  sessionTerminalsRoute,
  sessionDevtoolsRoute,
  sessionSettingsRoute,
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
