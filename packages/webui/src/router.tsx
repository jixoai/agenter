import type {
  CachedResourceState,
  GlobalRoomActorId,
  GlobalTerminalActorId,
  MessageChannelEntry,
  ProfileListItem,
  RuntimeChatCycle,
  WorkspaceAvatarCatalogEntry,
  WorkspaceEntry,
  WorkspaceWelcomeSnapshotOutput,
} from "@agenter/client-sdk";
import type { WebChatMessage } from "@agenter/web-chat-view";
import { createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppController, useRuntimeSelector, type WorkspaceWelcomeDraft } from "./app-context";
import { NoticeBanner } from "./components/ui/notice-banner";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { ViewportMask } from "./components/ui/overflow-surface";
import { surfaceToneClassName } from "./components/ui/surface";
import { Tabs, type TabItem } from "./components/ui/tabs";
import { AttentionInspectorPanel, type AttentionSourceLink } from "./features/attention/AttentionInspectorPanel";
import {
  buildSessionDevtoolsSearch,
  validateSessionDevtoolsSearch,
  type DevtoolsPanelId,
} from "./features/attention/attention-devtools-route";
import {
  EMPTY_RUNTIME_ATTENTION_STATE,
  type AttentionCommitView,
  type AttentionSelectionState,
} from "./features/attention/attention-view-model";
import { GlobalChatsRoute } from "./features/chat/GlobalChatsRoute";
import { MessageChannelSurface } from "./features/chat/MessageChannelSurface";
import { getCycleStatusMeta as getCycleBadgeStatusMeta } from "./features/chat/cycle-meta";
import { resolveChatRouteNotice, resolveSessionStatusPillState } from "./features/chat/chat-route-status";
import { extractInternalFailureNotice, isInternalFailureMessage } from "./features/chat/internal-system-messages";
import { SystemsPanel } from "./features/devtools/SystemsPanel";
import { ObservabilityPanel } from "./features/devtools/observability/ObservabilityPanel";
import { useIconServiceUrls } from "./features/profile/icon-service";
import { CycleInspectorPanel } from "./features/process/CycleInspectorPanel";
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
import { GlobalTerminalsRoute } from "./features/terminal/GlobalTerminalsRoute";
import { WorkspaceAvatarSurface } from "./features/workspaces/WorkspaceAvatarSurface";
import { WorkspacesCatalogSurface } from "./features/workspaces/WorkspacesCatalogSurface";
import { WorkspaceHistorySurface } from "./features/workspaces/WorkspaceHistorySurface";
import { WorkspaceWelcomeSurface } from "./features/workspaces/WorkspaceWelcomeSurface";
import type {
  WorkspaceDetailTab,
  WorkspaceHistorySortMode,
  WorkspaceMasterSelection,
} from "./features/workspaces/workspace-surface-types";
import { cn } from "./lib/utils";
import { normalizeUserNotice } from "./shared/notice";

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
const GLOBAL_WORKSPACE_PATH = "~/" as const;
const RUNTIME_PANEL_LABELS: Record<DevtoolsPanelId, string> = {
  attention: "Attention",
  cycles: "Cycles",
  systems: "Systems",
  observability: "Observability",
  settings: "Settings",
};
const WORKSPACE_DETAIL_TABS: TabItem[] = [
  { id: "settings", label: "Settings" },
  { id: "avatars", label: "Avatars" },
];
type DurableProfileItem = ProfileListItem & { profileId: string };

type ProfileEditorDraft = {
  nickname: string;
  displayName: string;
  phone: string;
  address: string;
};

const readSearchString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readProfileReference = (value: unknown): string => (typeof value === "string" && value.trim().length > 0 ? value.trim() : "");
const resolveRuntimePanelLabel = (panel: DevtoolsPanelId): string => RUNTIME_PANEL_LABELS[panel] ?? "Attention";
const normalizeWorkspaceDetailTab = (value: unknown): WorkspaceDetailTab => (value === "avatars" ? "avatars" : "settings");
const normalizeWorkspaceHistorySortMode = (value: unknown): WorkspaceHistorySortMode =>
  value === "path" || value === "name" ? value : "recent";
const validateWorkspacesSearch = (search: Record<string, unknown>) => {
  const view = search.view === "history" || search.view === "workspace" ? search.view : "welcome";
  return {
    view,
    workspacePath: readSearchString(search.workspacePath),
    tab: normalizeWorkspaceDetailTab(search.tab),
    sort: normalizeWorkspaceHistorySortMode(search.sort),
  };
};
const buildWorkspacesSearch = (
  patch: Partial<ReturnType<typeof validateWorkspacesSearch>>,
  current?: ReturnType<typeof validateWorkspacesSearch>,
) => {
  const next = {
    view: patch.view ?? current?.view ?? "welcome",
    workspacePath: patch.workspacePath ?? current?.workspacePath,
    tab: patch.tab ?? current?.tab ?? "settings",
    sort: patch.sort ?? current?.sort ?? "recent",
  };
  return {
    view: next.view,
    workspacePath: next.workspacePath,
    tab: next.tab,
    sort: next.sort,
  };
};
const basenameWorkspace = (workspacePath: string): string =>
  workspacePath === GLOBAL_WORKSPACE_PATH
    ? GLOBAL_WORKSPACE_PATH
    : workspacePath.split(/[\\/]+/).filter(Boolean).at(-1) ?? workspacePath;
