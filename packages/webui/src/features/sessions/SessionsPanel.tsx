import type { SessionEntry } from "@agenter/client-sdk";
import { Clock3, Play, Plus, Square, Trash2 } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

interface SessionsPanelProps {
  sessions: SessionEntry[];
  activeSessionId: string | null;
  showAll: boolean;
  onToggleShowAll: () => void;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}

const statusVariant = (status: SessionEntry["status"]): "success" | "warning" | "destructive" | "secondary" => {
  if (status === "running") {
    return "success";
  }
  if (status === "starting") {
    return "warning";
  }
  if (status === "error") {
    return "destructive";
  }
  return "secondary";
};

export const SessionsPanel = ({
  sessions,
  activeSessionId,
  showAll,
  onToggleShowAll,
  onSelect,
  onCreate,
  onStart,
  onStop,
  onDelete,
}: SessionsPanelProps) => {
  return (
    <section className="flex h-full flex-col gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Work Sessions</h2>
          <button
            type="button"
            onClick={onToggleShowAll}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            <Clock3 className="h-3.5 w-3.5" />
            {showAll ? "Recent 8" : "Show all"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" onClick={onCreate} title="Create session (Ctrl/Cmd+N)">
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
          <Button size="sm" variant="secondary" onClick={onStart} disabled={!activeSessionId}>
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
          <Button size="sm" variant="secondary" onClick={onStop} disabled={!activeSessionId}>
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={!activeSessionId}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto">
        {sessions.length === 0 ? <p className="text-xs text-slate-500">No entries yet.</p> : null}
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect(session.id)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-left transition-colors",
              session.id === activeSessionId
                ? "bg-teal-50 text-teal-950"
                : "bg-white text-slate-800 hover:bg-slate-100",
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{session.name}</span>
              <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
            </div>
            <p className="truncate text-[11px] text-slate-600">{session.cwd}</p>
          </button>
        ))}
      </div>
    </section>
  );
};
