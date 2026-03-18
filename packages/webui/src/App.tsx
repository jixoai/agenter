import {
  createAgenterClient,
  createRuntimeStore,
  type DraftResolutionOutput,
  type ModelDebugOutput,
  type RuntimeClientState,
  type SessionEntry,
  type WorkspaceEntry,
  type WorkspaceSessionCounts,
  type WorkspaceSessionEntry,
  type WorkspaceSessionTab,
} from "@agenter/client-sdk";
import { FolderTree, MessageSquare, Settings2, Sparkles, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "./components/ui/button";
import {
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  inlineAffordanceClassName,
} from "./components/ui/inline-affordance";
import { Sheet } from "./components/ui/sheet";
import { Tabs, type TabItem } from "./components/ui/tabs";
import { TooltipProvider } from "./components/ui/tooltip";
import { ChatPanel } from "./features/chat/ChatPanel";
import { LoopBusPanel } from "./features/loopbus/LoopBusPanel";
import { ModelPanel } from "./features/model/ModelPanel";
import { ProcessPanel } from "./features/process/ProcessPanel";
import { QuickStartView } from "./features/quickstart/QuickStartView";
import { CreateSessionDialog } from "./features/sessions/CreateSessionDialog";
import { WorkspacePickerDialog } from "./features/sessions/WorkspacePickerDialog";
import { SettingsPanel, type SettingsLayerItem } from "./features/settings/SettingsPanel";
import { MasterDetailPage } from "./features/shell/master-detail-page";
import { SidebarNav, type NavItem } from "./features/shell/SidebarNav";
import { StatusBar } from "./features/shell/StatusBar";
import { TopToolbar } from "./features/shell/TopToolbar";
import { TasksPanel } from "./features/tasks/TasksPanel";
import { TerminalPanel } from "./features/terminal/TerminalPanel";
import { deriveWorkspaceSessionPreview, workspaceSessionPreviewEquals } from "./features/workspaces/session-preview";
import { WorkspaceSessionsPanel } from "./features/workspaces/WorkspaceSessionsPanel";
import { WorkspacesPanel } from "./features/workspaces/WorkspacesPanel";
import { defaultWsUrl } from "./shared/ws-url";

const initialState: RuntimeClientState = {
  connected: false,
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  chatsBySession: {},
  chatCyclesBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  loopbusStateLogsBySession: {},
  loopbusTracesBySession: {},
  apiCallsBySession: {},
  modelCallsBySession: {},
  apiCallRecordingBySession: {},
};

interface AppProps {
  wsUrl?: string;
}

type MainView = "quickstart" | "chat" | "workspaces" | "settings";
type DetailsTab = "terminal" | "tasks" | "process" | "loopbus" | "model";
type PickerTarget = "create" | "quickstart";

const EMPTY_WORKSPACE_SESSION_COUNTS: WorkspaceSessionCounts = {
  all: 0,
  running: 0,
  stopped: 0,
  archive: 0,
};

const DETAIL_TABS: TabItem[] = [
  { id: "terminal", label: "Terminal" },
  { id: "tasks", label: "Tasks" },
  { id: "process", label: "Process" },
  { id: "loopbus", label: "LoopBus" },
  { id: "model", label: "Model" },
];

const CHAT_DEVTOOLS_SPLIT_STORAGE_KEY = "agenter:webui:chat-devtools-split-percent";
const WORKSPACES_SESSIONS_SPLIT_STORAGE_KEY = "agenter:webui:workspaces-sessions-split-percent";

const workspaceSessionCountsEqual = (left: WorkspaceSessionCounts, right: WorkspaceSessionCounts): boolean => {
  return (
    left.all === right.all &&
    left.running === right.running &&
    left.stopped === right.stopped &&
    left.archive === right.archive
  );
};

const workspaceSessionEntryEquals = (left: WorkspaceSessionEntry, right: WorkspaceSessionEntry): boolean => {
  return (
    left.sessionId === right.sessionId &&
    left.name === right.name &&
    left.status === right.status &&
    left.storageState === right.storageState &&
    left.favorite === right.favorite &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.archivedAt === right.archivedAt &&
    workspaceSessionPreviewEquals(left.preview, right.preview)
  );
};

const workspaceSessionListEquals = (left: WorkspaceSessionEntry[], right: WorkspaceSessionEntry[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => workspaceSessionEntryEquals(entry, right[index]!));
};

const phaseToStatus = (session: SessionEntry | null, runtime?: RuntimeClientState["runtimes"][string]): string => {
  if (!session) {
    return "idle";
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
  if (session.status === "error") {
    return "error";
  }
  if (session.status === "starting") {
    return "starting";
  }
  if (session.status === "stopped") {
    return "stopped";
  }
  if (!runtime) {
    return "syncing";
  }
  return "idle";
};

const sessionShortcutHue = (input: string): number => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) % 360;
  }
  return (hash + 360) % 360;
};

const sessionShortcutLabel = (path: string, fallback = "S"): string => {
  const segments = path.split(/[\/]+/).filter((segment) => segment.length > 0);
  return (segments.at(-1)?.slice(0, 1) ?? fallback).toUpperCase();
};