const resolveKnownWorkspacePath = (workspacePath: string | undefined, workspaces: WorkspaceEntry[]): string => {
  if (workspacePath && workspaces.some((item) => item.path === workspacePath)) {
    return workspacePath;
  }
  return workspaces.find((item) => item.path === GLOBAL_WORKSPACE_PATH)?.path ?? workspaces[0]?.path ?? GLOBAL_WORKSPACE_PATH;
};
const resolveWorkspaceMasterSelection = (
  search: ReturnType<typeof validateWorkspacesSearch>,
  workspaces: WorkspaceEntry[],
): WorkspaceMasterSelection => {
  if (search.view === "history") {
    return { kind: "history" };
  }
  if (search.view === "workspace") {
    return {
      kind: "workspace",
      workspacePath: resolveKnownWorkspacePath(search.workspacePath, workspaces),
    };
  }
  return { kind: "welcome" };
};
const buildWorkspaceSelectionKey = (selection: WorkspaceMasterSelection): string => {
  if (selection.kind === "workspace") {
    return `workspace:${selection.workspacePath}`;
  }
  return selection.kind;
};
const sortHistoryWorkspaces = (
  workspaces: WorkspaceEntry[],
  mode: WorkspaceHistorySortMode,
  recentPaths: string[],
): WorkspaceEntry[] => {
  const recentRanks = new Map(recentPaths.map((path, index) => [path, index] as const));
  return workspaces.slice().sort((left, right) => {
    if (mode === "path") {
      return left.path.localeCompare(right.path);
    }
    if (mode === "name") {
      return basenameWorkspace(left.path).localeCompare(basenameWorkspace(right.path));
    }
    const leftRank = recentRanks.get(left.path);
    const rightRank = recentRanks.get(right.path);
    if (leftRank != null || rightRank != null) {
      if (leftRank == null) {
        return 1;
      }
      if (rightRank == null) {
        return -1;
      }
      return leftRank - rightRank;
    }
    return (right.lastSessionActivityAt ?? "").localeCompare(left.lastSessionActivityAt ?? "");
  });
};
const resolveCycleTabBadgeClassName = (cycle: RuntimeChatCycle | null, active: boolean): string | undefined => {
  if (!cycle) {
    return undefined;
  }
  if (cycle.status === "error") {
    return "bg-rose-500";
  }
  if (cycle.kind === "compact") {
    return active ? "bg-amber-500" : "bg-amber-400";
  }
  const statusMeta = getCycleBadgeStatusMeta(cycle);
  return statusMeta.label === "Done" ? "bg-emerald-500" : "bg-teal-600";
};
const buildRuntimeTabs = (input: {
  activeCycle: RuntimeChatCycle | null;
  latestCycle: RuntimeChatCycle | null;
}): TabItem[] => {
  const cycle = input.activeCycle ?? input.latestCycle;
  return [
    { id: "attention", label: "Attention" },
    {
      id: "cycles",
      label: "Cycles",
      badgeLabel: cycle ? (cycle.cycleId === null ? "P" : String(cycle.cycleId)) : undefined,
      badgeClassName: resolveCycleTabBadgeClassName(cycle, Boolean(input.activeCycle)),
      badgeAnimated: Boolean(input.activeCycle),
    },
    { id: "systems", label: "Systems" },
    { id: "observability", label: "Observability" },
    { id: "settings", label: "Settings" },
  ];
};
const buildWorkspaceWelcomeDraftFromSnapshot = (
  snapshot: WorkspaceWelcomeSnapshotOutput,
): WorkspaceWelcomeDraft => ({
  workspacePath: snapshot.workspacePath,
  avatar: snapshot.avatar,
  selectedRoomIds: snapshot.rooms.filter((room) => room.accessState !== "available").map((room) => room.channel.chatId),
  selectedTerminalIds: snapshot.terminals
    .filter((terminal) => terminal.accessState !== "available")
    .map((terminal) => terminal.terminal.terminalId),
  roomRoles: Object.fromEntries(
    snapshot.rooms.map((room) => [room.channel.chatId, room.seatRole ?? "member"] as const),
  ),
  terminalRoles: Object.fromEntries(
    snapshot.terminals.map((terminal) => [terminal.terminal.terminalId, terminal.seatRole ?? "writer"] as const),
  ),
});
const mergeWorkspaceWelcomeDraft = (
  snapshot: WorkspaceWelcomeSnapshotOutput,
  draft: WorkspaceWelcomeDraft | null,
): WorkspaceWelcomeDraft => {
  const base = buildWorkspaceWelcomeDraftFromSnapshot(snapshot);
  if (!draft) {
    return base;
  }
  const roomIds = new Set(snapshot.rooms.map((room) => room.channel.chatId));
  const terminalIds = new Set(snapshot.terminals.map((terminal) => terminal.terminal.terminalId));
  return {
    workspacePath: snapshot.workspacePath,
    avatar: snapshot.avatar,
    selectedRoomIds: draft.selectedRoomIds.filter((chatId) => roomIds.has(chatId)),
    selectedTerminalIds: draft.selectedTerminalIds.filter((terminalId) => terminalIds.has(terminalId)),
    roomRoles: {
      ...base.roomRoles,
      ...Object.fromEntries(Object.entries(draft.roomRoles).filter(([chatId]) => roomIds.has(chatId))),
    },
    terminalRoles: {
      ...base.terminalRoles,
      ...Object.fromEntries(Object.entries(draft.terminalRoles).filter(([terminalId]) => terminalIds.has(terminalId))),
    },
  };
};

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

