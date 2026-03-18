import type { WorkspaceSessionEntry } from "@agenter/client-sdk";
import { Archive, MessageSquare, RotateCcw, Square, Star, Trash2 } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { sessionStatusMeta } from "../../shared/status-meta";
import { workspaceSessionPreviewText } from "./session-preview";

interface SessionItemProps {
  session: WorkspaceSessionEntry;
  selected: boolean;
  mode?: "workspace" | "quickstart";
  onSelect: (sessionId: string | null) => void;
  onActivate: (sessionId: string) => void;
  onStop?: (sessionId: string) => void;
  onToggleFavorite?: (sessionId: string) => void;
  onArchive?: (sessionId: string) => void;
  onRestore?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}

const formatSessionCreatedAt = (value: string): string => {
  const iso = new Date(value).toISOString().slice(0, 16).replace("T", " ");
  return `${iso} UTC`;
};

export const SessionItem = ({
  session,
  selected,
  mode = "workspace",
  onSelect,
  onActivate,
  onStop,
  onToggleFavorite,
  onArchive,
  onRestore,
  onDelete,
}: SessionItemProps) => {
  const status = sessionStatusMeta(session.status);
  const previewText = workspaceSessionPreviewText(session.preview);
  const isArchived = session.storageState === "archived";
  const showStop = !isArchived && (session.status === "running" || session.status === "starting");
  const compact = mode === "quickstart";

  return (
    <article
      className={cn(
        "rounded-xl border px-3 py-3 text-left transition-colors",
        selected ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelect(selected ? null : session.sessionId)}
            onDoubleClick={() => onActivate(session.sessionId)}
            className="flex min-w-0 flex-1 flex-col items-start gap-2 text-left"
            title={session.sessionId}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{session.name}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
              {session.favorite ? <Badge variant="secondary">favorite</Badge> : null}
              {session.archivedAt ? <Badge variant="secondary">archived</Badge> : null}
            </div>
            <p className="text-[11px] break-all text-slate-500">{session.sessionId}</p>
            <p className="text-[11px] text-slate-500">Created {formatSessionCreatedAt(session.createdAt)}</p>
          </button>

          <div className="flex w-full flex-wrap items-center justify-start gap-1 sm:w-auto sm:justify-end">
            {!isArchived ? (
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Resume ${session.name} · ${session.sessionId}`}
                onClick={() => onActivate(session.sessionId)}
                title="Resume session"
              >
                <ButtonLeadingVisual>
                  <MessageSquare className="h-3.5 w-3.5" />
                </ButtonLeadingVisual>
                <ButtonLabel>Chat</ButtonLabel>
              </Button>
            ) : null}
            {!compact && showStop && onStop ? (
              <Button size="sm" variant="outline" onClick={() => onStop(session.sessionId)} title="Stop session">
                <ButtonLeadingVisual>
                  <Square className="h-3.5 w-3.5" />
                </ButtonLeadingVisual>
                <ButtonLabel>Stop</ButtonLabel>
              </Button>
            ) : null}
            {!compact && onToggleFavorite ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Toggle favorite for ${session.sessionId}`}
                title="Toggle favorite"
                onClick={() => onToggleFavorite(session.sessionId)}
              >
                <Star className={cn("h-4 w-4", session.favorite ? "fill-amber-400 text-amber-500" : "text-slate-500")} />
              </Button>
            ) : null}
            {!compact && (isArchived ? onRestore : onArchive) ? (
              isArchived ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Restore session ${session.sessionId}`}
                  title="Restore session"
                  onClick={() => onRestore?.(session.sessionId)}
                >
                  <RotateCcw className="h-4 w-4 text-teal-700" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Archive session ${session.sessionId}`}
                  title="Archive session"
                  onClick={() => onArchive?.(session.sessionId)}
                >
                  <Archive className="h-4 w-4 text-slate-600" />
                </Button>
              )
            ) : null}
            {!compact && onDelete ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete session ${session.sessionId}`}
                title="Delete session"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => onDelete(session.sessionId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelect(selected ? null : session.sessionId)}
          onDoubleClick={() => onActivate(session.sessionId)}
          className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-left hover:border-slate-300"
        >
          <p className={cn("text-xs leading-5 text-slate-700", compact ? "line-clamp-2" : "line-clamp-3")}>{previewText}</p>
        </button>
      </div>
    </article>
  );
};
