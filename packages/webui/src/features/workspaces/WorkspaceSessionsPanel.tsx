import type {
  WorkspaceEntry,
  WorkspaceSessionCounts,
  WorkspaceSessionEntry,
  WorkspaceSessionTab,
} from "@agenter/client-sdk";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageSquarePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Tabs, type TabItem } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { SessionItem } from "./SessionItem";

interface WorkspaceSessionsPanelProps {
  workspace: WorkspaceEntry | null;
  sessions: WorkspaceSessionEntry[];
  counts: WorkspaceSessionCounts;
  tab: WorkspaceSessionTab;
  selectedSessionId: string | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onChangeTab: (tab: WorkspaceSessionTab) => void;
  onSelectSession: (sessionId: string | null) => void;
  onLoadMore: () => void;
  onCreateSessionInWorkspace: (path: string) => void;
  onOpenSession: (sessionId: string) => void;
  onStopSession: (sessionId: string) => void;
  onToggleSessionFavorite: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onRestoreSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

type PendingAction =
  | { type: "archive"; session: WorkspaceSessionEntry }
  | { type: "restore"; session: WorkspaceSessionEntry }
  | { type: "delete"; session: WorkspaceSessionEntry };

const ROW_HEIGHT = 184;
const OVERSCAN = 8;
const INLINE_RENDER_LIMIT = 24;

const tabItems = (counts: WorkspaceSessionCounts): TabItem[] => [
  { id: "all", label: `All ${counts.all}` },
  { id: "running", label: `Running ${counts.running}` },
  { id: "stopped", label: `Stopped ${counts.stopped}` },
  { id: "archive", label: `Archive ${counts.archive}` },
];

const emptyCopy = (tab: WorkspaceSessionTab) => {
  if (tab === "archive") {
    return {
      title: "No archived sessions",
      description: "Archive a session to keep it out of the active workspace list without deleting it.",
    };
  }
  if (tab === "running") {
    return {
      title: "No running sessions",
      description: "Start or resume a session to see it here.",
    };
  }
  if (tab === "stopped") {
    return {
      title: "No stopped sessions",
      description: "Stopped and errored sessions appear here.",
    };
  }
  return {
    title: "No sessions yet",
    description: "Start a new session in this workspace to begin chatting with Agenter.",
  };
};

const dialogTitle = (action: PendingAction | null): string => {
  if (!action) {
    return "";
  }
  if (action.type === "delete") {
    return "Delete session";
  }
  if (action.type === "archive") {
    return "Archive session";
  }
  return "Restore session";
};

const dialogDescription = (action: PendingAction | null): string | undefined => {
  if (!action) {
    return undefined;
  }
  if (action.type === "delete") {
    return `Delete ${action.session.name} permanently?`;
  }
  if (action.type === "archive") {
    return `Archive ${action.session.name}? You can restore it later.`;
  }
  return `Restore ${action.session.name} back into the workspace?`;
};

const dialogBody = (action: PendingAction | null): string => {
  if (!action) {
    return "";
  }
  if (action.type === "delete") {
    return "This removes the session folder and its logs permanently.";
  }
  if (action.type === "archive") {
    return "Archived sessions move into ~/.agenter/archive/sessions and disappear from active tabs.";
  }
  return "Restored sessions return to the workspace and can be resumed again.";
};

export const WorkspaceSessionsPanel = ({
  workspace,
  sessions,
  counts,
  tab,
  selectedSessionId,
  loading,
  loadingMore,
  hasMore,
  onChangeTab,
  onSelectSession,
  onLoadMore,
  onCreateSessionInWorkspace,
  onOpenSession,
  onStopSession,
  onToggleSessionFavorite,
  onArchiveSession,
  onRestoreSession,
  onDeleteSession,
}: WorkspaceSessionsPanelProps) => {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const tabs = useMemo(() => tabItems(counts), [counts]);
  const useInlineRows = sessions.length <= INLINE_RENDER_LIMIT;
  const rowVirtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    initialRect: {
      width: 0,
      height: ROW_HEIGHT * 4,
    },
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const shouldVirtualize = !useInlineRows && virtualRows.length > 0;

  useEffect(() => {
    if (useInlineRows) {
      return;
    }
    rowVirtualizer.measure();
    parentRef.current?.scrollTo({ top: 0 });
  }, [rowVirtualizer, tab, useInlineRows, workspace?.path]);

  useEffect(() => {
    if (!shouldVirtualize) {
      return;
    }
    const last = virtualRows.at(-1);
    if (!last || loading || loadingMore || !hasMore) {
      return;
    }
    if (last.index >= sessions.length - 5) {
      onLoadMore();
    }
  }, [hasMore, loading, loadingMore, onLoadMore, sessions.length, shouldVirtualize, virtualRows]);

  if (!workspace) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl bg-white p-6 text-center shadow-sm">
        <h2 className="typo-title-3 text-slate-900">Sessions</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-600">
          Select a workspace to inspect its sessions and resume work.
        </p>
      </section>
    );
  }

  const emptyState = emptyCopy(tab);

  const renderSessionCard = (
    session: WorkspaceSessionEntry,
    key: string,
    style?: CSSProperties,
    measureRef?: (node: HTMLDivElement | null) => void,
  ): ReactNode => {
    const selected = session.sessionId === selectedSessionId;

    return (
      <div key={key} ref={measureRef} style={style} className={cn(style ? "absolute top-0 left-0 w-full" : "")}>
        <SessionItem
          session={session}
          selected={selected}
          onSelect={onSelectSession}
          onActivate={onOpenSession}
          onStop={onStopSession}
          onToggleFavorite={onToggleSessionFavorite}
          onArchive={(sessionId) => {
            const target = sessions.find((item) => item.sessionId === sessionId);
            if (target) {
              setPendingAction({ type: "archive", session: target });
            }
          }}
          onRestore={(sessionId) => {
            const target = sessions.find((item) => item.sessionId === sessionId);
            if (target) {
              setPendingAction({ type: "restore", session: target });
            }
          }}
          onDelete={(sessionId) => {
            const target = sessions.find((item) => item.sessionId === sessionId);
            if (target) {
              setPendingAction({ type: "delete", session: target });
            }
          }}
        />
      </div>
    );
  };


  return (
    <>
      <section className="flex h-full flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-sm">
        <div className="space-y-3 border-b border-slate-200 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="typo-title-3 text-slate-900">Sessions</h2>
                {workspace.missing ? <Badge variant="destructive">missing</Badge> : null}
              </div>
              <p className="mt-1 text-xs break-all text-slate-500">{workspace.path}</p>
              {workspace.missing ? (
                <p className="mt-2 text-xs text-rose-700">
                  This workspace folder is currently missing on disk. Existing sessions stay visible, but new sessions
                  are disabled until the path is fixed or cleaned.
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onCreateSessionInWorkspace(workspace.path)}
                disabled={workspace.missing}
                title={workspace.missing ? "Workspace folder is missing" : "Create session"}
              >
                <ButtonLeadingVisual>
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                </ButtonLeadingVisual>
                <ButtonLabel>New</ButtonLabel>
              </Button>
            </div>
          </div>

          <Tabs
            items={tabs}
            value={tab}
            onValueChange={(value) => onChangeTab(value as WorkspaceSessionTab)}
            className="w-full"
          />
        </div>

        <div ref={parentRef} className="flex-1 overflow-auto pt-3">
          {loading && sessions.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
              <h3 className="text-sm font-semibold text-slate-900">{emptyState.title}</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-600">{emptyState.description}</p>
            </div>
          ) : shouldVirtualize ? (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
              {virtualRows.map((virtualRow) => {
                const session = sessions[virtualRow.index];
                return renderSessionCard(
                  session,
                  String(virtualRow.key),
                  { transform: `translateY(${virtualRow.start}px)` },
                  rowVirtualizer.measureElement,
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">{sessions.map((session) => renderSessionCard(session, session.sessionId))}</div>
          )}
          {loadingMore ? <p className="pt-3 text-center text-xs text-slate-500">Loading more sessions...</p> : null}
        </div>
      </section>

      <Dialog
        open={pendingAction !== null}
        title={dialogTitle(pendingAction)}
        description={dialogDescription(pendingAction)}
        onClose={() => setPendingAction(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction?.type === "delete" ? "destructive" : "default"}
              onClick={() => {
                if (!pendingAction) {
                  return;
                }
                if (pendingAction.type === "delete") {
                  onDeleteSession(pendingAction.session.sessionId);
                } else if (pendingAction.type === "archive") {
                  onArchiveSession(pendingAction.session.sessionId);
                } else {
                  onRestoreSession(pendingAction.session.sessionId);
                }
                setPendingAction(null);
              }}
            >
              {pendingAction?.type === "delete" ? "Delete" : pendingAction?.type === "archive" ? "Archive" : "Restore"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{dialogBody(pendingAction)}</p>
      </Dialog>
    </>
  );
};