const validateSessionChatSearch = (search: Record<string, unknown>) => ({
  chatId: readSearchString(search.chatId),
});
const validateGlobalChatsSearch = (search: Record<string, unknown>) => ({
  chatId: readSearchString(search.chatId),
});
const validateGlobalTerminalsSearch = (search: Record<string, unknown>) => ({
  terminalId: readSearchString(search.terminalId),
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
  const navigate = useNavigate();
  const [availableRoomIds, setAvailableRoomIds] = useState<string[]>([]);
  const [availableTerminalIds, setAvailableTerminalIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [rooms, terminals] = await Promise.all([controller.listGlobalRooms(), controller.listGlobalTerminals()]);
        if (cancelled) {
          return;
        }
        setAvailableRoomIds(rooms.map((room) => room.chatId));
        setAvailableTerminalIds(terminals.map((terminal) => terminal.terminalId));
      } catch {
        if (cancelled) {
          return;
        }
        setAvailableRoomIds([]);
        setAvailableTerminalIds([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [controller]);

  const resolveSourceLink = useCallback(
    (commit: AttentionCommitView) => {
      const systemId = typeof commit.meta.systemId === "string" ? commit.meta.systemId : null;
      const subjectId = typeof commit.meta.subjectId === "string" ? commit.meta.subjectId : null;
      if (!systemId || !subjectId) {
        return null;
      }
      if (systemId === "message") {
        const available = availableRoomIds.includes(subjectId);
        return {
          systemId,
          subjectId,
          label: "Open Room",
          description: available
            ? `Open global room ${subjectId} in Chats.`
            : `Source unavailable: global room ${subjectId} is not present in Chats.`,
          available,
        } satisfies AttentionSourceLink;
      }
      if (systemId === "terminal") {
        const available = availableTerminalIds.includes(subjectId);
        return {
          systemId,
          subjectId,
          label: "Open Terminal",
          description: available
            ? `Open global terminal ${subjectId} in Terminals.`
            : `Source unavailable: global terminal ${subjectId} is not present in Terminals.`,
          available,
        } satisfies AttentionSourceLink;
      }
      return null;
    },
    [availableRoomIds, availableTerminalIds],
  );

  const openSourceLink = useCallback(
    (source: AttentionSourceLink) => {
      if (!source.available) {
        return;
      }
      if (source.systemId === "message") {
        void navigate({
          to: "/chats",
          search: {
            chatId: source.subjectId,
          },
        });
        return;
      }
      if (source.systemId === "terminal") {
        void navigate({
          to: "/terminals",
          search: {
            terminalId: source.subjectId,
          },
        });
      }
    },
    [navigate],
  );

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
      resolveSourceLink={resolveSourceLink}
      onOpenSourceLink={openSourceLink}
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

const HomeRouteView = () => {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({
      to: "/workspaces",
      replace: true,
      search: buildWorkspacesSearch({}),
    });
  }, [navigate]);
  return null;
};

const WorkspacesRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const search = workspacesRoute.useSearch();
  const adaptiveViewport = useAdaptiveViewport();
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
      result[session.workspacePath] = (result[session.workspacePath] ?? 0) + count;
    }
    return result;
  }, [sessions, unreadBySession]);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [welcomeWorkspacePath, setWelcomeWorkspacePath] = useState<string>(
    controller.workspaceWelcomeSelection?.workspacePath ?? controller.selectedWorkspacePath ?? GLOBAL_WORKSPACE_PATH,
  );
  const [welcomeAvatar, setWelcomeAvatar] = useState(() => {
    const avatar = controller.workspaceWelcomeSelection?.avatar?.trim();
    return avatar && avatar.length > 0 ? avatar : "default";
  });
  const [welcomeSnapshot, setWelcomeSnapshot] = useState<WorkspaceWelcomeSnapshotOutput | null>(null);
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [welcomeBusy, setWelcomeBusy] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedTerminalIds, setSelectedTerminalIds] = useState<string[]>([]);
  const [roomRoles, setRoomRoles] = useState<Record<string, "admin" | "member" | "readonly">>({});
  const [terminalRoles, setTerminalRoles] = useState<Record<string, "admin" | "writer" | "requester" | "readonly">>(
    {},
  );
  const [avatarCatalog, setAvatarCatalog] = useState<WorkspaceAvatarCatalogEntry[]>([]);
  const [avatarCatalogLoading, setAvatarCatalogLoading] = useState(false);
  const [selectedAvatarByWorkspace, setSelectedAvatarByWorkspace] = useState<Record<string, string>>({});
  const selection = useMemo(() => resolveWorkspaceMasterSelection(search, workspaces), [search, workspaces]);
  const detailTab = search.tab;
  const historySortMode = search.sort;
  const normalizedWelcomeWorkspacePath = welcomeWorkspacePath.trim().length > 0 ? welcomeWorkspacePath : GLOBAL_WORKSPACE_PATH;
  const normalizedWelcomeAvatar = welcomeAvatar.trim().length > 0 ? welcomeAvatar.trim() : "default";
  const selectedWorkspace =
    selection.kind === "workspace" ? (workspaces.find((item) => item.path === selection.workspacePath) ?? null) : null;
  const selectedWorkspaceAvatar =
    selection.kind === "workspace" ? selectedAvatarByWorkspace[selection.workspacePath] ?? avatarCatalog[0]?.nickname ?? "default" : null;
  const selectedWorkspaceAvatarEntry =
    selection.kind === "workspace"
      ? avatarCatalog.find((avatar) => avatar.nickname === selectedWorkspaceAvatar) ?? null
      : null;
  const historyWorkspaces = useMemo(
    () => sortHistoryWorkspaces(workspaces, historySortMode, recentWorkspaces),
    [historySortMode, recentWorkspaces, workspaces],
  );
  const defaultWelcomeWorkspacePath = useMemo(
    () =>
      resolveKnownWorkspacePath(
        controller.workspaceWelcomeSelection?.workspacePath ?? controller.selectedWorkspacePath ?? undefined,
        workspaces,
      ),
    [controller.selectedWorkspacePath, controller.workspaceWelcomeSelection, workspaces],
  );

  const navigateWorkspaces = useCallback(
    (patch: Partial<ReturnType<typeof validateWorkspacesSearch>>, options?: { replace?: boolean }) => {
      void navigate({
        to: "/workspaces",
        replace: options?.replace,
        search: buildWorkspacesSearch(patch, search),
      });
    },
    [navigate, search],
  );

  const openRuntimeShell = useCallback(
    (sessionId: string) => {
      void navigate({
        to: "/session/$sessionId/devtools",
        params: { sessionId },
        search: buildSessionDevtoolsSearch({ panel: "attention" }),
      });
    },
    [navigate],
  );

  useEffect(() => {
    if (search.view !== "workspace") {
      return;
    }
    const resolvedWorkspacePath = resolveKnownWorkspacePath(search.workspacePath, workspaces);
    if (resolvedWorkspacePath === search.workspacePath) {
      return;
    }
    navigateWorkspaces({ workspacePath: resolvedWorkspacePath }, { replace: true });
  }, [navigateWorkspaces, search.view, search.workspacePath, workspaces]);

  useEffect(() => {
    setWelcomeWorkspacePath((current) => {
      if (workspaces.some((workspace) => workspace.path === current)) {
        return current;
      }
      return defaultWelcomeWorkspacePath;
    });
  }, [defaultWelcomeWorkspacePath, workspaces]);

  useEffect(() => {
    controller.setWorkspaceWelcomeSelection({
      workspacePath: normalizedWelcomeWorkspacePath,
      avatar: normalizedWelcomeAvatar,
    });
  }, [controller, normalizedWelcomeAvatar, normalizedWelcomeWorkspacePath]);

  useEffect(() => {
    if (selection.kind === "workspace") {
      controller.setSelectedWorkspacePath(selection.workspacePath);
    }
  }, [controller, selection]);

  const loadWelcomeSnapshot = useCallback(
    async (draftOverride?: WorkspaceWelcomeDraft | null) => {
      const workspacePath = resolveKnownWorkspacePath(welcomeWorkspacePath, workspaces);
      const avatar = normalizedWelcomeAvatar;
      setWelcomeLoading(true);
      try {
        const snapshot = await controller.inspectWorkspaceWelcome({
          workspacePath,
          avatar,
        });
        setWelcomeSnapshot(snapshot);
        const mergedDraft = mergeWorkspaceWelcomeDraft(
          snapshot,
          draftOverride ?? controller.getWorkspaceWelcomeDraft(workspacePath, avatar),
        );
        setSelectedRoomIds(mergedDraft.selectedRoomIds);
        setSelectedTerminalIds(mergedDraft.selectedTerminalIds);
        setRoomRoles(mergedDraft.roomRoles);
        setTerminalRoles(mergedDraft.terminalRoles);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        controller.setNotice(normalizeUserNotice(message, "Failed to inspect the Welcome workspace."));
      } finally {
        setWelcomeLoading(false);
      }
    },
    [controller, normalizedWelcomeAvatar, welcomeWorkspacePath, workspaces],
  );

  useEffect(() => {
    if (!connected) {
      return;
    }
    void loadWelcomeSnapshot();
  }, [connected, loadWelcomeSnapshot]);

  useEffect(() => {
    if (!welcomeSnapshot) {
      return;
    }
    controller.saveWorkspaceWelcomeDraft({
      workspacePath: welcomeSnapshot.workspacePath,
      avatar: normalizedWelcomeAvatar,
      selectedRoomIds,
      selectedTerminalIds,
      roomRoles,
      terminalRoles,
    });
  }, [
    controller,
    normalizedWelcomeAvatar,
    roomRoles,
    selectedRoomIds,
    selectedTerminalIds,
    terminalRoles,
    welcomeSnapshot,
  ]);

  const refreshAvatarCatalog = useCallback(
    async (workspacePath: string) => {
      setAvatarCatalogLoading(true);
      try {
        const avatars = await controller.listWorkspaceAvatarCatalog(workspacePath);
        setAvatarCatalog(avatars);
        setSelectedAvatarByWorkspace((current) => {
          const existing = current[workspacePath];
          const nextAvatar =
            existing && avatars.some((avatar) => avatar.nickname === existing)
              ? existing
              : (avatars[0]?.nickname ?? "default");
          if (current[workspacePath] === nextAvatar) {
            return current;
          }
          return {
            ...current,
            [workspacePath]: nextAvatar,
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        controller.setNotice(normalizeUserNotice(message, "Failed to load the workspace avatar catalog."));
      } finally {
        setAvatarCatalogLoading(false);
      }
    },
    [controller],
  );

  useEffect(() => {
    if (!connected || selection.kind !== "workspace" || detailTab !== "avatars") {
      return;
    }
    void refreshAvatarCatalog(selection.workspacePath);
  }, [connected, detailTab, refreshAvatarCatalog, selection]);

  useEffect(() => {
    if (!connected || selection.kind !== "workspace") {
      return;
    }
    if (detailTab === "settings") {
      if (selection.workspacePath !== GLOBAL_WORKSPACE_PATH) {
        void controller.ensureSettingsLayers(selection.workspacePath);
      }
      return;
    }
    if (!selectedWorkspaceAvatar) {
      return;
    }
    if (
      selection.workspacePath !== GLOBAL_WORKSPACE_PATH &&
      selectedWorkspaceAvatarEntry?.sourceScope === "global" &&
      !selectedWorkspaceAvatarEntry.workspaceAvailable
    ) {
      return;
    }
    void controller.ensureSettingsLayers(selection.workspacePath, selectedWorkspaceAvatar);
  }, [connected, controller, detailTab, selectedWorkspaceAvatar, selectedWorkspaceAvatarEntry, selection]);

  const startWorkspaceAvatar = useCallback(
    async (workspacePath: string, avatar: string) => {
      const sessionId = await controller.createWorkspaceSession(workspacePath, avatar);
      if (!sessionId) {
        return;
      }
      openRuntimeShell(sessionId);
    },
    [controller, openRuntimeShell],
  );

  const handleStartWelcome = useCallback(async () => {
    const workspacePath = resolveKnownWorkspacePath(welcomeWorkspacePath, workspaces);
    const avatar = normalizedWelcomeAvatar;
    setWelcomeBusy(true);
    try {
      const snapshot =
        welcomeSnapshot && welcomeSnapshot.workspacePath === workspacePath && welcomeSnapshot.avatar === avatar
          ? welcomeSnapshot
          : await controller.inspectWorkspaceWelcome({ workspacePath, avatar });
      if (snapshot !== welcomeSnapshot) {
        setWelcomeSnapshot(snapshot);
      }

      const sessionId = await controller.createWorkspaceSession(workspacePath, avatar);
      if (!sessionId) {
        return;
      }

      const skippedRooms: string[] = [];
      const skippedTerminals: string[] = [];
      const roomParticipantId = `session:${sessionId}` as GlobalRoomActorId;
      const terminalParticipantId = `session:${sessionId}` as GlobalTerminalActorId;

      for (const room of snapshot.rooms.filter((item) => selectedRoomIds.includes(item.channel.chatId))) {
        if (room.accessState === "joined") {
          continue;
        }
        if (!room.canAuthorize || !room.channel.accessToken) {
          skippedRooms.push(room.channel.title || room.channel.chatId);
          continue;
        }
        const grant = await controller.issueGlobalRoomGrant({
          chatId: room.channel.chatId,
          accessToken: room.channel.accessToken,
          role: roomRoles[room.channel.chatId] ?? room.seatRole ?? "member",
          participantId: roomParticipantId,
        });
        await controller.saveWorkspaceAvatarRoomSeat({
          workspacePath,
          avatar,
          chatId: room.channel.chatId,
          accessToken: grant.accessToken,
          accessRole: grant.accessRole,
          state: "active",
        });
      }

      const visibleChannels = await controller.listMessageChannels(sessionId, {
        includeArchived: true,
      });
      const focusableChannels = selectedRoomIds
        .map((chatId) => visibleChannels.find((channel) => channel.chatId === chatId))
        .filter((channel): channel is MessageChannelEntry => channel != null)
        .map((channel) => ({
          chatId: channel.chatId,
          accessToken: channel.accessToken,
        }));
      await controller.focusMessageChannels({
        sessionId,
        op: "replace",
        channels: focusableChannels,
      });

      for (const terminal of snapshot.terminals.filter((item) => selectedTerminalIds.includes(item.terminal.terminalId))) {
        if (terminal.accessState === "joined") {
          continue;
        }
        if (!terminal.canAuthorize) {
          skippedTerminals.push(terminal.terminal.title || terminal.terminal.terminalId);
          continue;
        }
        const grant = await controller.issueGlobalTerminalGrant({
          terminalId: terminal.terminal.terminalId,
          role: terminalRoles[terminal.terminal.terminalId] ?? terminal.seatRole ?? "writer",
          participantId: terminalParticipantId,
        });
        await controller.saveWorkspaceAvatarTerminalSeat({
          workspacePath,
          avatar,
          terminalId: terminal.terminal.terminalId,
          accessToken: grant.accessToken,
          accessRole: grant.role,
          state: "active",
        });
      }

      await controller.focusTerminals({
        sessionId,
        op: "replace",
        terminalIds: selectedTerminalIds,
      });

      const skippedParts = [
        skippedRooms.length > 0 ? `Skipped rooms: ${skippedRooms.join(", ")}` : null,
        skippedTerminals.length > 0 ? `Skipped terminals: ${skippedTerminals.join(", ")}` : null,
      ].filter((value): value is string => value !== null);
      controller.setNotice(skippedParts.join(" · "));
      openRuntimeShell(sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      controller.setNotice(normalizeUserNotice(message, "Failed to start the selected avatar."));
    } finally {
      setWelcomeBusy(false);
    }
  }, [
    controller,
    normalizedWelcomeAvatar,
    openRuntimeShell,
    roomRoles,
    selectedRoomIds,
    selectedTerminalIds,
    terminalRoles,
    welcomeSnapshot,
    welcomeWorkspacePath,
    workspaces,
  ]);

  const detailTitle =
    selection.kind === "welcome"
      ? "Welcome"
      : selection.kind === "history"
        ? "History"
        : basenameWorkspace(selection.workspacePath);

  const workspaceDetailSurface =
    selection.kind === "welcome" ? (
      <WorkspaceWelcomeSurface
        loading={welcomeLoading}
        busy={welcomeBusy}
        workspaces={workspaces}
        workspacePath={welcomeWorkspacePath}
        avatar={normalizedWelcomeAvatar}
        snapshot={welcomeSnapshot}
        selectedRoomIds={selectedRoomIds}
        selectedTerminalIds={selectedTerminalIds}
        roomRoles={roomRoles}
        terminalRoles={terminalRoles}
        onWorkspacePathChange={setWelcomeWorkspacePath}
        onAvatarChange={(avatar) => setWelcomeAvatar(avatar.trim().length > 0 ? avatar.trim() : "default")}
        onToggleRoom={(chatId) => {
          setSelectedRoomIds((current) =>
            current.includes(chatId) ? current.filter((value) => value !== chatId) : [...current, chatId],
          );
        }}
        onToggleTerminal={(terminalId) => {
          setSelectedTerminalIds((current) =>
            current.includes(terminalId) ? current.filter((value) => value !== terminalId) : [...current, terminalId],
          );
        }}
        onRoomRoleChange={(chatId, role) => {
          setRoomRoles((current) => ({
            ...current,
            [chatId]: role,
          }));
        }}
        onTerminalRoleChange={(terminalId, role) => {
          setTerminalRoles((current) => ({
            ...current,
            [terminalId]: role,
          }));
        }}
        onRefresh={() => {
          void loadWelcomeSnapshot({
            workspacePath: welcomeWorkspacePath,
            avatar: normalizedWelcomeAvatar,
            selectedRoomIds,
            selectedTerminalIds,
            roomRoles,
            terminalRoles,
          });
        }}
        onOpenChats={() => {
          void navigate({
            to: "/chats",
            search: {
              chatId: undefined,
            },
          });
        }}
        onOpenTerminals={() => {
          void navigate({
            to: "/terminals",
            search: {
              terminalId: undefined,
            },
          });
        }}
        onStart={() => {
          void handleStartWelcome();
        }}
      />
    ) : selection.kind === "history" ? (
      <WorkspaceHistorySurface
        workspaces={historyWorkspaces}
        unreadByWorkspace={unreadByWorkspace}
        sortMode={historySortMode}
        onSortModeChange={(mode) => navigateWorkspaces({ sort: mode })}
        onOpenWorkspace={(workspacePath) => {
          navigateWorkspaces({
            view: "workspace",
            workspacePath,
            tab: "settings",
          });
        }}
      />
    ) : (
      <section className={cn(surfaceToneClassName("panel"), "grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl p-4 shadow-sm")}>
        <div className="space-y-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="typo-title-3 text-slate-900">{selectedWorkspace?.path ?? selection.workspacePath}</h2>
              <p className="text-xs text-slate-500">
                {selection.workspacePath === GLOBAL_WORKSPACE_PATH
                  ? "The global workspace owns shared settings and the canonical avatar catalog."
                  : "Regular workspaces inherit from the global workspace and can fork avatars into local copies."}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {selectedWorkspace?.missing ? <Badge variant="destructive">missing</Badge> : null}
              <Badge variant="secondary">{selectedWorkspace?.counts.all ?? 0} sessions</Badge>
              <Badge variant="secondary">{selectedWorkspace?.counts.running ?? 0} running</Badge>
            </div>
          </div>
          <Tabs
            items={WORKSPACE_DETAIL_TABS}
            value={detailTab}
            onValueChange={(value) => {
              navigateWorkspaces({
                view: "workspace",
                workspacePath: selection.workspacePath,
                tab: normalizeWorkspaceDetailTab(value),
              });
            }}
          />
        </div>

        <ViewportMask className="h-full pt-3">
          {detailTab === "settings" ? (
            selection.workspacePath === GLOBAL_WORKSPACE_PATH ? (
              <GlobalSettingsRouteView />
            ) : (
              <SettingsPanel
                disabled={false}
                loading={controller.settingsLoading}
                status={controller.settingsStatus}
                title={`Workspace Settings · ${basenameWorkspace(selection.workspacePath)}`}
                description="Workspace settings stay on the same API surface as the global workspace, but resolve with workspace-local layers."
                descriptionHelpId="settings:workspace"
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
                  void controller.refreshSettingsLayers(selection.workspacePath);
                }}
                onLoadLayer={(layerId) => {
                  void controller.loadSelectedLayer(selection.workspacePath, layerId);
                }}
                onSaveLayer={() => {
                  if (!controller.selectedLayerId) {
                    return;
                  }
                  void controller.saveSelectedLayer(selection.workspacePath, controller.selectedLayerId);
                }}
              />
            )
          ) : (
            <WorkspaceAvatarSurface
              workspacePath={selection.workspacePath}
              loading={avatarCatalogLoading}
              avatars={avatarCatalog}
              selectedAvatar={selectedWorkspaceAvatar}
              onSelectAvatar={(avatar) => {
                setSelectedAvatarByWorkspace((current) => ({
                  ...current,
                  [selection.workspacePath]: avatar,
                }));
              }}
              onStartAvatar={(avatar) => {
                void startWorkspaceAvatar(selection.workspacePath, avatar);
              }}
              onForkAvatar={(avatar) => {
                void controller
                  .forkWorkspaceAvatar({
                    workspacePath: selection.workspacePath,
                    avatar,
                  })
                  .then(async () => {
                    setSelectedAvatarByWorkspace((current) => ({
                      ...current,
                      [selection.workspacePath]: avatar,
                    }));
                    await refreshAvatarCatalog(selection.workspacePath);
                    await controller.ensureSettingsLayers(selection.workspacePath, avatar);
                  })
                  .catch((error) => {
                    const message = error instanceof Error ? error.message : String(error);
                    controller.setNotice(normalizeUserNotice(message, "Failed to fork the selected avatar."));
                  });
              }}
              detail={
                selectedWorkspaceAvatarEntry &&
                selection.workspacePath !== GLOBAL_WORKSPACE_PATH &&
                selectedWorkspaceAvatarEntry.sourceScope === "global" &&
                !selectedWorkspaceAvatarEntry.workspaceAvailable ? (
                  <section className={cn(surfaceToneClassName("panel"), "flex h-full flex-col justify-center rounded-2xl p-6 shadow-sm")}>
                    <div className="mx-auto max-w-md space-y-3 text-center">
                      <h3 className="text-base font-semibold text-slate-900">{selectedWorkspaceAvatarEntry.nickname}</h3>
                      <p className="text-sm text-slate-500">
                        This workspace is still reading the global avatar source. Fork a full copy before editing workspace-local
                        settings.
                      </p>
                      <div className="flex justify-center">
                        <Button
                          onClick={() => {
                            void controller
                              .forkWorkspaceAvatar({
                                workspacePath: selection.workspacePath,
                                avatar: selectedWorkspaceAvatarEntry.nickname,
                              })
                              .then(async () => {
                                await refreshAvatarCatalog(selection.workspacePath);
                                await controller.ensureSettingsLayers(selection.workspacePath, selectedWorkspaceAvatarEntry.nickname);
                              })
                              .catch((error) => {
                                const message = error instanceof Error ? error.message : String(error);
                                controller.setNotice(normalizeUserNotice(message, "Failed to fork the selected avatar."));
                              });
                          }}
                        >
                          Fork Avatar Copy
                        </Button>
                      </div>
                    </div>
                  </section>
                ) : (
                  <SettingsPanel
                    disabled={!selectedWorkspaceAvatar}
                    loading={controller.settingsLoading}
                    status={controller.settingsStatus}
                    title={`Avatar Settings · ${selectedWorkspaceAvatar ?? "default"}`}
                    description="Avatar settings flatten avatar-local layers with workspace defaults so one avatar can be inspected or edited at a time."
                    descriptionHelpId="settings:avatar"
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
                      if (!selectedWorkspaceAvatar) {
                        return;
                      }
                      void controller.refreshSettingsLayers(selection.workspacePath, selectedWorkspaceAvatar);
                    }}
                    onLoadLayer={(layerId) => {
                      if (!selectedWorkspaceAvatar) {
                        return;
                      }
                      void controller.loadSelectedLayer(selection.workspacePath, layerId, selectedWorkspaceAvatar);
                    }}
                    onSaveLayer={() => {
                      if (!controller.selectedLayerId || !selectedWorkspaceAvatar) {
                        return;
                      }
                      void controller.saveSelectedLayer(selection.workspacePath, controller.selectedLayerId, selectedWorkspaceAvatar);
                    }}
                  />
                )
              }
            />
          )}
        </ViewportMask>
      </section>
    );

  return (
    <MasterDetailPage
      main={
        <WorkspacesCatalogSurface
          loading={workspacesLoading}
          recentPaths={recentWorkspaces}
          workspaces={workspaces}
          unreadByWorkspace={unreadByWorkspace}
          selection={selection}
          onSelectSelection={(nextSelection) => {
            if (nextSelection.kind === "workspace") {
              navigateWorkspaces({
                view: "workspace",
                workspacePath: nextSelection.workspacePath,
                tab: detailTab,
              });
              return;
            }
            navigateWorkspaces({
              view: nextSelection.kind,
            });
          }}
          onToggleFavorite={(path) => {
            void controller.toggleWorkspaceFavorite(path);
          }}
          onDeleteWorkspace={(path) => {
            void controller.deleteWorkspace(path);
          }}
          onCleanMissing={() => {
            void controller.cleanMissingWorkspaces();
          }}
        />
      }
      detail={workspaceDetailSurface}
      detailTitle={detailTitle}
      mobileDetailOpen={mobileDetailOpen}
      onMobileDetailOpenChange={setMobileDetailOpen}
      detailSelectionKey={buildWorkspaceSelectionKey(selection)}
      autoOpenMobileOnSelection
      desktopResizable
      desktopSplitStorageKey={WORKSPACES_SESSIONS_SPLIT_STORAGE_KEY}
      defaultDesktopMainWidthPercent={58}
      minDesktopMainWidthPercent={40}
      maxDesktopMainWidthPercent={78}
    />
  );
};

