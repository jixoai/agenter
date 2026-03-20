import {
  createAgenterClient,
  createRuntimeStore,
  type DraftResolutionOutput,
  type ModelDebugOutput,
  type WorkspaceSessionCounts,
  type WorkspaceSessionEntry,
  type WorkspaceSessionTab,
} from "@agenter/client-sdk";
import { RouterProvider } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppControllerContext, type AppController, useRuntimeStoreSelector } from "./app-context";
import { TooltipProvider } from "./components/ui/tooltip";
import { type SettingsLayerItem } from "./features/settings/SettingsPanel";
import { deriveWorkspaceSessionPreview, workspaceSessionPreviewEquals } from "./features/workspaces/session-preview";
import { createAppRouter } from "./router";
import { displayNoticeFromError } from "./shared/notice";
import { defaultWsUrl } from "./shared/ws-url";

interface AppProps {
  wsUrl?: string;
}

const EMPTY_WORKSPACE_SESSION_COUNTS: WorkspaceSessionCounts = {
  all: 0,
  running: 0,
  stopped: 0,
  archive: 0,
};

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

export const App = ({ wsUrl = defaultWsUrl() }: AppProps) => {
  const [router] = useState(() => createAppRouter());
  const [notice, setNotice] = useState("");
  const [quickstartWorkspacePath, setQuickstartWorkspacePath] = useState(".");
  const [quickstartDraft, setQuickstartDraft] = useState<DraftResolutionOutput | null>(null);
  const [quickstartDraftLoading, setQuickstartDraftLoading] = useState(false);
  const [quickstartRecentSessions, setQuickstartRecentSessions] = useState<WorkspaceSessionEntry[]>([]);
  const [quickstartBusy, setQuickstartBusy] = useState(false);
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | null>(null);
  const [selectedWorkspaceSessionId, setSelectedWorkspaceSessionId] = useState<string | null>(null);
  const [workspaceSessionsTab, setWorkspaceSessionsTab] = useState<WorkspaceSessionTab>("all");
  const [workspaceSessions, setWorkspaceSessions] = useState<WorkspaceSessionEntry[]>([]);
  const [workspaceSessionCounts, setWorkspaceSessionCounts] =
    useState<WorkspaceSessionCounts>(EMPTY_WORKSPACE_SESSION_COUNTS);
  const [workspaceSessionCursor, setWorkspaceSessionCursor] = useState<number | null>(null);
  const [workspaceSessionsLoading, setWorkspaceSessionsLoading] = useState(false);
  const [workspaceSessionsLoadingMore, setWorkspaceSessionsLoadingMore] = useState(false);
  const [settingsLayers, setSettingsLayers] = useState<SettingsLayerItem[]>([]);
  const [settingsEffective, setSettingsEffective] = useState("{}");
  const [settingsLoading, setSettingsLoading] = useState(false);
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
  const [modelDebugSessionId, setModelDebugSessionId] = useState<string | null>(null);

  const workspaceSessionsRequestRef = useRef(0);
  const modelDebugRequestRef = useRef(0);
  const modelDebugSessionIdRef = useRef<string | null>(null);
  const workspaceSelectionRef = useRef<{ path: string | null; tab: WorkspaceSessionTab } | null>(null);
  const seenNotificationIdsRef = useRef<string[]>([]);

  const client = useMemo(() => createAgenterClient({ wsUrl }), [wsUrl]);
  const store = useMemo(() => createRuntimeStore(client), [client]);
  const runtimeSessions = useRuntimeStoreSelector(store, (state) => state.sessions);
  const runtimeRecentWorkspaces = useRuntimeStoreSelector(store, (state) => state.recentWorkspaces);
  const runtimeWorkspaces = useRuntimeStoreSelector(store, (state) => state.workspaces);

  const setError = useCallback((error: unknown) => {
    setNotice(displayNoticeFromError(error, "Something failed while loading the application."));
  }, []);

  const searchWorkspacePaths = useCallback(
    async (input: { cwd: string; query: string; limit?: number }) => {
      const items = await store.searchWorkspacePaths(input);
      return items.map((item) => ({
        label: item.label,
        path: item.path,
        isDirectory: item.isDirectory,
        ignored: item.ignored,
      }));
    },
    [store],
  );

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

  useEffect(() => {
    void store.connect().catch((error) => {
      setError(error);
    });

    return () => {
      store.disconnect();
    };
  }, [setError, store]);

  useEffect(() => {
    if (runtimeRecentWorkspaces.length === 0) {
      return;
    }
    setQuickstartWorkspacePath((prev) => (prev === "." ? runtimeRecentWorkspaces[0]! : prev));
  }, [runtimeRecentWorkspaces]);

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
          setError(error);
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
  }, [quickstartWorkspacePath, setError, store]);

  useEffect(() => {
    if (!quickstartWorkspacePath || quickstartWorkspacePath === ".") {
      return;
    }
    const relevantChanged = runtimeSessions.some((session) => session.cwd === quickstartWorkspacePath);
    if (!relevantChanged) {
      return;
    }
    void loadQuickstartRecentSessions(quickstartWorkspacePath).catch(() => {
      // keep stale cards until next refresh
    });
  }, [loadQuickstartRecentSessions, quickstartWorkspacePath, runtimeSessions]);

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
    [resetWorkspaceSessionsState, selectedWorkspacePath, setError, store, workspaceSessionsTab],
  );

  useEffect(() => {
    if (selectedWorkspacePath && !runtimeWorkspaces.some((item) => item.path === selectedWorkspacePath)) {
      setSelectedWorkspacePath(null);
      setSelectedWorkspaceSessionId(null);
      resetWorkspaceSessionsState();
    }
  }, [resetWorkspaceSessionsState, runtimeWorkspaces, selectedWorkspacePath]);

  const selectedWorkspaceReloadKey = useMemo(() => {
    if (!selectedWorkspacePath) {
      return null;
    }
    const workspace = runtimeWorkspaces.find((item) => item.path === selectedWorkspacePath);
    if (!workspace) {
      return null;
    }
    return JSON.stringify({
      path: workspace.path,
      missing: workspace.missing,
      counts: workspace.counts,
    });
  }, [runtimeWorkspaces, selectedWorkspacePath]);

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
    selectedWorkspaceReloadKey,
    workspaceSessionsTab,
  ]);

  useEffect(() => {
    return store.subscribe((state) => {
      setWorkspaceSessions((prev) => {
        if (prev.length === 0) {
          return prev;
        }
        let changed = false;
        const next = prev.map((item) => {
          const messages = state.chatsBySession[item.sessionId] ?? [];
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
    });
  }, [store]);

  useEffect(() => {
    return store.subscribe((state) => {
      const previousIds = new Set(seenNotificationIdsRef.current);
      const nextIds = state.notifications.map((item) => item.id);
      const freshItems = state.notifications.filter((item) => !previousIds.has(item.id));
      seenNotificationIdsRef.current = nextIds;
      if (freshItems.length === 0) {
        return;
      }
      if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
        return;
      }
      for (const item of freshItems) {
        new Notification(item.sessionName, {
          body: item.content.slice(0, 160),
        });
      }
    });
  }, [store]);

  const sendSessionChatPayload = useCallback(
    async (sessionId: string, payload: { text: string; assets: File[] }): Promise<void> => {
      const uploaded = payload.assets.length > 0 ? await store.uploadSessionAssets(sessionId, payload.assets) : [];
      await store.sendChat(
        sessionId,
        payload.text,
        uploaded.map((item) => item.assetId),
        uploaded,
      );
      setNotice("");
    },
    [store],
  );

  const createWorkspaceSession = useCallback(
    async (workspacePath: string): Promise<string | null> => {
      try {
        const session = await store.createSession({ cwd: workspacePath, autoStart: true });
        setSelectedWorkspacePath(workspacePath);
        setSelectedWorkspaceSessionId(session.id);
        setQuickstartWorkspacePath(workspacePath);
        await store.listRecentWorkspaces(8);
        await store.listAllWorkspaces();
        await loadQuickstartRecentSessions(workspacePath);
        await store.hydrateSessionHistory(session.id, { messageLimit: 200, cycleLimit: 120 });
        setNotice("");
        return session.id;
      } catch (error) {
        setError(error);
        return null;
      }
    },
    [loadQuickstartRecentSessions, setError, store],
  );

  const quickstartSubmit = useCallback(
    async (payload: { text: string; assets: File[] }): Promise<string | null> => {
      setQuickstartBusy(true);
      try {
        const sessionId = await createWorkspaceSession(quickstartWorkspacePath);
        if (!sessionId) {
          return null;
        }
        await sendSessionChatPayload(sessionId, payload);
        return sessionId;
      } catch (error) {
        setError(error);
        return null;
      } finally {
        setQuickstartBusy(false);
      }
    },
    [createWorkspaceSession, quickstartWorkspacePath, sendSessionChatPayload, setError],
  );

  const enterWorkspace = useCallback(async (): Promise<string | null> => {
    setQuickstartBusy(true);
    try {
      return await createWorkspaceSession(quickstartWorkspacePath);
    } finally {
      setQuickstartBusy(false);
    }
  }, [createWorkspaceSession, quickstartWorkspacePath]);

  const resumeSession = useCallback(
    async (sessionId: string, workspacePath?: string): Promise<void> => {
      try {
        await store.startSession(sessionId);
        if (workspacePath) {
          setSelectedWorkspacePath(workspacePath);
          setQuickstartWorkspacePath(workspacePath);
        }
        setSelectedWorkspaceSessionId(sessionId);
        await store.hydrateSessionHistory(sessionId, { messageLimit: 200, cycleLimit: 120 });
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const startSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.startSession(sessionId);
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const stopSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.stopSession(sessionId);
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.deleteSession(sessionId);
        await store.listAllWorkspaces();
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const sendChat = useCallback(
    async (sessionId: string, payload: { text: string; assets: File[] }): Promise<void> => {
      try {
        await sendSessionChatPayload(sessionId, payload);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [sendSessionChatPayload, setError],
  );

  const loadMoreChatCycles = useCallback(
    async (sessionId: string): Promise<void> => {
      const current = chatPaging[sessionId] ?? { hasMore: true, loading: false };
      if (current.loading || !current.hasMore) {
        return;
      }
      setChatPaging((prev) => ({
        ...prev,
        [sessionId]: { ...(prev[sessionId] ?? { hasMore: true, loading: false }), loading: true },
      }));
      try {
        const output = await store.loadMoreChatCyclesBefore(sessionId, 80);
        setChatPaging((prev) => ({
          ...prev,
          [sessionId]: { hasMore: output.hasMore, loading: false },
        }));
        setNotice("");
      } catch (error) {
        setChatPaging((prev) => ({
          ...prev,
          [sessionId]: { ...(prev[sessionId] ?? { hasMore: true, loading: false }), loading: false },
        }));
        setError(error);
      }
    },
    [chatPaging, setError, store],
  );

  const loadMoreChatMessages = useCallback(
    async (sessionId: string): Promise<void> => {
      const current = chatPaging[sessionId] ?? { hasMore: true, loading: false };
      if (current.loading || !current.hasMore) {
        return;
      }
      setChatPaging((prev) => ({
        ...prev,
        [sessionId]: { ...(prev[sessionId] ?? { hasMore: true, loading: false }), loading: true },
      }));
      try {
        const output = await store.loadMoreChatMessagesBefore(sessionId, 80);
        setChatPaging((prev) => ({
          ...prev,
          [sessionId]: { hasMore: output.hasMore, loading: false },
        }));
        setNotice("");
      } catch (error) {
        setChatPaging((prev) => ({
          ...prev,
          [sessionId]: { ...(prev[sessionId] ?? { hasMore: true, loading: false }), loading: false },
        }));
        setError(error);
      }
    },
    [chatPaging, setError, store],
  );

  const loadMoreTrace = useCallback(
    async (sessionId: string): Promise<void> => {
      const current = tracePaging[sessionId] ?? { hasMore: true, loading: false };
      if (current.loading || !current.hasMore) {
        return;
      }
      setTracePaging((prev) => ({
        ...prev,
        [sessionId]: { ...(prev[sessionId] ?? { hasMore: true, loading: false }), loading: true },
      }));
      try {
        const output = await store.loadMoreLoopbusTimeline(sessionId, 120);
        setTracePaging((prev) => ({
          ...prev,
          [sessionId]: { hasMore: output.hasMore, loading: false },
        }));
        setNotice("");
      } catch (error) {
        setTracePaging((prev) => ({
          ...prev,
          [sessionId]: { ...(prev[sessionId] ?? { hasMore: true, loading: false }), loading: false },
        }));
        setError(error);
      }
    },
    [setError, store, tracePaging],
  );

  const loadMoreModel = useCallback(
    async (sessionId: string): Promise<void> => {
      const current = modelPaging[sessionId] ?? { hasMore: true, loading: false };
      if (current.loading || !current.hasMore) {
        return;
      }
      setModelPaging((prev) => ({
        ...prev,
        [sessionId]: { ...(prev[sessionId] ?? { hasMore: true, loading: false }), loading: true },
      }));
      try {
        const output = await store.loadMoreModelCalls(sessionId, 120);
        setModelPaging((prev) => ({
          ...prev,
          [sessionId]: { hasMore: output.hasMore, loading: false },
        }));
        setNotice("");
      } catch (error) {
        setModelPaging((prev) => ({
          ...prev,
          [sessionId]: { ...(prev[sessionId] ?? { hasMore: true, loading: false }), loading: false },
        }));
        setError(error);
      }
    },
    [modelPaging, setError, store],
  );

  const refreshModelDebug = useCallback(
    async (sessionId: string): Promise<void> => {
      const requestId = ++modelDebugRequestRef.current;
      if (modelDebugSessionIdRef.current !== sessionId) {
        modelDebugSessionIdRef.current = sessionId;
        setModelDebugSessionId(sessionId);
        setModelDebug(null);
      }
      setModelDebugLoading(true);
      setModelDebugError(null);
      try {
        const output = await store.inspectModelDebug(sessionId);
        if (requestId !== modelDebugRequestRef.current) {
          return;
        }
        modelDebugSessionIdRef.current = sessionId;
        setModelDebugSessionId(sessionId);
        setModelDebug(output);
      } catch (error) {
        if (requestId !== modelDebugRequestRef.current) {
          return;
        }
        modelDebugSessionIdRef.current = sessionId;
        setModelDebugSessionId(sessionId);
        setModelDebugError(error instanceof Error ? error.message : String(error));
      } finally {
        if (requestId === modelDebugRequestRef.current) {
          setModelDebugLoading(false);
        }
      }
    },
    [store],
  );

  const toggleWorkspaceFavorite = useCallback(
    async (workspacePath: string): Promise<void> => {
      try {
        await store.toggleWorkspaceFavorite(workspacePath);
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const deleteWorkspace = useCallback(
    async (workspacePath: string): Promise<void> => {
      try {
        await store.removeWorkspace(workspacePath);
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const cleanMissingWorkspaces = useCallback(async (): Promise<void> => {
    try {
      const removed = await store.cleanMissingWorkspaces();
      if (removed.length === 0) {
        setNotice("No missing workspaces found.");
        return;
      }
      if (selectedWorkspacePath && removed.includes(selectedWorkspacePath)) {
        setSelectedWorkspacePath(null);
        setSelectedWorkspaceSessionId(null);
      }
      setNotice(`Removed ${removed.length} missing workspace${removed.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setError(error);
    }
  }, [selectedWorkspacePath, setError, store]);

  const toggleSessionFavorite = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.toggleSessionFavorite(sessionId);
        await reloadWorkspaceSessions({ append: false, cursor: 0 });
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [reloadWorkspaceSessions, setError, store],
  );

  const stopWorkspaceSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.stopSession(sessionId);
        await reloadWorkspaceSessions({ append: false, cursor: 0 });
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [reloadWorkspaceSessions, setError, store],
  );

  const archiveWorkspaceSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.archiveSession(sessionId);
        if (selectedWorkspaceSessionId === sessionId) {
          setSelectedWorkspaceSessionId(null);
        }
        await reloadWorkspaceSessions({ append: false, cursor: 0 });
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [reloadWorkspaceSessions, selectedWorkspaceSessionId, setError, store],
  );

  const restoreWorkspaceSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.restoreSession(sessionId);
        await reloadWorkspaceSessions({ append: false, cursor: 0 });
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [reloadWorkspaceSessions, setError, store],
  );

  const deleteWorkspaceSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.deleteSession(sessionId);
        if (selectedWorkspaceSessionId === sessionId) {
          setSelectedWorkspaceSessionId(null);
        }
        await reloadWorkspaceSessions({ append: false, cursor: 0 });
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [reloadWorkspaceSessions, selectedWorkspaceSessionId, setError, store],
  );

  const loadMoreWorkspaceSessions = useCallback(async (): Promise<void> => {
    if (
      !selectedWorkspacePath ||
      workspaceSessionsLoading ||
      workspaceSessionsLoadingMore ||
      workspaceSessionCursor === null
    ) {
      return;
    }
    await reloadWorkspaceSessions({ append: true, cursor: workspaceSessionCursor, path: selectedWorkspacePath });
  }, [
    reloadWorkspaceSessions,
    selectedWorkspacePath,
    workspaceSessionCursor,
    workspaceSessionsLoading,
    workspaceSessionsLoadingMore,
  ]);

  const refreshSettingsLayers = useCallback(
    async (workspacePath: string): Promise<void> => {
      setSettingsLoading(true);
      try {
        const data = await store.listSettingsLayers(workspacePath);
        setSettingsLayers(data.layers);
        setSettingsEffective(data.effective.content);
        setSelectedLayerId((prev) =>
          data.layers.some((item) => item.layerId === prev) ? prev : (data.layers[0]?.layerId ?? null),
        );
        setSettingsStatus("layers refreshed");
      } catch (error) {
        setError(error);
      } finally {
        setSettingsLoading(false);
      }
    },
    [setError, store],
  );

  const loadSelectedLayer = useCallback(
    async (workspacePath: string, layerId: string): Promise<void> => {
      setSettingsLoading(true);
      try {
        const file = await store.readSettingsLayer(workspacePath, layerId);
        setLayerDraft(file.content);
        setLayerMtimeMs(file.mtimeMs);
        setSettingsStatus(`loaded: ${file.path}`);
      } catch (error) {
        setError(error);
      } finally {
        setSettingsLoading(false);
      }
    },
    [setError, store],
  );

  const saveSelectedLayer = useCallback(
    async (workspacePath: string, layerId: string): Promise<void> => {
      setSettingsLoading(true);
      try {
        const result = await store.saveSettingsLayer({
          workspacePath,
          layerId,
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
        await refreshSettingsLayers(workspacePath);
      } catch (error) {
        setError(error);
      } finally {
        setSettingsLoading(false);
      }
    },
    [layerDraft, layerMtimeMs, refreshSettingsLayers, setError, store],
  );

  const setChatVisibility = useCallback(
    async (input: { sessionId: string; visible: boolean; focused: boolean }): Promise<void> => {
      try {
        await store.setChatVisibility(input);
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const consumeNotifications = useCallback(
    async (input: { sessionId: string; upToMessageId?: string | null }): Promise<void> => {
      try {
        await store.consumeNotifications(input);
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const hydrateSession = useCallback(
    async (sessionId: string): Promise<void> => {
      await store.hydrateSessionHistory(sessionId, { messageLimit: 200, cycleLimit: 120 });
    },
    [store],
  );

  const retainApiCallStream = useCallback((sessionId: string) => store.retainApiCallStream(sessionId), [store]);

  const listDirectories = useCallback(
    async (input?: { path?: string; includeHidden?: boolean }) => await store.listDirectories(input),
    [store],
  );

  const validateDirectory = useCallback(async (path: string) => await store.validateDirectory(path), [store]);

  const controller = useMemo<AppController>(
    () => ({
      runtimeStore: store,
      notice,
      setNotice,
      quickstartWorkspacePath,
      setQuickstartWorkspacePath,
      quickstartDraft,
      quickstartDraftLoading,
      quickstartRecentSessions,
      quickstartBusy,
      selectedWorkspacePath,
      setSelectedWorkspacePath,
      selectedWorkspaceSessionId,
      setSelectedWorkspaceSessionId,
      workspaceSessionsTab,
      setWorkspaceSessionsTab,
      workspaceSessions,
      workspaceSessionCounts,
      workspaceSessionCursor,
      workspaceSessionsLoading,
      workspaceSessionsLoadingMore,
      settingsLayers,
      settingsEffective,
      settingsLoading,
      selectedLayerId,
      setSelectedLayerId,
      layerDraft,
      setLayerDraft,
      settingsStatus,
      modelDebug,
      modelDebugSessionId,
      modelDebugLoading,
      modelDebugError,
      tracePaging,
      modelPaging,
      chatPaging,
      searchWorkspacePaths,
      createWorkspaceSession,
      quickstartSubmit,
      enterWorkspace,
      resumeSession,
      startSession,
      stopSession,
      deleteSession,
      sendChat,
      loadMoreChatMessages,
      loadMoreChatCycles,
      loadMoreTrace,
      loadMoreModel,
      refreshModelDebug,
      toggleWorkspaceFavorite,
      deleteWorkspace,
      cleanMissingWorkspaces,
      toggleSessionFavorite,
      stopWorkspaceSession,
      archiveWorkspaceSession,
      restoreWorkspaceSession,
      deleteWorkspaceSession,
      loadMoreWorkspaceSessions,
      refreshSettingsLayers,
      loadSelectedLayer,
      saveSelectedLayer,
      setChatVisibility,
      consumeNotifications,
      hydrateSession,
      retainApiCallStream,
      listDirectories,
      validateDirectory,
    }),
    [
      archiveWorkspaceSession,
      chatPaging,
      cleanMissingWorkspaces,
      consumeNotifications,
      createWorkspaceSession,
      deleteSession,
      deleteWorkspace,
      deleteWorkspaceSession,
      enterWorkspace,
      hydrateSession,
      layerDraft,
      loadMoreChatCycles,
      loadMoreChatMessages,
      loadMoreModel,
      loadMoreTrace,
      loadMoreWorkspaceSessions,
      loadSelectedLayer,
      listDirectories,
      modelDebug,
      modelDebugError,
      modelDebugLoading,
      modelDebugSessionId,
      modelPaging,
      notice,
      quickstartBusy,
      quickstartDraft,
      quickstartDraftLoading,
      quickstartRecentSessions,
      quickstartSubmit,
      quickstartWorkspacePath,
      refreshModelDebug,
      refreshSettingsLayers,
      retainApiCallStream,
      restoreWorkspaceSession,
      resumeSession,
      saveSelectedLayer,
      searchWorkspacePaths,
      selectedLayerId,
      selectedWorkspacePath,
      selectedWorkspaceSessionId,
      sendChat,
      setChatVisibility,
      settingsEffective,
      settingsLayers,
      settingsLoading,
      settingsStatus,
      startSession,
      stopSession,
      stopWorkspaceSession,
      toggleSessionFavorite,
      toggleWorkspaceFavorite,
      tracePaging,
      store,
      validateDirectory,
      workspaceSessionCounts,
      workspaceSessionCursor,
      workspaceSessions,
      workspaceSessionsLoading,
      workspaceSessionsLoadingMore,
      workspaceSessionsTab,
    ],
  );

  return (
    <TooltipProvider>
      <AppControllerContext.Provider value={controller}>
        <RouterProvider router={router} />
      </AppControllerContext.Provider>
    </TooltipProvider>
  );
};
