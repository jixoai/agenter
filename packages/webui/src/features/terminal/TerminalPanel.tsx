import type { RuntimeClientState } from "@agenter/client-sdk";
import { Crosshair, MonitorCog, Plus, ScanLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ClipSurface, ViewportMask } from "../../components/ui/overflow-surface";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";
import type { LongListPagingState } from "../../shared/long-list-paging";
import { TerminalActivityPanel } from "./TerminalActivityPanel";
import { TerminalViewHost } from "./TerminalViewHost";
import { TerminalCreateDialog } from "./terminal-create-dialog";

interface TerminalPanelProps {
  sessionId: string;
  runtime: RuntimeClientState["runtimes"][string] | undefined;
  snapshots: RuntimeClientState["terminalSnapshotsBySession"][string] | undefined;
  terminalReads?: RuntimeClientState["terminalReadsBySession"][string] | undefined;
  terminalActivityByTerminal?: RuntimeClientState["terminalActivityBySession"][string] | undefined;
  getTerminalActivityPagingState: (terminalId: string) => LongListPagingState;
  onLoadTerminalActivity: (sessionId: string, terminalId: string) => Promise<void>;
  onLoadMoreTerminalActivity: (sessionId: string, terminalId: string) => Promise<void>;
  onCreateTerminal?: (input: {
    sessionId: string;
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: {
      command?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
      gitLog?: false | "none" | "normal" | "verbose";
      logStyle?: "plain" | "rich";
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
    };
    focus?: boolean;
  }) => Promise<{ ok: boolean; message: string; terminal?: unknown }>;
  onFocusTerminals?: (input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }) => Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  onDeleteTerminal?: (input: { sessionId: string; terminalId: string }) => Promise<{ ok: boolean; message: string }>;
  loading?: boolean;
}

type RuntimeTerminal = NonNullable<TerminalPanelProps["runtime"]>["terminals"][number];
type RuntimeTerminalSnapshot = NonNullable<TerminalPanelProps["snapshots"]>[string];
type ViewportMode = "fit" | "cover";
const VIEWPORT_MODE_STORAGE_KEY = "agenter:webui:terminal-scale-mode";

const statusVariant = (status: "IDLE" | "BUSY") => (status === "BUSY" ? "warning" : "secondary");

const isViewportMode = (value: string | null): value is ViewportMode => value === "fit" || value === "cover";

const readViewportMode = (): ViewportMode => {
  if (typeof window === "undefined") {
    return "fit";
  }
  const stored = window.localStorage.getItem(VIEWPORT_MODE_STORAGE_KEY);
  return isViewportMode(stored) ? stored : "fit";
};

const LoadingShell = () => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-8 w-28 rounded-xl" />
    </div>
    <Skeleton className="h-8 w-40 rounded-xl" />
    <Skeleton className="h-full min-h-[22rem] w-full rounded-2xl" />
  </div>
);

const getFocusedTerminal = (
  runtime: NonNullable<TerminalPanelProps["runtime"]>,
): RuntimeTerminal | undefined => {
  const focusedTerminalId = runtime.focusedTerminalIds[0] ?? runtime.terminals[0]?.terminalId;
  return runtime.terminals.find((item) => item.terminalId === focusedTerminalId) ?? runtime.terminals[0];
};

const flattenSnapshotLines = (snapshot: RuntimeTerminalSnapshot | undefined) => {
  if (!snapshot) {
    return null;
  }
  const lines =
    snapshot.lines.length > 0
      ? snapshot.lines
      : (snapshot.richLines ?? []).map((line) => line.spans.map((span) => span.text).join(""));

  return {
    seq: snapshot.seq,
    timestamp: snapshot.timestamp,
    cols: snapshot.cols,
    rows: snapshot.rows,
    lines,
    richLines: snapshot.richLines ?? [],
    cursor: snapshot.cursor,
    cursorVisible: snapshot.cursorVisible,
  };
};

const getTerminalTitle = (terminal: RuntimeTerminal) => {
  return "title" in terminal && typeof terminal.title === "string" && terminal.title.length > 0
    ? terminal.title
    : terminal.terminalId;
};