const GlobalTerminalsRouteView = () => {
  const search = terminalsRoute.useSearch();
  return <GlobalTerminalsRoute preferredTerminalId={search.terminalId} />;
};

const GlobalChatsRouteView = () => {
  const search = chatsRoute.useSearch();
  return <GlobalChatsRoute preferredRoomId={search.chatId} />;
};

const SessionChatsRouteView = () => {
  const navigate = useNavigate();
  const params = sessionChatsRoute.useParams();
  const sessionId = params.sessionId;
  useEffect(() => {
    void navigate({
      to: "/session/$sessionId/devtools",
      params: { sessionId },
      replace: true,
      search: buildSessionDevtoolsSearch({ panel: "attention" }),
    });
  }, [navigate, sessionId]);

  return null;
};

const SessionTerminalsRouteView = () => {
  const navigate = useNavigate();
  const params = sessionTerminalsRoute.useParams();
  const sessionId = params.sessionId;

  useEffect(() => {
    void navigate({
      to: "/terminals",
      replace: true,
      search: {
        terminalId: undefined,
      },
    });
  }, [navigate, sessionId]);

  return null;
};

const SessionDevtoolsRouteView = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const adaptiveViewport = useAdaptiveViewport();
  const params = sessionDevtoolsRoute.useParams();
  const search = sessionDevtoolsRoute.useSearch();
  const sessionId = params.sessionId;
  const connected = useRuntimeSelector((state) => state.connected);
  const session = useRuntimeSelector(selectSessionChromeState(sessionId), equalSessionChromeState);
  const workspacePath = session?.workspacePath ?? "";
  const workspace = useRuntimeSelector(selectWorkspaceChromeState(workspacePath), equalWorkspaceChromeState);
  const routeRuntime = useRuntimeSelector(selectChatRuntimeState(sessionId), equalChatRuntimeState);
  const cycles = useRuntimeSelector((state) => state.chatCyclesBySession[sessionId] ?? EMPTY_CYCLES);
  const activeCycle = useRuntimeSelector((state) => state.runtimes[sessionId]?.activeCycle ?? null);
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

  const runtimeTabs = useMemo(
    () => buildRuntimeTabs({ activeCycle, latestCycle: cycles[cycles.length - 1] ?? null }),
    [activeCycle, cycles],
  );

  const handleDetailsTabChange = useCallback(
    (value: string) => {
      const panel: DevtoolsPanelId =
        value === "cycles" || value === "systems" || value === "observability" || value === "settings" || value === "attention"
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

  useEffect(() => {
    if (!connected || search.panel !== "settings" || !workspacePath) {
      return;
    }
    void controller.ensureSettingsLayers(workspacePath, session?.avatar);
  }, [connected, controller, search.panel, session?.avatar, workspacePath]);

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
    if (search.panel === "settings") {
      return workspacePath ? (
        <SettingsPanel
          disabled={false}
          loading={controller.settingsLoading}
          status={controller.settingsStatus}
          title={`Avatar Settings · ${session?.avatar ?? "default"}`}
          description="Running-avatar settings flatten avatar-scoped layers and workspace defaults into one runtime-facing editor."
          descriptionHelpId="settings:avatar:runtime"
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
            void controller.refreshSettingsLayers(workspacePath, session?.avatar);
          }}
          onLoadLayer={(layerId) => {
            void controller.loadSelectedLayer(workspacePath, layerId, session?.avatar);
          }}
          onSaveLayer={() => {
            if (!controller.selectedLayerId) {
              return;
            }
            void controller.saveSelectedLayer(workspacePath, controller.selectedLayerId, session?.avatar);
          }}
        />
      ) : (
        <section className={cn(surfaceToneClassName("panel"), "flex h-full items-center justify-center p-6")}>
          <div className="space-y-3 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-amber-600" />
            <p className="text-sm text-slate-600">Choose a workspace before editing settings.</p>
          </div>
        </section>
      );
    }
    return <DevtoolsObservabilitySurface sessionId={sessionId} />;
  };

  return (
    <WorkspaceShellFrame
      locationLabel={resolveRuntimePanelLabel(search.panel)}
      workspacePath={workspacePath}
      workspaceMissing={workspace?.missing ?? false}
      activeTab={search.panel}
      tabs={runtimeTabs}
      onNavigate={handleDetailsTabChange}
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
  const navigate = useNavigate();
  const params = sessionSettingsRoute.useParams();
  const sessionId = params.sessionId;
  useEffect(() => {
      void navigate({
        to: "/session/$sessionId/devtools",
        params: { sessionId },
        replace: true,
        search: buildSessionDevtoolsSearch({ panel: "settings" }),
      });
  }, [navigate, sessionId]);
  return null;
};

