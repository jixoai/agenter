import {
  createAgenterClient,
  createRuntimeStore,
  type DraftResolutionOutput,
  type WorkspaceSessionCounts,
  type WorkspaceSessionEntry,
  type WorkspaceSessionTab,
} from "@agenter/client-sdk";
import { RouterProvider } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppControllerContext, useRuntimeStoreSelector, type AppController } from "./app-context";
import { TooltipProvider } from "./components/ui/tooltip";
import { rasterizeSessionIconFallback } from "./features/profile/rasterize-session-icon";
import { type SettingsLayerItem } from "./features/settings/SettingsPanel";
import { deriveWorkspaceSessionPreview, workspaceSessionPreviewEquals } from "./features/workspaces/session-preview";
import { createAppRouter } from "./router";
import {
  DEFAULT_LONG_LIST_PAGING_STATE,
  resolveLongListPagingKey,
  type LongListPagingInput,
  type LongListPagingState,
} from "./shared/long-list-paging";
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
  const [longListPagingByKey, setLongListPagingByKey] = useState<Record<string, LongListPagingState>>({});
  const workspaceSessionsRequestRef = useRef(0);
  const workspaceSelectionRef = useRef<{ path: string | null; tab: WorkspaceSessionTab } | null>(null);
  const quickstartRecentSessionsSyncKeyRef = useRef<string | null>(null);
  const seenNotificationIdsRef = useRef<string[]>([]);
  const rasterizedSessionIconIdsRef = useRef(new Set<string>());
  const longListPagingByKeyRef = useRef<Record<string, LongListPagingState>>({});
  const settingsCatalogWorkspaceRef = useRef<string | null>(null);
  const settingsCatalogLoadedRef = useRef(false);

  const client = useMemo(() => createAgenterClient({ wsUrl }), [wsUrl]);
  const store = useMemo(() => createRuntimeStore(client), [client]);
  const storeLifecycleRef = useRef<{ store: typeof store; mounts: number } | null>(null);
  const runtimeSessions = useRuntimeStoreSelector(store, (state) => state.sessions);
  const runtimeRecentWorkspaces = useRuntimeStoreSelector(store, (state) => state.recentWorkspaces);
  const runtimeWorkspaces = useRuntimeStoreSelector(store, (state) => state.workspaces);

  const setError = useCallback((error: unknown) => {
    setNotice(displayNoticeFromError(error, "Something failed while loading the application."));
  }, []);

  useEffect(() => {
    longListPagingByKeyRef.current = longListPagingByKey;
  }, [longListPagingByKey]);

  const patchLongListPagingState = useCallback((input: LongListPagingInput, patch: Partial<LongListPagingState>) => {
    const key = resolveLongListPagingKey(input);
    setLongListPagingByKey((prev) => {
      const current = prev[key] ?? DEFAULT_LONG_LIST_PAGING_STATE;
      const next = { ...current, ...patch };
      if (
        current.hydrated === next.hydrated &&
        current.hasMore === next.hasMore &&
        current.loading === next.loading &&
        current.loadingOlder === next.loadingOlder
      ) {
        return prev;
      }
      return {
        ...prev,
        [key]: next,
      };
    });
  }, []);

  const getLongListPagingState = useCallback((input: LongListPagingInput): LongListPagingState => {
    return longListPagingByKeyRef.current[resolveLongListPagingKey(input)] ?? DEFAULT_LONG_LIST_PAGING_STATE;
  }, []);

  const runLongListLoad = useCallback(
    async (
      input: LongListPagingInput & {
        older?: boolean;
        run: () => Promise<{ hasMore: boolean }>;
      },
    ): Promise<void> => {
      const current = getLongListPagingState(input);
      if (input.older) {
        if (current.loadingOlder || !current.hasMore) {
          return;
        }
      } else if (current.loading) {
        return;
      }

      patchLongListPagingState(input, {
        loading: input.older ? current.loading : true,
        loadingOlder: input.older ? true : current.loadingOlder,
      });

      try {
        const output = await input.run();
        patchLongListPagingState(input, {
          hydrated: true,
          hasMore: output.hasMore,
          loading: false,
          loadingOlder: false,
        });
        setNotice("");
      } catch (error) {
        patchLongListPagingState(input, {
          loading: false,
          loadingOlder: false,
        });
        setError(error);
      }
    },
    [getLongListPagingState, patchLongListPagingState, setError],
  );

  const primeRuntimeLongLists = useCallback(
    (sessionId: string) => {
      const state = store.getState();
      patchLongListPagingState(
        { resource: "observability-trace", sessionId },
        {
          hydrated: true,
          hasMore: (state.observabilityTracesBySession[sessionId]?.length ?? 0) >= 200,
        },
      );
      patchLongListPagingState(
        { resource: "model-calls", sessionId },
        {
          hydrated: true,
          hasMore: (state.modelCallsBySession[sessionId]?.length ?? 0) >= 200,
        },
      );
      patchLongListPagingState(
        { resource: "api-calls", sessionId },
        {
          hydrated: true,
          hasMore: (state.apiCallsBySession[sessionId]?.length ?? 0) >= 200,
        },
      );
    },
    [patchLongListPagingState, store],
  );

  const hydrateSessionLongLists = useCallback(
    async (sessionId: string): Promise<void> => {
      patchLongListPagingState({ resource: "chat", sessionId }, { loading: true, hydrated: false });
      patchLongListPagingState({ resource: "cycles", sessionId }, { loading: true, hydrated: false });
      const output = await store.hydrateSessionHistory(sessionId, { messageLimit: 200, cycleLimit: 120 });
      patchLongListPagingState(
        { resource: "chat", sessionId },
        {
          hydrated: true,
          hasMore: output.messagesHasMore,
          loading: false,
          loadingOlder: false,
        },
      );
      patchLongListPagingState(
        { resource: "cycles", sessionId },
        {
          hydrated: true,
          hasMore: output.cyclesHasMore,
          loading: false,
          loadingOlder: false,
        },
      );
      primeRuntimeLongLists(sessionId);
    },
    [patchLongListPagingState, primeRuntimeLongLists, store],
  );

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

  const quickstartRecentSessionStructureKey = useMemo(() => {
    if (!quickstartWorkspacePath || quickstartWorkspacePath === ".") {
      return null;
    }
    return runtimeSessions
      .filter((session) => session.cwd === quickstartWorkspacePath)
      .map((session) =>
        [
          session.id,
          session.cwd,
          session.name,
          session.avatar,
          session.status,
          session.storageState,
          session.createdAt,
        ].join(":"),
      )
      .sort()
      .join("|");
  }, [quickstartWorkspacePath, runtimeSessions]);

  useEffect(() => {
    if (!storeLifecycleRef.current || storeLifecycleRef.current.store !== store) {
      storeLifecycleRef.current?.store.disconnect();
      storeLifecycleRef.current = { store, mounts: 0 };
    }
    const lifecycle = storeLifecycleRef.current;
    lifecycle.mounts += 1;

    void store.connect().catch((error) => {
      setError(error);
    });

    return () => {
      const current = storeLifecycleRef.current;
      if (!current || current.store !== store) {
        store.disconnect();
        return;
      }
      current.mounts = Math.max(0, current.mounts - 1);
      queueMicrotask(() => {
        const latest = storeLifecycleRef.current;
        if (!latest || latest.store !== store) {
          store.disconnect();
          return;
        }
        if (latest.mounts === 0) {
          latest.store.disconnect();
        }
      });
    };
  }, [setError, store]);

  useEffect(() => {
    const fallbackWorkspace =
      runtimeRecentWorkspaces[0] ??
      runtimeWorkspaces.find((workspace) => !workspace.missing)?.path ??
      runtimeWorkspaces[0]?.path;
    if (!fallbackWorkspace) {
      return;
    }
    setQuickstartWorkspacePath((prev) => (prev === "." ? fallbackWorkspace : prev));
  }, [runtimeRecentWorkspaces, runtimeWorkspaces]);

  useEffect(() => {
    const pending = runtimeSessions.filter(
      (session) =>
        (session.status === "running" || session.status === "starting") &&
        !rasterizedSessionIconIdsRef.current.has(session.id),
    );
    if (pending.length === 0) {
      return;
    }
    for (const session of pending) {
      rasterizedSessionIconIdsRef.current.add(session.id);
      void rasterizeSessionIconFallback({
        iconUrl: store.sessionIconUrl(session.id),
      })
        .then((file) => {
          if (!file) {
            return;
          }
          return store.uploadSessionIcon(session.id, file);
        })
        .catch(() => {
          rasterizedSessionIconIdsRef.current.delete(session.id);
        });
    }
  }, [runtimeSessions, store]);

  useEffect(() => {
    if (!quickstartWorkspacePath || quickstartWorkspacePath === ".") {
      setQuickstartDraft(null);
      setQuickstartRecentSessions([]);
      quickstartRecentSessionsSyncKeyRef.current = null;
      return;
    }

    let cancelled = false;
    quickstartRecentSessionsSyncKeyRef.current = null;
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
    if (!quickstartWorkspacePath || quickstartWorkspacePath === "." || quickstartRecentSessionStructureKey === null) {
      return;
    }
    const nextSyncKey = `${quickstartWorkspacePath}::${quickstartRecentSessionStructureKey}`;
    if (quickstartRecentSessionsSyncKeyRef.current === null) {
      quickstartRecentSessionsSyncKeyRef.current = nextSyncKey;
      return;
    }
    if (quickstartRecentSessionsSyncKeyRef.current === nextSyncKey) {
      return;
    }
    quickstartRecentSessionsSyncKeyRef.current = nextSyncKey;
    void loadQuickstartRecentSessions(quickstartWorkspacePath).catch(() => {
      // keep stale cards until next refresh
    });
  }, [loadQuickstartRecentSessions, quickstartRecentSessionStructureKey, quickstartWorkspacePath]);

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

  const sendChannelMessagePayload = useCallback(
    async (input: {
      sessionId: string;
      chatId: string;
      accessToken: string;
      payload: { text: string; assets: File[] };
    }): Promise<void> => {
      const uploaded =
        input.payload.assets.length > 0 ? await store.uploadSessionAssets(input.sessionId, input.payload.assets) : [];
      await store.sendMessageChannel(
        {
          sessionId: input.sessionId,
          chatId: input.chatId,
          accessToken: input.accessToken,
          text: input.payload.text,
          assetIds: uploaded.map((item) => item.assetId),
        },
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
        primeRuntimeLongLists(session.id);
        setNotice("");
        return session.id;
      } catch (error) {
        setError(error);
        return null;
      }
    },
    [loadQuickstartRecentSessions, primeRuntimeLongLists, setError, store],
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
        primeRuntimeLongLists(sessionId);
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [primeRuntimeLongLists, setError, store],
  );

  const startSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.startSession(sessionId);
        primeRuntimeLongLists(sessionId);
        setNotice("");
      } catch (error) {
        setError(error);
      }
    },
    [primeRuntimeLongLists, setError, store],
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

  const abortSession = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.abortSession(sessionId);
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

  const ensureMessageChannels = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await store.ensureMessageChannels(sessionId);
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const listMessageChannels = useCallback(
    async (sessionId: string) => {
      try {
        return await store.listMessageChannels(sessionId);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [setError, store],
  );

  const createMessageChannel = useCallback(
    async (input: { sessionId: string; kind: "direct" | "room"; title?: string; focus?: boolean }) => {
      try {
        return await store.createMessageChannel(input);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [setError, store],
  );

  const focusMessageChannels = useCallback(
    async (input: {
      sessionId: string;
      op: "add" | "remove" | "replace" | "clear";
      channels: Array<{ chatId: string; accessToken: string }>;
    }) => {
      try {
        return await store.focusMessageChannels(input);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [setError, store],
  );

  const sendMessageChannel = useCallback(
    async (input: {
      sessionId: string;
      chatId: string;
      accessToken: string;
      payload: { text: string; assets: File[] };
    }): Promise<void> => {
      try {
        await sendChannelMessagePayload(input);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [sendChannelMessagePayload, setError],
  );

  const updateMessageChannel = useCallback(
    async (input: {
      sessionId: string;
      chatId: string;
      accessToken: string;
      patch: {
        title?: string;
        participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
        metadata?: Record<string, unknown>;
      };
    }) => {
      try {
        return await store.updateMessageChannel(input);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [setError, store],
  );

  const listMessageChannelGrants = useCallback(
    async (input: { sessionId: string; chatId: string; accessToken: string }) => {
      try {
        return await store.listMessageChannelGrants(input);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [setError, store],
  );

  const issueMessageChannelGrant = useCallback(
    async (input: {
      sessionId: string;
      chatId: string;
      accessToken: string;
      role: "admin" | "member" | "readonly";
      label?: string;
      participantId?: string;
    }) => {
      try {
        return await store.issueMessageChannelGrant(input);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [setError, store],
  );

  const revokeMessageChannelGrant = useCallback(
    async (input: { sessionId: string; chatId: string; accessToken: string; grantId: string }) => {
      try {
        return await store.revokeMessageChannelGrant(input);
      } catch (error) {
        setError(error);
        throw error;
      }
    },
    [setError, store],
  );

  const loadMoreChatCycles = useCallback(
    async (sessionId: string): Promise<void> => {
      await runLongListLoad({
        resource: "cycles",
        sessionId,
        older: true,
        run: () => store.loadMoreChatCyclesBefore(sessionId, 80),
      });
    },
    [runLongListLoad, store],
  );

  const loadMoreChatMessages = useCallback(
    async (sessionId: string): Promise<void> => {
      await runLongListLoad({
        resource: "chat",
        sessionId,
        older: true,
        run: () => store.loadMoreChatMessagesBefore(sessionId, 80),
      });
    },
    [runLongListLoad, store],
  );

  const loadMoreTrace = useCallback(
    async (sessionId: string): Promise<void> => {
      await runLongListLoad({
        resource: "observability-trace",
        sessionId,
        older: true,
        run: async () => {
          const output = await store.loadMoreObservabilityTimeline(sessionId, 120);
          return { hasMore: output.hasMore };
        },
      });
    },
    [runLongListLoad, store],
  );

  const loadMoreModel = useCallback(
    async (sessionId: string): Promise<void> => {
      await runLongListLoad({
        resource: "model-calls",
        sessionId,
        older: true,
        run: () => store.loadMoreModelCalls(sessionId, 120),
      });
    },
    [runLongListLoad, store],
  );

  const loadTerminalActivity = useCallback(
    async (sessionId: string, terminalId: string): Promise<void> => {
      await runLongListLoad({
        resource: "terminal-activity",
        sessionId,
        detailId: terminalId,
        run: () => store.loadTerminalActivity(sessionId, terminalId, 120),
      });
    },
    [runLongListLoad, store],
  );

  const loadMoreTerminalActivity = useCallback(
    async (sessionId: string, terminalId: string): Promise<void> => {
      await runLongListLoad({
        resource: "terminal-activity",
        sessionId,
        detailId: terminalId,
        older: true,
        run: () => store.loadMoreTerminalActivity(sessionId, terminalId, 120),
      });
    },
    [runLongListLoad, store],
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
    async (workspacePath: string, force = true): Promise<void> => {
      const sameWorkspace = settingsCatalogWorkspaceRef.current === workspacePath;
      if (!force && sameWorkspace && settingsCatalogLoadedRef.current) {
        return;
      }
      setSettingsLoading(true);
      try {
        const data = await store.listSettingsLayers(workspacePath);
        setSettingsLayers(data.layers);
        setSettingsEffective(data.effective.content);
        setSelectedLayerId((prev) =>
          data.layers.some((item) => item.layerId === prev) ? prev : (data.layers[0]?.layerId ?? null),
        );
        settingsCatalogWorkspaceRef.current = workspacePath;
        settingsCatalogLoadedRef.current = true;
        setSettingsStatus("layers refreshed");
      } catch (error) {
        settingsCatalogWorkspaceRef.current = workspacePath;
        settingsCatalogLoadedRef.current = false;
        setError(error);
      } finally {
        setSettingsLoading(false);
      }
    },
    [setError, store],
  );

  const ensureSettingsLayers = useCallback(
    async (workspacePath: string): Promise<void> => {
      await refreshSettingsLayers(workspacePath, false);
    },
    [refreshSettingsLayers],
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
    async (input: { sessionId: string; chatId?: string; visible: boolean; focused: boolean }): Promise<void> => {
      try {
        await store.setChatVisibility(input);
      } catch (error) {
        setError(error);
      }
    },
    [setError, store],
  );

  const consumeNotifications = useCallback(
    async (input: { sessionId: string; chatId?: string; upToMessageId?: string | null }): Promise<void> => {
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
      await hydrateSessionLongLists(sessionId);
    },
    [hydrateSessionLongLists],
  );

  const queryAttention = useCallback(
    async (input: {
      sessionId: string;
      contextId?: string;
      hash?: string;
      depth?: number;
      author?: string;
      source?: string;
      text?: string;
      offset?: number;
      limit?: number;
      minScore?: number;
    }) => {
      return await store.queryAttention(input);
    },
    [store],
  );

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
      getLongListPagingState,
      searchWorkspacePaths,
      createWorkspaceSession,
      quickstartSubmit,
      enterWorkspace,
      resumeSession,
      startSession,
      stopSession,
      abortSession,
      deleteSession,
      sendChat,
      ensureMessageChannels,
      listMessageChannels,
      createMessageChannel,
      focusMessageChannels,
      sendMessageChannel,
      updateMessageChannel,
      listMessageChannelGrants,
      issueMessageChannelGrant,
      revokeMessageChannelGrant,
      loadMoreChatMessages,
      loadMoreChatCycles,
      loadMoreTrace,
      loadMoreModel,
      loadTerminalActivity,
      loadMoreTerminalActivity,
      toggleWorkspaceFavorite,
      deleteWorkspace,
      cleanMissingWorkspaces,
      toggleSessionFavorite,
      stopWorkspaceSession,
      archiveWorkspaceSession,
      restoreWorkspaceSession,
      deleteWorkspaceSession,
      loadMoreWorkspaceSessions,
      ensureSettingsLayers,
      refreshSettingsLayers,
      loadSelectedLayer,
      saveSelectedLayer,
      setChatVisibility,
      consumeNotifications,
      hydrateSession,
      queryAttention,
      listDirectories,
      validateDirectory,
    }),
    [
      archiveWorkspaceSession,
      cleanMissingWorkspaces,
      consumeNotifications,
      createWorkspaceSession,
      deleteSession,
      deleteWorkspace,
      deleteWorkspaceSession,
      enterWorkspace,
      ensureMessageChannels,
      ensureSettingsLayers,
      focusMessageChannels,
      getLongListPagingState,
      hydrateSession,
      issueMessageChannelGrant,
      layerDraft,
      listMessageChannelGrants,
      loadMoreChatCycles,
      loadMoreChatMessages,
      listMessageChannels,
      loadMoreTerminalActivity,
      loadTerminalActivity,
      loadMoreModel,
      loadMoreTrace,
      loadMoreWorkspaceSessions,
      loadSelectedLayer,
      listDirectories,
      notice,
      quickstartBusy,
      quickstartDraft,
      quickstartDraftLoading,
      quickstartRecentSessions,
      quickstartSubmit,
      queryAttention,
      quickstartWorkspacePath,
      refreshSettingsLayers,
      restoreWorkspaceSession,
      resumeSession,
      saveSelectedLayer,
      createMessageChannel,
      updateMessageChannel,
      revokeMessageChannelGrant,
      sendMessageChannel,
      searchWorkspacePaths,
      selectedLayerId,
      selectedWorkspacePath,
      selectedWorkspaceSessionId,
      abortSession,
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