const readCreatedTerminalId = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = (value as { terminalId?: unknown }).terminalId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

export const TerminalPanel = ({
  sessionId,
  runtime,
  snapshots,
  terminalReads,
  terminalActivityByTerminal,
  getTerminalActivityPagingState,
  onLoadTerminalActivity,
  onLoadMoreTerminalActivity,
  onCreateTerminal,
  onFocusTerminals,
  onDeleteTerminal,
  loading = false,
}: TerminalPanelProps) => {
  const terminals = runtime?.terminals ?? [];
  const hasRuntimeTerminals = terminals.length > 0;
  const surfaceState = resolveAsyncSurfaceState({
    loading,
    hasData: hasRuntimeTerminals,
  });
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => readViewportMode());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const focused = useMemo(() => (runtime ? getFocusedTerminal(runtime) : undefined), [runtime]);
  const selectedTerminal = useMemo(
    () => (terminals.find((terminal) => terminal.terminalId === selectedTerminalId) ?? focused ?? terminals[0]) || undefined,
    [focused, selectedTerminalId, terminals],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(VIEWPORT_MODE_STORAGE_KEY, viewportMode);
  }, [viewportMode]);

  useEffect(() => {
    if (!runtime || !focused) {
      setSelectedTerminalId(null);
      return;
    }
    setSelectedTerminalId((current) =>
      current && terminals.some((terminal) => terminal.terminalId === current) ? current : focused.terminalId,
    );
  }, [focused, runtime, terminals]);

  useEffect(() => {
    if (!selectedTerminal) {
      return;
    }
    const pagingState = getTerminalActivityPagingState(selectedTerminal.terminalId);
    if (pagingState.hydrated || pagingState.loading) {
      return;
    }
    void onLoadTerminalActivity(sessionId, selectedTerminal.terminalId);
  }, [getTerminalActivityPagingState, onLoadTerminalActivity, selectedTerminal, sessionId]);

  const handleFocusTerminal = async (terminalId: string) => {
    setSelectedTerminalId(terminalId);
    if (!onFocusTerminals) {
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const result = await onFocusTerminals({
        sessionId,
        op: "replace",
        terminalIds: [terminalId],
      });
      if (!result.ok) {
        throw new Error(result.message);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteTerminal = async () => {
    if (!selectedTerminal || !onDeleteTerminal) {
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const result = await onDeleteTerminal({
        sessionId,
        terminalId: selectedTerminal.terminalId,
      });
      if (!result.ok) {
        throw new Error(result.message);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateTerminal = async (input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: {
      command?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
      gitLog?: false | "none" | "normal" | "verbose";
      logStyle?: "plain" | "rich";
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
    };
    focus?: boolean;
  }) => {
    if (!onCreateTerminal) {
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const result = await onCreateTerminal({
        sessionId,
        ...input,
      });
      if (!result.ok) {
        throw new Error(result.message);
      }
      const createdTerminalId = readCreatedTerminalId(result.terminal);
      if (createdTerminalId) {
        setSelectedTerminalId(createdTerminalId);
      } else if (input.terminalId) {
        setSelectedTerminalId(input.terminalId);
      }
      setCreateDialogOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActionBusy(false);
    }
  };

  if (!runtime || runtime.terminals.length === 0) {
    return (
      <AsyncSurface
        state={surfaceState}
        skeleton={<LoadingShell />}
        empty={
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
            <p>No terminal in this session.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!runtime || !onCreateTerminal || actionBusy}
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New terminal
            </Button>
            {actionError ? <p className="text-xs text-rose-700">{actionError}</p> : null}
          </div>
        }
        className="h-full"
      >
        <TerminalCreateDialog
          open={createDialogOpen}
          defaultCwd={undefined}
          onClose={() => setCreateDialogOpen(false)}
          onCreate={async (input) => {
            await handleCreateTerminal(input);
          }}
        />
      </AsyncSurface>
    );
  }

  if (!selectedTerminal) {
    return null;
  }

  const snapshot = snapshots?.[selectedTerminal.terminalId];
  const flattenedSnapshot = flattenSnapshotLines(snapshot);
  const transportModeLabel = selectedTerminal.transportUrl ? "Live transport" : "Snapshot fallback";
  const rows = flattenedSnapshot?.rows ?? 24;
  const cols = flattenedSnapshot?.cols ?? 80;
  const terminalRead = terminalReads?.[selectedTerminal.terminalId];
  const terminalActivity = terminalActivityByTerminal?.[selectedTerminal.terminalId] ?? [];
  const activityPaging = getTerminalActivityPagingState(selectedTerminal.terminalId);

  return (
    <AsyncSurface
      state={surfaceState}
      skeleton={<LoadingShell />}
      empty={
        <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
          No terminal in this session.
        </div>
      }
      className="h-full"
      loadingOverlayLabel="Refreshing terminal..."
    >
      <ViewportMask className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="typo-title-3 text-slate-900">Terminal</h3>
              <Badge variant={statusVariant(selectedTerminal.status)}>{selectedTerminal.status}</Badge>
              <Badge variant="secondary">{transportModeLabel}</Badge>
              <Badge variant="secondary">
                {cols}x{rows}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500">
              seq {flattenedSnapshot?.seq ?? selectedTerminal.seq} · fit keeps PTY geometry container-driven; cover only changes presentation.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!onCreateTerminal || actionBusy}
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New terminal
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedTerminal || !onFocusTerminals || actionBusy}
              onClick={() => {
                if (!selectedTerminal) {
                  return;
                }
                void handleFocusTerminal(selectedTerminal.terminalId);
              }}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Focus
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedTerminal || !onDeleteTerminal || actionBusy}
              onClick={() => {
                void handleDeleteTerminal();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                viewportMode === "fit"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700",
              )}
              aria-pressed={viewportMode === "fit"}
              onClick={() => setViewportMode("fit")}
            >
              <ScanLine className="h-3.5 w-3.5" />
              <span>Fit</span>
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                viewportMode === "cover"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700",
              )}
              aria-pressed={viewportMode === "cover"}
              onClick={() => setViewportMode("cover")}
            >
              <MonitorCog className="h-3.5 w-3.5" />
              <span>Cover</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {terminals.map((terminal) => (
            <button
              type="button"
              key={terminal.terminalId}
              onClick={() => {
                void handleFocusTerminal(terminal.terminalId);
              }}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px]",
                terminal.terminalId === selectedTerminal.terminalId
                  ? "border-teal-300 bg-teal-100 text-teal-900"
                  : "border-slate-200 bg-slate-50 text-slate-700",
              )}
            >
              {terminal.terminalId}
            </button>
          ))}
        </div>
        {actionError ? <p className="text-xs text-rose-700">{actionError}</p> : null}

        <ViewportMask className="grid h-full gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <ClipSurface
            data-terminal-panel-scroll-owner="renderer"
            className="rounded-[20px] border border-slate-300 bg-slate-950 shadow-[0_22px_80px_rgba(15,23,42,0.18)]"
          >
            <TerminalViewHost
              testId="terminal-view-host"
              className="h-full"
              terminalId={selectedTerminal.terminalId}
              terminalTitle={getTerminalTitle(selectedTerminal)}
              cwd={selectedTerminal.cwd}
              status={selectedTerminal.status}
              viewportMode={viewportMode}
              transportUrl={selectedTerminal.transportUrl}
              snapshot={flattenedSnapshot}
            />
          </ClipSurface>

          <TerminalActivityPanel
            terminalId={selectedTerminal.terminalId}
            terminalRead={terminalRead}
            items={terminalActivity}
            hasMore={activityPaging.hasMore}
            loading={activityPaging.loading}
            loadingOlder={activityPaging.loadingOlder}
            onLoadMore={() => {
              void onLoadMoreTerminalActivity(sessionId, selectedTerminal.terminalId);
            }}
          />
        </ViewportMask>
      </ViewportMask>
      <TerminalCreateDialog
        open={createDialogOpen}
        defaultCwd={selectedTerminal.cwd}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={async (input) => {
          await handleCreateTerminal(input);
        }}
      />
    </AsyncSurface>
  );
};