const LegacyGlobalSettingsRouteView = () => {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({
      to: "/workspaces",
      replace: true,
      search: buildWorkspacesSearch({
        view: "workspace",
        workspacePath: GLOBAL_WORKSPACE_PATH,
        tab: "settings",
      }),
    });
  }, [navigate]);
  return null;
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
  const [profiles, setProfiles] = useState<DurableProfileItem[]>([]);
  const [activeProfileReference, setActiveProfileReference] = useState("");
  const [selectedProfileReference, setSelectedProfileReference] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileEditorDraft>(createEmptyProfileDraft());

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.profileId === selectedProfileReference) ?? null,
    [profiles, selectedProfileReference],
  );

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
        authenticated: controller.authSession?.profile.profileId ?? null,
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
    [controller, selectedLayerId, selectedProfileReference],
  );

  useEffect(() => {
    if (!connected || !controller.authReady) {
      return;
    }
    void refresh();
  }, [connected, controller.authReady, controller.authSession?.profile.profileId, refresh]);

  return (
    <section className={cn(surfaceToneClassName("panel"), "flex h-full flex-col")}>
      <GlobalSettingsPanel
        loading={loading}
        saving={saving}
        status={status}
        authStatus={controller.authStatus}
        authService={controller.authService}
        authSession={controller.authSession}
        privateKeyDraft={controller.privateKeyDraft}
        detailMode={adaptiveViewport.compact ? "sheet" : "split"}
        effective={effective}
        layers={layers}
        selectedLayerId={selectedLayerId}
        layerContent={layerDraft}
        profiles={profiles}
        activeProfileReference={activeProfileReference}
        selectedProfileReference={selectedProfileReference}
        profileDraft={profileDraft}
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
        onPrivateKeyDraftChange={controller.setPrivateKeyDraft}
        onAuthenticate={async () => {
          try {
            const session = await controller.authenticateWithPrivateKey();
            if (!session) {
              return;
            }
            const profileId = typeof session.profile.profileId === "string" ? session.profile.profileId : null;
            if (profileId) {
              setSelectedProfileReference(profileId);
              setActiveProfileReference((current) => current || profileId);
              setLayerDraft((current) => patchActiveProfileReference(current, profileId));
            }
            await refresh(profileId);
          } catch (error) {
            controller.setNotice(String(error instanceof Error ? error.message : error));
            setStatus("auth failed");
          }
        }}
        onUploadProfileIcon={async (reference, file) => {
          if (!controller.authSession?.token || controller.authSession.profile.profileId !== reference) {
            setStatus("auth required");
            return;
          }
          await controller.runtimeStore.uploadProfileIcon(reference, file);
          setStatus(`Uploaded icon for ${reference}.`);
          await refresh(reference);
        }}
        onSaveProfile={async () => {
          if (
            !selectedProfile ||
            !controller.authSession?.token ||
            controller.authSession.profile.profileId !== selectedProfile.profileId
          ) {
            setStatus("auth required");
            return;
          }
          await controller.runtimeStore.updateProfile({
            reference: selectedProfile.profileId,
            patch: {
              ...(profileDraft.nickname.trim() ? { nickname: profileDraft.nickname.trim() } : {}),
              ...(profileDraft.displayName.trim() ? { displayName: profileDraft.displayName.trim() } : {}),
              ...(profileDraft.phone.trim() ? { phone: profileDraft.phone.trim() } : {}),
              ...(profileDraft.address.trim() ? { address: profileDraft.address.trim() } : {}),
            },
          });
          setStatus(`Saved metadata for ${selectedProfile.profileId}.`);
          await refresh(selectedProfile.profileId);
        }}
        onClearAuthSession={() => {
          void controller.clearAuthSession();
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
  component: HomeRouteView,
});

const chatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chats",
  validateSearch: validateGlobalChatsSearch,
  component: GlobalChatsRouteView,
});

const workspacesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces",
  validateSearch: validateWorkspacesSearch,
  component: WorkspacesRouteView,
});

const terminalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terminals",
  validateSearch: validateGlobalTerminalsSearch,
  component: GlobalTerminalsRouteView,
});

const globalSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: LegacyGlobalSettingsRouteView,
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
  chatsRoute,
  workspacesRoute,
  terminalsRoute,
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
