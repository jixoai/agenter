import type { WorkspaceEntry } from "@agenter/client-sdk";
import { MessageSquarePlus, Star, Trash2 } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { runningCountMeta } from "../../shared/status-meta";

interface WorkspaceItemProps {
  workspace: WorkspaceEntry;
  selected: boolean;
  unreadCount?: number;
  onSelect: (path: string | null) => void;
  onCreateSession: (path: string) => void;
  onToggleFavorite: (path: string) => void;
  onDelete: (path: string) => void;
}

export const WorkspaceItem = ({
  workspace,
  selected,
  unreadCount = 0,
  onSelect,
  onCreateSession,
  onToggleFavorite,
  onDelete,
}: WorkspaceItemProps) => {
  const runningMeta = runningCountMeta(workspace.counts.running);

  return (
    <article
      className={cn(
        "rounded-xl border p-2 shadow-xs transition-colors",
        selected
          ? "border-teal-300 bg-teal-50/50 shadow-sm"
          : workspace.missing
            ? "border-rose-200 bg-rose-50/40"
            : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onSelect(selected ? null : workspace.path)}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-start rounded-lg px-2 py-2 text-left",
            selected ? "bg-transparent" : workspace.missing ? "hover:bg-rose-100/60" : "hover:bg-slate-100",
          )}
          title={workspace.path}
        >
          <span className="block w-full text-sm font-medium break-all text-slate-900">{workspace.path}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1">
            {workspace.missing ? <Badge variant="destructive">missing</Badge> : null}
            {runningMeta ? <Badge variant={runningMeta.variant}>{runningMeta.label}</Badge> : null}
            <Badge variant="secondary">{workspace.counts.all} sessions</Badge>
            {unreadCount > 0 ? <Badge variant="warning">{`${unreadCount} unread`}</Badge> : null}
            {workspace.counts.archive > 0 ? (
              <Badge variant="secondary">archive {workspace.counts.archive}</Badge>
            ) : null}
          </span>
        </button>

        <div className="flex items-center gap-1 self-start">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Start new chat in ${workspace.path}`}
            title={workspace.missing ? "Workspace folder is missing" : "New session"}
            disabled={workspace.missing}
            onClick={() => onCreateSession(workspace.path)}
          >
            <MessageSquarePlus className={cn("h-4 w-4", workspace.missing ? "text-slate-400" : "text-teal-700")} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Toggle favorite for ${workspace.path}`}
            title="Toggle favorite"
            onClick={() => onToggleFavorite(workspace.path)}
          >
            <Star className={cn("h-4 w-4", workspace.favorite ? "fill-amber-400 text-amber-500" : "text-slate-500")} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete workspace ${workspace.path}`}
            title="Delete workspace"
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => onDelete(workspace.path)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
};
