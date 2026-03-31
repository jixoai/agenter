import type {
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  HistoryPageCursor,
  TerminalActivityItem,
} from "@agenter/client-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppController, useRuntimeSelector } from "../../app-context";
import { useIconServiceUrls } from "../profile/icon-service";
import { GlobalTerminalWorkbench } from "./GlobalTerminalWorkbench";
import type { TerminalActorMeta } from "./TerminalActorGroup";
import type { TerminalActorOption } from "./TerminalGrantManagerDialog";

const VIEWPORT_MODE_STORAGE_KEY = "agenter:webui:global-terminal-scale-mode";

type ViewportMode = "fit" | "cover";
type ActivityState = {
  terminalId: string | null;
  items: TerminalActivityItem[];
  hasMore: boolean;
  nextBefore: HistoryPageCursor | null;
  loading: boolean;
  loadingMore: boolean;
};

const readViewportMode = (): ViewportMode => {
  if (typeof window === "undefined") {
    return "fit";
  }
  const stored = window.localStorage.getItem(VIEWPORT_MODE_STORAGE_KEY);
  return stored === "cover" ? "cover" : "fit";
};

const fallbackActorLabel = (actorId: string): string => actorId.split(":").at(-1) ?? actorId;

export const GlobalTerminalsRoute = () => {
  const controller = useAppController();
  const connected = useRuntimeSelector((state) => state.connected);
  const sessions = useRuntimeSelector((state) => state.sessions);
  const iconUrls = useIconServiceUrls(controller.runtimeStore);
  const [terminals, setTerminals] = useState<GlobalTerminalEntry[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => readViewportMode());
  const [activity, setActivity] = useState<ActivityState>({
    terminalId: null,
    items: [],
    hasMore: false,
    nextBefore: null,
    loading: false,
    loadingMore: false,
  });

  const actorOptions = useMemo<TerminalActorOption[]>(() => {
    return sessions.map((session) => ({
      actorId: `session:${session.id}` as GlobalTerminalActorId,
      label: session.name,
      subtitle: session.cwd,
    }));
  }, [sessions]);

  const actorMeta = useMemo(() => {
    const next = new Map<string, TerminalActorMeta>();
    actorOptions.forEach((option) => {
      next.set(option.actorId, {
        label: option.label,
        subtitle: option.subtitle,
        iconUrl: iconUrls.session(option.actorId.slice("session:".length)) ?? undefined,
      });
    });
    return next;
  }, [actorOptions, iconUrls]);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const items = await controller.listGlobalTerminals();
        setTerminals(items);
        setSelectedTerminalId((current) => {
          if (current && items.some((item) => item.terminalId === current)) {
            return current;
          }
          return items[0]?.terminalId ?? null;
        });
        setError(null);
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [controller],
  );

  const loadActivity = useCallback(
    async (terminalId: string, before?: HistoryPageCursor | null) => {
      setActivity((current) => ({
        terminalId,
        items: before ? current.items : [],
        hasMore: before ? current.hasMore : false,
        nextBefore: before ?? null,
        loading: before ? current.loading : true,
        loadingMore: before ? true : false,
      }));
      try {
        const page = await controller.loadGlobalTerminalActivity({
          terminalId,
          before,
        });
        setActivity((current) => ({
          terminalId,
          items: before ? [...current.items, ...page.items] : page.items,
          hasMore: page.hasMore,
          nextBefore: page.nextBefore,
          loading: false,
          loadingMore: false,
        }));
      } catch (loadError) {
        setActivity((current) => ({
          ...current,
          terminalId,
          loading: false,
          loadingMore: false,
        }));
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    },
    [controller],
  );

  useEffect(() => {
    if (!connected) {
      return;
    }
    void refresh();
  }, [connected, refresh]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh({ silent: true });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [connected, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(VIEWPORT_MODE_STORAGE_KEY, viewportMode);
  }, [viewportMode]);

  const selectedTerminal = useMemo(
    () => terminals.find((terminal) => terminal.terminalId === selectedTerminalId) ?? terminals[0] ?? null,
    [selectedTerminalId, terminals],
  );

  useEffect(() => {
    if (!selectedTerminal) {
      setActivity({
        terminalId: null,
        items: [],
        hasMore: false,
        nextBefore: null,
        loading: false,
        loadingMore: false,
      });
      return;
    }
    void loadActivity(selectedTerminal.terminalId, null);
  }, [loadActivity, selectedTerminal?.terminalId]);

  const handleSelectTerminal = useCallback(
    (terminalId: string) => {
      setSelectedTerminalId(terminalId);
      void controller
        .focusGlobalTerminals({
          op: "replace",
          terminalIds: [terminalId],
        })
        .then(() => refresh({ silent: true }))
        .catch((focusError) => {
          setError(focusError instanceof Error ? focusError.message : String(focusError));
        });
    },
    [controller, refresh],
  );

  return (
    <GlobalTerminalWorkbench
      terminals={terminals}
      selectedTerminalId={selectedTerminal?.terminalId ?? null}
      loading={loading}
      refreshing={refreshing}
      error={error}
      viewportMode={viewportMode}
      actorOptions={actorOptions}
      resolveActorMeta={(actorId) =>
        actorMeta.get(actorId) ?? {
          label: fallbackActorLabel(actorId),
        }
      }
      activity={activity}
      onRefresh={() => refresh()}
      onSelectTerminal={handleSelectTerminal}
      onSetViewportMode={setViewportMode}
      onCreateTerminal={async (input) => {
        const result = await controller.createGlobalTerminal(input);
        const terminalId = result.terminal?.terminalId ?? null;
        await refresh();
        if (terminalId) {
          setSelectedTerminalId(terminalId);
        }
        return result;
      }}
      onDeleteTerminal={async (input) => {
        const result = await controller.deleteGlobalTerminal(input);
        await refresh();
        return result;
      }}
      onFocusTerminal={async (terminal) => {
        await controller.focusGlobalTerminals({
          op: terminal.focused ? "remove" : "replace",
          terminalIds: [terminal.terminalId],
        });
        await refresh({ silent: true });
      }}
      onListGrants={controller.listGlobalTerminalGrants}
      onIssueGrant={controller.issueGlobalTerminalGrant}
      onRevokeGrant={controller.revokeGlobalTerminalGrant}
      onListApprovalRequests={controller.listGlobalTerminalApprovalRequests}
      onApproveRequest={controller.approveGlobalTerminalRequest}
      onDenyRequest={controller.denyGlobalTerminalRequest}
      onLoadMoreActivity={() => {
        if (!activity.terminalId || !activity.hasMore || activity.loadingMore) {
          return;
        }
        return loadActivity(activity.terminalId, activity.nextBefore);
      }}
    />
  );
};
