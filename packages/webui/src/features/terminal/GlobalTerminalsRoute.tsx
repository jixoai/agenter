import type {
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  HistoryPageCursor,
  TerminalActivityItem,
} from "@agenter/client-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppController, useRuntimeSelector } from "../../app-context";
import type { ActorTokenOption } from "../collaboration/ActorTokenSelect";
import { buildActorDirectory, buildActorDirectoryMap, fallbackActorLabel } from "../collaboration/actor-directory";
import { useAuthActorCatalog } from "../collaboration/use-auth-actor-catalog";
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
type GrantsState = {
  terminalId: string | null;
  items: GlobalTerminalGrantEntry[];
  loading: boolean;
  error: string | null;
};

const readViewportMode = (): ViewportMode => {
  if (typeof window === "undefined") {
    return "fit";
  }
  const stored = window.localStorage.getItem(VIEWPORT_MODE_STORAGE_KEY);
  return stored === "cover" ? "cover" : "fit";
};

const resolveTerminalActorKind = (actorId: string | undefined): "auth" | "session" | "system" => {
  if (actorId?.startsWith("auth:")) {
    return "auth";
  }
  if (actorId?.startsWith("session:")) {
    return "session";
  }
  return "system";
};

const isActorSeatId = (actorId: string | undefined): actorId is GlobalTerminalActorId =>
  Boolean(actorId && (actorId.startsWith("auth:") || actorId.startsWith("session:")));