const compactViewportQuery = "(max-width: 1279px)";
export const App = ({ wsUrl = defaultWsUrl() }: AppProps) => {
  const [runtimeState, setRuntimeState] = useState<RuntimeClientState>(initialState);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>("quickstart");
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("terminal");
  const [desktopDetailsOpen, setDesktopDetailsOpen] = useState(true);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | null>(null);
  const [selectedWorkspaceSessionId, setSelectedWorkspaceSessionId] = useState<string | null>(null);
  const [mobileWorkspaceDetailsOpen, setMobileWorkspaceDetailsOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspacePickerTarget, setWorkspacePickerTarget] = useState<PickerTarget>("create");
  const [createWorkspacePath, setCreateWorkspacePath] = useState(".");
  const [quickstartWorkspacePath, setQuickstartWorkspacePath] = useState(".");
  const [quickstartDraft, setQuickstartDraft] = useState<DraftResolutionOutput | null>(null);
  const [quickstartDraftLoading, setQuickstartDraftLoading] = useState(false);
  const [quickstartRecentSessions, setQuickstartRecentSessions] = useState<WorkspaceSessionEntry[]>([]);
  const [quickstartBusy, setQuickstartBusy] = useState(false);
  const [openedSessionIds, setOpenedSessionIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [workspaceSessionsTab, setWorkspaceSessionsTab] = useState<WorkspaceSessionTab>("all");
  const [workspaceSessions, setWorkspaceSessions] = useState<WorkspaceSessionEntry[]>([]);
  const [workspaceSessionCounts, setWorkspaceSessionCounts] =
    useState<WorkspaceSessionCounts>(EMPTY_WORKSPACE_SESSION_COUNTS);
  const [workspaceSessionCursor, setWorkspaceSessionCursor] = useState<number | null>(null);
  const [workspaceSessionsLoading, setWorkspaceSessionsLoading] = useState(false);
  const [workspaceSessionsLoadingMore, setWorkspaceSessionsLoadingMore] = useState(false);

  const [settingsLayers, setSettingsLayers] = useState<SettingsLayerItem[]>([]);
  const [settingsEffective, setSettingsEffective] = useState("{}");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerDraft, setLayerDraft] = useState("");
  const [layerMtimeMs, setLayerMtimeMs] = useState(0);
  const [settingsStatus, setSettingsStatus] = useState("idle");
  const [tracePaging, setTracePaging] = useState<Record<string, { hasMore: boolean; loading: boolean }>>({});
  const [modelPaging, setModelPaging] = useState<Record<string, { hasMore: boolean; loading: boolean }>>({});
  const [chatPaging, setChatPaging] = useState<Record<string, { hasMore: boolean; loading: boolean }>>({});
  const [modelDebug, setModelDebug] = useState<ModelDebugOutput | null>(null);
  const [modelDebugLoading, setModelDebugLoading] = useState(false);
  const [modelDebugError, setModelDebugError] = useState<string | null>(null);

  const pendingActiveSessionIdRef = useRef<string | null>(null);
  const workspaceSessionsRequestRef = useRef(0);
  const modelDebugRequestRef = useRef(0);
  const workspaceSelectionRef = useRef<{ path: string | null; tab: WorkspaceSessionTab } | null>(null);

  const client = useMemo(() => createAgenterClient({ wsUrl }), [wsUrl]);
  const store = useMemo(() => createRuntimeStore(client), [client]);

  const rememberOpenedSession = useCallback((sessionId: string) => {
    setOpenedSessionIds((current) => [sessionId, ...current.filter((item) => item !== sessionId)].slice(0, 8));
  }, []);

  const loadQuickstartRecentSessions = useCallback(
    async (workspacePath: string) => {
      const output = await store.listWorkspaceSessions({
        path: workspacePath,
        tab: "all",
        limit: 3,
      });
      setQuickstartRecentSessions(output.items.slice(0, 3));
    },
    [store],
  );

  const searchWorkspacePaths = useCallback(
    async (input: { cwd: string; query: string; limit?: number }) => await store.searchWorkspacePaths(input),
    [store],
  );

  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      setRuntimeState({ ...state });
      if (state.recentWorkspaces.length > 0) {
        setQuickstartWorkspacePath((prev) => (prev === "." ? state.recentWorkspaces[0] : prev));
        setCreateWorkspacePath((prev) => (prev === "." ? state.recentWorkspaces[0] : prev));
      }
      setActiveSessionId((prev) => {
        if (prev && pendingActiveSessionIdRef.current === prev) {
          if (state.sessions.some((item) => item.id === prev)) {
            pendingActiveSessionIdRef.current = null;
            return prev;
          }
          return prev;
        }
        if (prev && state.sessions.some((item) => item.id === prev)) {
          return prev;
        }
        return null;
      });
    });

    void store.connect().catch((error) => {
      setNotice(error instanceof Error ? error.message : String(error));
    });

    return () => {
      unsubscribe();
      store.disconnect();
    };
  }, [store]);

  useEffect(() => {
    setOpenedSessionIds((current) =>
      current.filter((sessionId) => runtimeState.sessions.some((session) => session.id === sessionId)),
    );
  }, [runtimeState.sessions]);

  useEffect(() => {
    if (!activeSessionId && mainView === "chat") {
      setMainView("quickstart");
    }
  }, [activeSessionId, mainView]);

  useEffect(() => {
    if (!quickstartWorkspacePath || quickstartWorkspacePath === ".") {
      setQuickstartDraft(null);
      setQuickstartRecentSessions([]);
      return;
    }

    let cancelled = false;
    setQuickstartDraftLoading(true);

    void Promise.all([
      store.resolveDraft({ cwd: quickstartWorkspacePath }).catch((error) => {
        if (!cancelled) {
          setQuickstartDraft(null);
          setNotice(error instanceof Error ? error.message : String(error));
        }
        return null;
      }),
      store
        .listWorkspaceSessions({
          path: quickstartWorkspacePath,
          tab: "all",
          limit: 3,
        })
        .then((output) => output.items.slice(0, 3))
        .catch(() => [] as WorkspaceSessionEntry[]),
    ]).then(([draft, recent]) => {
      if (cancelled) {
        return;
      }
      setQuickstartDraft(draft);
      setQuickstartRecentSessions(recent);
      setQuickstartDraftLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [quickstartWorkspacePath, store]);

  useEffect(() => {
    if (!quickstartWorkspacePath || quickstartWorkspacePath === ".") {
      return;
    }
    const relevantChanged = runtimeState.sessions.some((session) => session.cwd === quickstartWorkspacePath);
    if (!relevantChanged) {
      return;
    }
    void loadQuickstartRecentSessions(quickstartWorkspacePath).catch(() => {
      // quick start keeps stale session cards until the next successful refresh
    });
  }, [loadQuickstartRecentSessions, quickstartWorkspacePath, runtimeState.sessions]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreateDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeSession = useMemo<SessionEntry | null>(() => {
    if (!activeSessionId) {
      return null;
    }
    return runtimeState.sessions.find((item) => item.id === activeSessionId) ?? null;
  }, [activeSessionId, runtimeState.sessions]);

  const selectedWorkspace = useMemo<WorkspaceEntry | null>(() => {
    if (!selectedWorkspacePath) {
      return null;
    }
    return runtimeState.workspaces.find((item) => item.path === selectedWorkspacePath) ?? null;
  }, [runtimeState.workspaces, selectedWorkspacePath]);

  const selectedWorkspaceSessionSignature = useMemo(() => {
    if (!selectedWorkspacePath) {
      return "";
    }
    return runtimeState.sessions
      .filter((item) => item.cwd === selectedWorkspacePath)
      .map((item) => `${item.id}:${item.status}:${item.storageState}`)
      .sort()
      .join("|");
  }, [runtimeState.sessions, selectedWorkspacePath]);

  const messages = activeSessionId ? (runtimeState.chatsBySession[activeSessionId] ?? []) : [];
  const cycles = activeSessionId ? (runtimeState.chatCyclesBySession[activeSessionId] ?? []) : [];
  const tasks = activeSessionId ? (runtimeState.tasksBySession[activeSessionId] ?? []) : [];
  const activeRuntime = activeSessionId ? runtimeState.runtimes[activeSessionId] : undefined;
  const terminalSnapshots = activeSessionId ? runtimeState.terminalSnapshotsBySession[activeSessionId] : undefined;
  const aiStatus = phaseToStatus(activeSession, activeRuntime);
  const loopbusStateLogs = activeSessionId ? (runtimeState.loopbusStateLogsBySession[activeSessionId] ?? []) : [];
  const loopbusTraces = activeSessionId ? (runtimeState.loopbusTracesBySession[activeSessionId] ?? []) : [];
  const modelCalls = activeSessionId ? (runtimeState.modelCallsBySession[activeSessionId] ?? []) : [];
  const apiCalls = activeSessionId ? (runtimeState.apiCallsBySession[activeSessionId] ?? []) : [];
  const latestModelCallId = modelCalls.at(-1)?.id ?? 0;
  const latestApiCallId = apiCalls.at(-1)?.id ?? 0;
  const apiCallRecording = activeSessionId
    ? (runtimeState.apiCallRecordingBySession[activeSessionId] ?? { enabled: false, refCount: 0 })
    : { enabled: false, refCount: 0 };
  const noTerminalHint =
    activeSessionId && activeRuntime && activeRuntime.terminals.length === 0
      ? "No terminal is configured or running for this session. Configure boot terminals in settings or start one manually."
      : null;
  const activeSessionLabel =
    activeSession?.name ?? (activeSessionId ? `Session · ${activeSessionId.slice(0, 8)}` : null);

  const setError = (error: unknown) => {
    setNotice(error instanceof Error ? error.message : String(error));
  };

  const refreshSettingsLayers = async () => {
    if (!activeSessionId) {
      return;
    }
    try {
      const data = await store.listSettingsLayers(activeSessionId);
      setSettingsLayers(data.layers);
      setSettingsEffective(data.effective.content);
      setSelectedLayerId((prev) => prev ?? data.layers[0]?.layerId ?? null);
      setSettingsStatus("layers refreshed");
    } catch (error) {
      setError(error);
    }
  };

  const loadSelectedLayer = async () => {
    if (!activeSessionId || !selectedLayerId) {
      return;
    }
    try {
      const file = await store.readSettingsLayer(activeSessionId, selectedLayerId);
      setLayerDraft(file.content);
      setLayerMtimeMs(file.mtimeMs);
      setSettingsStatus(`loaded: ${file.path}`);
    } catch (error) {
      setError(error);
    }
  };

  const saveSelectedLayer = async () => {
    if (!activeSessionId || !selectedLayerId) {
      return;
    }
    try {
      const result = await store.saveSettingsLayer({
        sessionId: activeSessionId,
        layerId: selectedLayerId,
        content: layerDraft,
        baseMtimeMs: layerMtimeMs,
      });
      if (!result.ok) {
        if (result.reason === "conflict") {
          setLayerDraft(result.latest.content);
          setLayerMtimeMs(result.latest.mtimeMs);
          setSettingsStatus("conflict: reloaded latest layer");
          return;
        }
        setSettingsStatus(result.message);
        return;
      }
      setLayerMtimeMs(result.file.mtimeMs);
      setSettingsEffective(result.effective.content);
      setSettingsStatus(`saved: ${result.file.path}`);
      await refreshSettingsLayers();
    } catch (error) {
      setError(error);
    }
  };

  useEffect(() => {
    if (mainView !== "settings" || !activeSessionId) {
      return;
    }
    void refreshSettingsLayers();
  }, [mainView, activeSessionId]);

  useEffect(() => {
    if (!activeSessionId || (detailsTab !== "loopbus" && detailsTab !== "model")) {
      return;
    }
    const release = store.retainApiCallStream(activeSessionId);
    return () => release();
  }, [activeSessionId, detailsTab, store]);

  useEffect(() => {
    if (!activeSessionId) {
      setModelDebug(null);
      setModelDebugError(null);
      setModelDebugLoading(false);
      return;
    }
    void store.loadChatMessages(activeSessionId, 200);
    void store.loadChatCycles(activeSessionId, 120);
  }, [activeSessionId, store]);

  useEffect(() => {
    if (!activeSessionId || detailsTab !== "model") {
      return;
    }
    void refreshModelDebug(activeSessionId);
  }, [activeSessionId, detailsTab, latestApiCallId, latestModelCallId]);

  const resetWorkspaceSessionsState = useCallback(() => {
    setWorkspaceSessions([]);
    setWorkspaceSessionCounts(EMPTY_WORKSPACE_SESSION_COUNTS);
    setWorkspaceSessionCursor(null);
  }, []);

  const reloadWorkspaceSessions = useCallback(
    async (input?: { cursor?: number; append?: boolean; path?: string; tab?: WorkspaceSessionTab }) => {
      const path = input?.path ?? selectedWorkspacePath;
      const tab = input?.tab ?? workspaceSessionsTab;
      if (!path) {
        resetWorkspaceSessionsState();
        return;
      }

      const requestId = ++workspaceSessionsRequestRef.current;
      const append = input?.append ?? false;
      const cursor = input?.cursor ?? 0;

      if (append) {
        setWorkspaceSessionsLoadingMore(true);
      } else {
        setWorkspaceSessionsLoading(true);
      }

      try {
        const output = await store.listWorkspaceSessions({ path, tab, cursor, limit: 50 });
        if (requestId !== workspaceSessionsRequestRef.current) {
          return;
        }
        setWorkspaceSessions((prev) => {
          if (!append) {
            return workspaceSessionListEquals(prev, output.items) ? prev : output.items;
          }
          const known = new Set(prev.map((item) => item.sessionId));
          const next = [...prev, ...output.items.filter((item) => !known.has(item.sessionId))];
          return workspaceSessionListEquals(prev, next) ? prev : next;
        });
        setWorkspaceSessionCounts((prev) => (workspaceSessionCountsEqual(prev, output.counts) ? prev : output.counts));
        setWorkspaceSessionCursor((prev) => (prev === output.nextCursor ? prev : output.nextCursor));
      } catch (error) {
        if (requestId === workspaceSessionsRequestRef.current) {
          setError(error);
        }
      } finally {
        if (requestId === workspaceSessionsRequestRef.current) {
          setWorkspaceSessionsLoading(false);
          setWorkspaceSessionsLoadingMore(false);
        }
      }
    },
    [resetWorkspaceSessionsState, selectedWorkspacePath, store, workspaceSessionsTab],
  );

  useEffect(() => {
    if (selectedWorkspacePath && !runtimeState.workspaces.some((item) => item.path === selectedWorkspacePath)) {
      setSelectedWorkspacePath(null);
      setSelectedWorkspaceSessionId(null);
      setMobileWorkspaceDetailsOpen(false);
      resetWorkspaceSessionsState();
    }
  }, [resetWorkspaceSessionsState, runtimeState.workspaces, selectedWorkspacePath]);

  useEffect(() => {
    const previous = workspaceSelectionRef.current;
    const selectionChanged = previous?.path !== selectedWorkspacePath || previous?.tab !== workspaceSessionsTab;
    workspaceSelectionRef.current = { path: selectedWorkspacePath, tab: workspaceSessionsTab };
    if (selectionChanged) {
      setSelectedWorkspaceSessionId(null);
    }
    if (!selectedWorkspacePath) {
      resetWorkspaceSessionsState();
      return;
    }
    void reloadWorkspaceSessions({ append: false, cursor: 0, path: selectedWorkspacePath, tab: workspaceSessionsTab });
  }, [
    reloadWorkspaceSessions,
    resetWorkspaceSessionsState,
    selectedWorkspacePath,
    selectedWorkspaceSessionSignature,
    workspaceSessionsTab,
  ]);

  useEffect(() => {
    if (!selectedWorkspace) {
      return;
    }
    setWorkspaceSessionCounts((prev) =>
      workspaceSessionCountsEqual(prev, selectedWorkspace.counts) ? prev : selectedWorkspace.counts,
    );
  }, [selectedWorkspace]);

  useEffect(() => {
    if (workspaceSessions.length === 0) {
      return;
    }
    setWorkspaceSessions((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const messages = runtimeState.chatsBySession[item.sessionId] ?? [];
        if (messages.length === 0) {
          return item;
        }
        const preview = deriveWorkspaceSessionPreview(messages);
        if (workspaceSessionPreviewEquals(item.preview, preview)) {
          return item;
        }
        changed = true;
        return { ...item, preview };
      });
      return changed ? next : prev;
    });
  }, [runtimeState.lastEventId, runtimeState.chatsBySession, workspaceSessions.length]);

  useEffect(() => {
    if (!selectedWorkspaceSessionId) {
      if (activeSessionId && workspaceSessions.some((item) => item.sessionId === activeSessionId)) {
        setSelectedWorkspaceSessionId(activeSessionId);
      }
      return;
    }
    if (!workspaceSessions.some((item) => item.sessionId === selectedWorkspaceSessionId)) {
      setSelectedWorkspaceSessionId(null);
    }
  }, [activeSessionId, selectedWorkspaceSessionId, workspaceSessions]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    setChatPaging((prev) => {
      if (prev[activeSessionId]) {
        return prev;
      }
      return { ...prev, [activeSessionId]: { hasMore: true, loading: false } };
    });
    setTracePaging((prev) => {
      if (prev[activeSessionId]) {
        return prev;
      }
      return { ...prev, [activeSessionId]: { hasMore: true, loading: false } };
    });
    setModelPaging((prev) => {
      if (prev[activeSessionId]) {
        return prev;
      }
      return { ...prev, [activeSessionId]: { hasMore: true, loading: false } };
    });
  }, [activeSessionId]);

  const handleCreateSession = async (input: { cwd: string; name?: string }) => {
    try {
      const session = await store.createSession({ cwd: input.cwd, name: input.name, autoStart: true });
      pendingActiveSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setSelectedWorkspacePath(input.cwd);
      setSelectedWorkspaceSessionId(session.id);
      setMainView("chat");
      rememberOpenedSession(session.id);
      await store.listRecentWorkspaces(8);
      await store.listAllWorkspaces();
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleStart = async () => {
    if (!activeSessionId) {
      return;
    }
    try {
      await store.startSession(activeSessionId);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleStop = async () => {
    if (!activeSessionId) {
      return;
    }
    try {
      await store.stopSession(activeSessionId);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleDelete = async () => {
    if (!activeSessionId) {
      return;
    }
    try {
      await store.deleteSession(activeSessionId);
      await store.listAllWorkspaces();
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const sendSessionChatPayload = async (
    sessionId: string,
    payload: { text: string; images: File[] },
  ): Promise<void> => {
    const uploaded = payload.images.length > 0 ? await store.uploadSessionImages(sessionId, payload.images) : [];
    await store.sendChat(
      sessionId,
      payload.text,
      uploaded.map((item) => item.assetId),
      uploaded,
    );
    setNotice("");
  };

  const handleChatSubmit = async (payload: { text: string; images: File[] }) => {
    if (!activeSessionId) {
      return;
    }
    try {
      await sendSessionChatPayload(activeSessionId, payload);
    } catch (error) {
      setError(error);
      throw error;
    }
  };

  const handleLoadMoreTrace = async () => {
    if (!activeSessionId) {
      return;
    }
    const current = tracePaging[activeSessionId] ?? { hasMore: true, loading: false };
    if (current.loading || !current.hasMore) {
      return;
    }
    setTracePaging((prev) => ({
      ...prev,
      [activeSessionId]: { ...(prev[activeSessionId] ?? { hasMore: true, loading: false }), loading: true },
    }));
    try {
      const output = await store.loadMoreLoopbusTimeline(activeSessionId, 120);
      setTracePaging((prev) => ({
        ...prev,
        [activeSessionId]: { hasMore: output.hasMore, loading: false },
      }));
      setNotice("");
    } catch (error) {
      setTracePaging((prev) => ({
        ...prev,
        [activeSessionId]: { ...(prev[activeSessionId] ?? { hasMore: true, loading: false }), loading: false },
      }));
      setError(error);
    }
  };

  const handleLoadMoreChatCycles = async () => {
    if (!activeSessionId) {
      return;
    }
    const current = chatPaging[activeSessionId] ?? { hasMore: true, loading: false };
    if (current.loading || !current.hasMore) {
      return;
    }
    setChatPaging((prev) => ({
      ...prev,
      [activeSessionId]: { ...(prev[activeSessionId] ?? { hasMore: true, loading: false }), loading: true },
    }));
    try {
      const output = await store.loadMoreChatCyclesBefore(activeSessionId, 80);
      setChatPaging((prev) => ({
        ...prev,
        [activeSessionId]: { hasMore: output.hasMore, loading: false },
      }));
      setNotice("");
    } catch (error) {
      setChatPaging((prev) => ({
        ...prev,
        [activeSessionId]: { ...(prev[activeSessionId] ?? { hasMore: true, loading: false }), loading: false },
      }));
      setError(error);
    }
  };

  const handleLoadMoreModel = async () => {
    if (!activeSessionId) {
      return;
    }
    const current = modelPaging[activeSessionId] ?? { hasMore: true, loading: false };
    if (current.loading || !current.hasMore) {
      return;
    }
    setModelPaging((prev) => ({
      ...prev,
      [activeSessionId]: { ...(prev[activeSessionId] ?? { hasMore: true, loading: false }), loading: true },
    }));
    try {
      const output = await store.loadMoreModelCalls(activeSessionId, 120);
      setModelPaging((prev) => ({
        ...prev,
        [activeSessionId]: { hasMore: output.hasMore, loading: false },
      }));
      setNotice("");
    } catch (error) {
      setModelPaging((prev) => ({
        ...prev,
        [activeSessionId]: { ...(prev[activeSessionId] ?? { hasMore: true, loading: false }), loading: false },
      }));
      setError(error);
    }
  };

  const refreshModelDebug = async (sessionId = activeSessionId) => {
    if (!sessionId) {
      setModelDebug(null);
      setModelDebugError(null);
      return;
    }
    const requestId = ++modelDebugRequestRef.current;
    setModelDebugLoading(true);
    setModelDebugError(null);
    try {
      const output = await store.inspectModelDebug(sessionId);
      if (requestId !== modelDebugRequestRef.current) {
        return;
      }
      setModelDebug(output);
    } catch (error) {
      if (requestId !== modelDebugRequestRef.current) {
        return;
      }
      setModelDebugError(error instanceof Error ? error.message : String(error));
    } finally {
      if (requestId === modelDebugRequestRef.current) {
        setModelDebugLoading(false);
      }
    }
  };

  const handleQuickstartSubmit = async (payload: { text: string; images: File[] }) => {
    setQuickstartBusy(true);
    try {
      const session = await store.createSession({
        cwd: quickstartWorkspacePath,
        autoStart: true,
      });
      pendingActiveSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setSelectedWorkspacePath(quickstartWorkspacePath);
      setSelectedWorkspaceSessionId(session.id);
      setMainView("chat");
      rememberOpenedSession(session.id);
      await sendSessionChatPayload(session.id, payload);
      await store.listRecentWorkspaces(8);
      await store.listAllWorkspaces();
      await loadQuickstartRecentSessions(quickstartWorkspacePath);
    } catch (error) {
      setError(error);
      throw error;
    } finally {
      setQuickstartBusy(false);
    }
  };

  const handleEnterWorkspace = async () => {
    setQuickstartBusy(true);
    try {
      const session = await store.createSession({ cwd: quickstartWorkspacePath, autoStart: true });
      pendingActiveSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setSelectedWorkspacePath(quickstartWorkspacePath);
      setSelectedWorkspaceSessionId(session.id);
      setMainView("chat");
      rememberOpenedSession(session.id);
      await store.listRecentWorkspaces(8);
      await store.listAllWorkspaces();
      await loadQuickstartRecentSessions(quickstartWorkspacePath);
      setNotice("");
    } catch (error) {
      setError(error);
    } finally {
      setQuickstartBusy(false);
    }
  };

  const openWorkspaceSession = async (workspacePath: string) => {
    try {
      const session = await store.createSession({ cwd: workspacePath, autoStart: true });
      pendingActiveSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setSelectedWorkspacePath(workspacePath);
      setSelectedWorkspaceSessionId(session.id);
      setMainView("chat");
      setQuickstartWorkspacePath(workspacePath);
      rememberOpenedSession(session.id);
      await store.listRecentWorkspaces(8);
      await store.listAllWorkspaces();
      await loadQuickstartRecentSessions(workspacePath);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleResumeSession = async (sessionId: string, workspacePath?: string) => {
    try {
      await store.startSession(sessionId);
      setActiveSessionId(sessionId);
      setSelectedWorkspaceSessionId(sessionId);
      if (workspacePath) {
        setSelectedWorkspacePath(workspacePath);
        setQuickstartWorkspacePath(workspacePath);
      }
      setMainView("chat");
      setMobileWorkspaceDetailsOpen(false);
      rememberOpenedSession(sessionId);
      await store.loadChatMessages(sessionId, 200);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleSelectWorkspace = (workspacePath: string | null) => {
    const nextPath = workspacePath === selectedWorkspacePath ? null : workspacePath;
    setSelectedWorkspacePath(nextPath);
    if (!nextPath) {
      setSelectedWorkspaceSessionId(null);
      setMobileWorkspaceDetailsOpen(false);
      return;
    }
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(compactViewportQuery).matches
    ) {
      setMobileWorkspaceDetailsOpen(true);
    }
  };

  const handleActivateWorkspace = (workspacePath: string) => {
    setSelectedWorkspacePath(workspacePath);
    setQuickstartWorkspacePath(workspacePath);
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(compactViewportQuery).matches
    ) {
      setMobileWorkspaceDetailsOpen(true);
    }
  };

  const handleToggleWorkspaceFavorite = async (workspacePath: string) => {
    try {
      await store.toggleWorkspaceFavorite(workspacePath);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleDeleteWorkspace = async (workspacePath: string) => {
    try {
      await store.removeWorkspace(workspacePath);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleCleanMissingWorkspaces = async () => {
    try {
      const removed = await store.cleanMissingWorkspaces();
      if (removed.length === 0) {
        setNotice("No missing workspaces found.");
        return;
      }
      if (selectedWorkspacePath && removed.includes(selectedWorkspacePath)) {
        setSelectedWorkspacePath(null);
        setSelectedWorkspaceSessionId(null);
        setMobileWorkspaceDetailsOpen(false);
      }
      setNotice(`Removed ${removed.length} missing workspace${removed.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setError(error);
    }
  };

  const handleLoadMoreWorkspaceSessions = async () => {
    if (
      !selectedWorkspacePath ||
      workspaceSessionsLoading ||
      workspaceSessionsLoadingMore ||
      workspaceSessionCursor === null
    ) {
      return;
    }
    await reloadWorkspaceSessions({ append: true, cursor: workspaceSessionCursor, path: selectedWorkspacePath });
  };

  const handleToggleSessionFavorite = async (sessionId: string) => {
    try {
      await store.toggleSessionFavorite(sessionId);
      await reloadWorkspaceSessions({ append: false, cursor: 0 });
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleStopWorkspaceSession = async (sessionId: string) => {
    try {
      await store.stopSession(sessionId);
      await reloadWorkspaceSessions({ append: false, cursor: 0 });
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleArchiveWorkspaceSession = async (sessionId: string) => {
    try {
      await store.archiveSession(sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
      if (selectedWorkspaceSessionId === sessionId) {
        setSelectedWorkspaceSessionId(null);
      }
      await reloadWorkspaceSessions({ append: false, cursor: 0 });
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleRestoreWorkspaceSession = async (sessionId: string) => {
    try {
      await store.restoreSession(sessionId);
      await reloadWorkspaceSessions({ append: false, cursor: 0 });
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleDeleteWorkspaceSession = async (sessionId: string) => {
    try {
      await store.deleteSession(sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
      if (selectedWorkspaceSessionId === sessionId) {
        setSelectedWorkspaceSessionId(null);
      }
      await reloadWorkspaceSessions({ append: false, cursor: 0 });
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const renderChatDetails = () => {
    if (detailsTab === "terminal") {
      return <TerminalPanel runtime={activeRuntime} snapshots={terminalSnapshots} />;
    }
    if (detailsTab === "tasks") {
      return <TasksPanel tasks={tasks} compact />;
    }
    if (detailsTab === "process") {
      return <ProcessPanel messages={messages} />;
    }
    if (detailsTab === "model") {
      return (
        <ModelPanel
          debug={modelDebug}
          loading={modelDebugLoading}
          error={modelDebugError}
          onRefresh={() => {
            void refreshModelDebug();
          }}
        />
      );
    }
    return (
      <LoopBusPanel
        stage={activeRuntime?.stage ?? "idle"}
        kernel={activeRuntime?.loopKernelState ?? null}
        inputSignals={
          activeRuntime?.loopInputSignals ?? {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          }
        }
        logs={loopbusStateLogs}
        traces={loopbusTraces}
        modelCalls={modelCalls}
        apiCalls={apiCalls}
        apiRecording={apiCallRecording}
        hasMoreTrace={activeSessionId ? (tracePaging[activeSessionId]?.hasMore ?? true) : false}
        loadingTrace={activeSessionId ? (tracePaging[activeSessionId]?.loading ?? false) : false}
        onLoadMoreTrace={() => void handleLoadMoreTrace()}
        hasMoreModel={activeSessionId ? (modelPaging[activeSessionId]?.hasMore ?? true) : false}
        loadingModel={activeSessionId ? (modelPaging[activeSessionId]?.loading ?? false) : false}
        onLoadMoreModel={() => void handleLoadMoreModel()}
      />
    );
  };

  const renderWorkspaceDetails = () => {
    return (
      <WorkspaceSessionsPanel
        workspace={selectedWorkspace}
        sessions={workspaceSessions}
        counts={workspaceSessionCounts}
        tab={workspaceSessionsTab}
        selectedSessionId={selectedWorkspaceSessionId}
        loading={workspaceSessionsLoading}
        loadingMore={workspaceSessionsLoadingMore}
        hasMore={workspaceSessionCursor !== null}
        onChangeTab={setWorkspaceSessionsTab}
        onSelectSession={(sessionId) => setSelectedWorkspaceSessionId(sessionId)}
        onLoadMore={() => {
          void handleLoadMoreWorkspaceSessions();
        }}
        onCreateSessionInWorkspace={(path) => {
          void openWorkspaceSession(path);
        }}
        onOpenSession={(sessionId) => {
          void handleResumeSession(sessionId, selectedWorkspace?.path);
        }}
        onStopSession={(sessionId) => {
          void handleStopWorkspaceSession(sessionId);
        }}
        onToggleSessionFavorite={(sessionId) => {
          void handleToggleSessionFavorite(sessionId);
        }}
        onArchiveSession={(sessionId) => {
          void handleArchiveWorkspaceSession(sessionId);
        }}
        onRestoreSession={(sessionId) => {
          void handleRestoreWorkspaceSession(sessionId);
        }}
        onDeleteSession={(sessionId) => {
          void handleDeleteWorkspaceSession(sessionId);
        }}
      />
    );
  };

  const renderWorkspacesView = () => {
    return (
      <WorkspacesPanel
        recentPaths={runtimeState.recentWorkspaces}
        workspaces={runtimeState.workspaces}
        selectedPath={selectedWorkspacePath}
        onSelectPath={handleSelectWorkspace}
        onToggleFavorite={(path) => {
          void handleToggleWorkspaceFavorite(path);
        }}
        onActivatePath={handleActivateWorkspace}
        onDeleteWorkspace={(path) => {
          void handleDeleteWorkspace(path);
        }}
        onCreateSessionInWorkspace={(path) => {
          void openWorkspaceSession(path);
        }}
        onCleanMissing={() => {
          void handleCleanMissingWorkspaces();
        }}
      />
    );
  };

  const renderMainView = () => {
    if (mainView === "settings") {
      if (!activeSessionId) {
        return (
          <section className="flex h-full items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Select a session first to inspect settings layers.</p>
          </section>
        );
      }
      return (
        <SettingsPanel
          disabled={!activeSessionId}
          status={settingsStatus}
          effectiveContent={settingsEffective}
          layers={settingsLayers}
          selectedLayerId={selectedLayerId}
          layerContent={layerDraft}
          onSelectLayer={(layerId) => {
            setSelectedLayerId(layerId);
            setLayerDraft("");
            setLayerMtimeMs(0);
          }}
          onLayerContentChange={setLayerDraft}
          onRefreshLayers={() => {
            void refreshSettingsLayers();
          }}
          onLoadLayer={() => {
            void loadSelectedLayer();
          }}
          onSaveLayer={() => {
            void saveSelectedLayer();
          }}
        />
      );
    }

    if (mainView === "quickstart") {
      return (
        <QuickStartView
          workspacePath={quickstartWorkspacePath}
          draftResolution={quickstartDraft}
          recentSessions={quickstartRecentSessions}
          loadingDraft={quickstartDraftLoading}
          starting={quickstartBusy}
          onOpenWorkspacePicker={() => {
            setWorkspacePickerTarget("quickstart");
            setWorkspaceDialogOpen(true);
          }}
          onEnterWorkspace={() => {
            void handleEnterWorkspace();
          }}
          onSubmit={handleQuickstartSubmit}
          onSearchPaths={searchWorkspacePaths}
          onResumeSession={(sessionId) => {
            void handleResumeSession(sessionId, quickstartWorkspacePath);
          }}
        />
      );
    }

    if (mainView === "chat" && !activeSessionId) {
      return (
        <section className="flex h-full items-center justify-center rounded-2xl bg-white p-6 shadow-sm">
          <div className="space-y-3 text-center">
            <h2 className="typo-title-3 text-slate-900">No active chat session</h2>
            <p className="text-sm text-slate-600">
              Open Quick Start to create a session, or resume one from Workspaces.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" onClick={() => setMainView("quickstart")}>
                Quick Start
              </Button>
              <Button variant="outline" onClick={() => setMainView("workspaces")}>
                Workspaces
              </Button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <ChatPanel
        activeSessionName={activeSession?.name ?? activeSessionLabel}
        workspacePath={activeSession?.cwd ?? quickstartWorkspacePath}
        cycles={cycles}
        aiStatus={aiStatus}
        loopPhase={activeRuntime?.loopPhase ?? null}
        noTerminalHint={noTerminalHint}
        disabled={!activeSessionId}
        imageEnabled={activeRuntime?.modelCapabilities.imageInput ?? false}
        hasMore={activeSessionId ? (chatPaging[activeSessionId]?.hasMore ?? true) : false}
        loadingMore={activeSessionId ? (chatPaging[activeSessionId]?.loading ?? false) : false}
        onLoadMore={() => {
          void handleLoadMoreChatCycles();
        }}
        onSubmit={handleChatSubmit}
        onSearchPaths={searchWorkspacePaths}
      />
    );
  };

  const sessionShortcutItems = useMemo<NavItem[]>(() => {
    return openedSessionIds
      .map((sessionId) => runtimeState.sessions.find((item) => item.id === sessionId))
      .filter((item): item is SessionEntry => Boolean(item))
      .map((session) => ({
        key: `session:${session.id}`,
        label: session.name,
        title: `${session.name} · ${session.id}`,
        group: "session" as const,
        avatar: {
          label: sessionShortcutLabel(session.cwd, session.name.slice(0, 1) || "S"),
          hue: sessionShortcutHue(session.cwd),
        },
      }));
  }, [openedSessionIds, runtimeState.sessions]);

  const navItems: NavItem[] = [
    { key: "quickstart", label: "Quick Start", icon: Sparkles, group: "primary" },
    { key: "chat", label: "Chat", icon: MessageSquare, group: "primary" },
    { key: "workspaces", label: "Workspaces", icon: FolderTree, group: "primary" },
    { key: "settings", label: "Settings", icon: Settings2, group: "primary" },
    ...sessionShortcutItems,
  ];

  const activeNavKey = mainView === "chat" && activeSessionId ? `session:${activeSessionId}` : mainView;

  const handleSelectNav = (key: string) => {
    if (key.startsWith("session:")) {
      const sessionId = key.slice("session:".length);
      const target = runtimeState.sessions.find((item) => item.id === sessionId);
      void handleResumeSession(sessionId, target?.cwd);
      return;
    }
    setMainView(key as MainView);
  };

  return (
    <TooltipProvider>
      <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#e2f2ff,#f8fafc_48%)] text-slate-900">
        <TopToolbar
          showMobileDevtools={mainView === "chat" && Boolean(activeSession)}
          activeSessionId={activeSessionId}
          onOpenNavigation={() => setMobileSidebarOpen(true)}
          onOpenDevtools={() => setMobileDetailsOpen(true)}
          onOpenCreate={() => setCreateDialogOpen(true)}
          onOpenWorkspace={() => {
            setWorkspacePickerTarget("quickstart");
            setWorkspaceDialogOpen(true);
          }}
          onStart={() => void handleStart()}
          onStop={() => void handleStop()}
          onDelete={() => void handleDelete()}
        />

        <StatusBar
          notice={notice}
          connected={runtimeState.connected}
          aiStatus={aiStatus}
          activeSessionLabel={activeSessionLabel}
        />

        <div className="mx-auto grid grid-cols-1 md:grid-cols-[56px_1fr]">
          <SidebarNav items={navItems} active={activeNavKey} onSelect={handleSelectNav} />

          <section className="h-[calc(100dvh-92px)] p-3 md:p-4">
            {mainView === "chat" && activeSessionId ? (
              <MasterDetailPage
                main={renderMainView()}
                detail={renderChatDetails()}
                detailTitle="Devtools"
                detailChrome={
                  <Tabs
                    items={DETAIL_TABS}
                    value={detailsTab}
                    onValueChange={(value) => setDetailsTab(value as DetailsTab)}
                    className="w-full"
                  />
                }
                mobileDetailOpen={mobileDetailsOpen}
                onMobileDetailOpenChange={setMobileDetailsOpen}
                desktopDetailVisible={desktopDetailsOpen}
                onDesktopDetailVisibleChange={setDesktopDetailsOpen}
                desktopResizable
                desktopSplitStorageKey={CHAT_DEVTOOLS_SPLIT_STORAGE_KEY}
                defaultDesktopMainWidthPercent={64}
                minDesktopMainWidthPercent={45}
                maxDesktopMainWidthPercent={82}
                hiddenDesktopDetailTrigger={{ label: "Show Devtools", icon: TerminalSquare }}
              />
            ) : mainView === "workspaces" ? (
              <MasterDetailPage
                main={renderWorkspacesView()}
                detail={renderWorkspaceDetails()}
                detailTitle="Sessions"
                mobileDetailOpen={mobileWorkspaceDetailsOpen}
                onMobileDetailOpenChange={setMobileWorkspaceDetailsOpen}
                detailSelectionKey={selectedWorkspaceSessionId}
                autoOpenMobileOnSelection
                desktopResizable
                desktopSplitStorageKey={WORKSPACES_SESSIONS_SPLIT_STORAGE_KEY}
                defaultDesktopMainWidthPercent={58}
                minDesktopMainWidthPercent={40}
                maxDesktopMainWidthPercent={78}
              />
            ) : (
              renderMainView()
            )}
          </section>
        </div>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} side="left" title="Navigation">
          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    handleSelectNav(item.key);
                    setMobileSidebarOpen(false);
                  }}
                  className={inlineAffordanceClassName({
                    size: "control",
                    layout: "leading",
                    fill: true,
                    className: isActive ? "text-sm bg-teal-100 text-teal-900" : "text-sm bg-slate-100 text-slate-700",
                  })}
                >
                  <InlineAffordanceLeadingVisual>
                    {item.avatar ? (
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-md text-[10px] font-semibold"
                        style={{
                          backgroundColor: `oklch(0.84 0.1 ${item.avatar.hue})`,
                          color: `oklch(0.28 0.08 ${item.avatar.hue})`,
                        }}
                      >
                        {item.avatar.label.slice(0, 1).toUpperCase()}
                      </span>
                    ) : Icon ? (
                      <Icon className="h-4 w-4" />
                    ) : null}
                  </InlineAffordanceLeadingVisual>
                  <InlineAffordanceLabel className="truncate">{item.title ?? item.label}</InlineAffordanceLabel>
                </button>
              );
            })}
          </div>
        </Sheet>
        <CreateSessionDialog
          open={createDialogOpen}
          cwd={createWorkspacePath}
          onClose={() => setCreateDialogOpen(false)}
          onOpenWorkspacePicker={() => {
            setWorkspacePickerTarget("create");
            setWorkspaceDialogOpen(true);
          }}
          onCreate={async ({ cwd, name }) => {
            await handleCreateSession({ cwd, name });
          }}
        />

        <WorkspacePickerDialog
          open={workspaceDialogOpen}
          initialPath={workspacePickerTarget === "create" ? createWorkspacePath : quickstartWorkspacePath}
          recentWorkspaces={runtimeState.recentWorkspaces}
          onClose={() => setWorkspaceDialogOpen(false)}
          onPick={(path) => {
            if (workspacePickerTarget === "create") {
              setCreateWorkspacePath(path);
            } else {
              setQuickstartWorkspacePath(path);
              setSelectedWorkspacePath(path);
            }
          }}
          listDirectories={(input) => store.listDirectories(input)}
          validateDirectory={(path) => store.validateDirectory(path)}
        />
      </main>
    </TooltipProvider>
  );
};