export const GlobalTerminalsRoute = ({ preferredTerminalId }: { preferredTerminalId?: string | null }) => {
  const controller = useAppController();
  const connected = useRuntimeSelector((state) => state.connected);
  const sessions = useRuntimeSelector((state) => state.sessions);
  const iconUrls = useIconServiceUrls(controller.runtimeStore);
  const { items: authActors } = useAuthActorCatalog(controller.runtimeStore, connected);
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
  const [grants, setGrants] = useState<GrantsState>({
    terminalId: null,
    items: [],
    loading: false,
    error: null,
  });
  const [selectedCallerTokenByTerminalId, setSelectedCallerTokenByTerminalId] = useState<Record<string, string>>({});

  const actorDirectory = useMemo(
    () =>
      buildActorDirectory({
        sessions,
        authActors,
        iconUrls,
      }),
    [authActors, iconUrls, sessions],
  );

  const actorOptions = useMemo<TerminalActorOption[]>(
    () =>
      actorDirectory
        .filter((entry): entry is typeof entry & { actorId: GlobalTerminalActorId } => entry.actorId.startsWith("auth:") || entry.actorId.startsWith("session:"))
        .map((entry) => ({
          actorId: entry.actorId,
          actorKind: entry.actorKind,
          label: entry.label,
          subtitle: entry.subtitle,
        })),
    [actorDirectory],
  );

  const actorMeta = useMemo(() => {
    const next = new Map<string, TerminalActorMeta>();
    buildActorDirectoryMap(actorDirectory).forEach((entry, actorId) => {
      next.set(actorId, {
        label: entry.label,
        subtitle: entry.subtitle,
        iconUrl: entry.iconUrl ?? undefined,
        actorKind: entry.actorKind,
      });
    });
    return next;
  }, [actorDirectory]);

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

  const loadGrants = useCallback(
    async (terminalId: string) => {
      setGrants((current) => ({
        terminalId,
        items: current.terminalId === terminalId ? current.items : [],
        loading: true,
        error: null,
      }));
      try {
        const items = await controller.listGlobalTerminalGrants(terminalId);
        setGrants({
          terminalId,
          items,
          loading: false,
          error: null,
        });
      } catch (loadError) {
        setGrants((current) => ({
          ...current,
          terminalId,
          loading: false,
          error: loadError instanceof Error ? loadError.message : String(loadError),
        }));
      }
    },
    [controller],
  );

  const applyGrantState = useCallback((input: { terminalId: string; items: GlobalTerminalGrantEntry[] }) => {
    setGrants({
      terminalId: input.terminalId,
      items: input.items,
      loading: false,
      error: null,
    });
  }, []);

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
      setGrants({
        terminalId: null,
        items: [],
        loading: false,
        error: null,
      });
      return;
    }
    void loadActivity(selectedTerminal.terminalId, null);
    void loadGrants(selectedTerminal.terminalId);
  }, [loadActivity, loadGrants, selectedTerminal?.terminalId]);

  useEffect(() => {
    if (!preferredTerminalId || !terminals.some((terminal) => terminal.terminalId === preferredTerminalId)) {
      return;
    }
    setSelectedTerminalId(preferredTerminalId);
  }, [preferredTerminalId, terminals]);

  const handleSelectTerminal = useCallback(
    (terminalId: string) => {
      setSelectedTerminalId(terminalId);
    },
    [],
  );

  const callerOptions = useMemo<ActorTokenOption[]>(() => {
    if (!selectedTerminal) {
      return [];
    }
    const options: ActorTokenOption[] = [];
    const seen = new Set<string>();
    const pushToken = (accessToken: string | undefined, input: { label: string; subtitle?: string; roleLabel?: string }) => {
      if (!accessToken || seen.has(accessToken)) {
        return;
      }
      seen.add(accessToken);
      options.push({
        accessToken,
        label: input.label,
        subtitle: input.subtitle,
        roleLabel: input.roleLabel,
      });
    };
    if (isActorSeatId(selectedTerminal.access?.participantId)) {
      const actor = actorMeta.get(selectedTerminal.access.participantId);
      pushToken(selectedTerminal.access.accessToken, {
        label: actor?.label ?? fallbackActorLabel(selectedTerminal.access.participantId),
        subtitle: actor?.subtitle ?? selectedTerminal.access.participantId,
        roleLabel: selectedTerminal.access.role,
      });
    }
    grants.items.forEach((grant) => {
      const actor = grant.participantId ? actorMeta.get(grant.participantId) : null;
      pushToken(grant.accessToken, {
        label: actor?.label ?? grant.label ?? grant.participantId ?? grant.grantId,
        subtitle: actor?.subtitle ?? grant.participantId,
        roleLabel: grant.role,
      });
    });
    return options;
  }, [actorMeta, grants.items, selectedTerminal]);

  const selectedCallerToken = useMemo(() => {
    if (!selectedTerminal) {
      return null;
    }
    const preferred = selectedCallerTokenByTerminalId[selectedTerminal.terminalId];
    if (preferred && callerOptions.some((option) => option.accessToken === preferred)) {
      return preferred;
    }
    return callerOptions[0]?.accessToken ?? null;
  }, [callerOptions, selectedCallerTokenByTerminalId, selectedTerminal]);

  const userEntries = useMemo(() => {
    if (!selectedTerminal) {
      return [];
    }
    const grantByActorId = new Map(grants.items.map((grant) => [grant.participantId ?? grant.grantId, grant]));
    const currentProjectionActorId = selectedTerminal.access?.participantId;
    return (selectedTerminal.actors ?? [])
      .map((actor) => {
        const meta = actorMeta.get(actor.actorId);
        const grant = grantByActorId.get(actor.actorId);
        const accessToken =
          grant?.accessToken ??
          (currentProjectionActorId === actor.actorId ? selectedTerminal.access?.accessToken : undefined);
        return {
          actorId: actor.actorId,
          actorKind: meta?.actorKind ?? resolveTerminalActorKind(actor.actorId),
          label: meta?.label ?? actor.label ?? fallbackActorLabel(actor.actorId),
          subtitle: meta?.subtitle ?? actor.actorId,
          iconUrl: meta?.iconUrl,
          role: actor.role,
          currentAdmin: actor.currentAdmin,
          online: actor.online,
          focused: actor.focused,
          invalidCredential: actor.invalidCredential ?? false,
          accessToken,
          currentCaller: accessToken === selectedCallerToken,
        };
      })
      .sort((left, right) => {
        if (left.currentCaller !== right.currentCaller) {
          return left.currentCaller ? -1 : 1;
        }
        if (left.currentAdmin !== right.currentAdmin) {
          return left.currentAdmin ? -1 : 1;
        }
        const rank = (role: typeof left.role) => ({ admin: 0, writer: 1, requester: 2, readonly: 3 })[role];
        const roleDiff = rank(left.role) - rank(right.role);
        if (roleDiff !== 0) {
          return roleDiff;
        }
        return left.label.localeCompare(right.label);
      });
  }, [actorMeta, grants.items, selectedCallerToken, selectedTerminal]);

  return (
    <GlobalTerminalWorkbench
      terminals={terminals}
      selectedTerminalId={selectedTerminal?.terminalId ?? null}
      loading={loading}
      refreshing={refreshing}
      error={error}
      viewportMode={viewportMode}
      actorOptions={actorOptions}
      callerOptions={callerOptions}
      selectedCallerToken={selectedCallerToken}
      resolveActorMeta={(actorId) =>
        actorMeta.get(actorId) ?? {
          label: fallbackActorLabel(actorId),
        }
      }
      activity={activity}
      grants={grants}
      users={userEntries}
      onRefresh={() => refresh()}
      onSelectCallerToken={(accessToken) => {
        if (!selectedTerminal) {
          return;
        }
        setSelectedCallerTokenByTerminalId((current) => ({
          ...current,
          [selectedTerminal.terminalId]: accessToken,
        }));
      }}
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
      onListGrants={controller.listGlobalTerminalGrants}
      onIssueGrant={controller.issueGlobalTerminalGrant}
      onRevokeGrant={controller.revokeGlobalTerminalGrant}
      onTerminalGrantChanged={async (input) => {
        applyGrantState({
          terminalId: input.terminalId,
          items: input.grants,
        });
        await refresh({ silent: true });
      }}
      onListApprovalRequests={controller.listGlobalTerminalApprovalRequests}
      onApproveRequest={controller.approveGlobalTerminalRequest}
      onDenyRequest={controller.denyGlobalTerminalRequest}
      onLoadMoreActivity={() => {
        if (!activity.terminalId || !activity.hasMore || activity.loadingMore) {
          return;
        }
        return loadActivity(activity.terminalId, activity.nextBefore);
      }}
      onSetUserFocus={async (input) => {
        if (!selectedTerminal) {
          return;
        }
        await controller.focusGlobalTerminals({
          op: input.focused ? "remove" : "add",
          terminalIds: [selectedTerminal.terminalId],
          accessToken: input.accessToken,
        });
        await refresh({ silent: true });
      }}
      onReadTerminal={async (input) => {
        if (!selectedTerminal) {
          return;
        }
        await controller.readGlobalTerminal({
          terminalId: selectedTerminal.terminalId,
          accessToken: input.accessToken,
          mode: input.mode,
          remark: input.remark,
        });
        await loadActivity(selectedTerminal.terminalId, null);
      }}
      onWriteTerminal={async (input) => {
        if (!selectedTerminal) {
          return;
        }
        await controller.writeGlobalTerminal({
          terminalId: selectedTerminal.terminalId,
          accessToken: input.accessToken,
          text: input.text,
          submit: input.submit,
          submitKey: input.submitKey,
          returnRead: true,
        });
        await refresh({ silent: true });
        await loadActivity(selectedTerminal.terminalId, null);
      }}
    />
  );
};
