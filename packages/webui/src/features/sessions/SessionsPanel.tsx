import type { SessionEntry } from "@agenter/client-sdk";
import { Clock3, Play, Plus, Square, Trash2 } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { ScrollViewport } from "../../components/ui/overflow-surface";
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
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="typo-title-3 text-slate-900">Work Sessions</h2>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onToggleShowAll}
          >
            <ButtonLeadingVisual>
              <Clock3 className="h-3.5 w-3.5" />
            </ButtonLeadingVisual>
            <ButtonLabel>{showAll ? "Recent 8" : "Show all"}</ButtonLabel>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" onClick={onCreate} title="Create session (Ctrl/Cmd+N)">
            <ButtonLeadingVisual>
              <Plus className="h-3.5 w-3.5" />
            </ButtonLeadingVisual>
            <ButtonLabel>New</ButtonLabel>
          </Button>
          <Button size="sm" variant="secondary" onClick={onStart} disabled={!activeSessionId}>
            <ButtonLeadingVisual>
              <Play className="h-3.5 w-3.5" />
            </ButtonLeadingVisual>
            <ButtonLabel>Start</ButtonLabel>
          </Button>
          <Button size="sm" variant="secondary" onClick={onStop} disabled={!activeSessionId}>
            <ButtonLeadingVisual>
              <Square className="h-3.5 w-3.5" />
            </ButtonLeadingVisual>
            <ButtonLabel>Stop</ButtonLabel>
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={!activeSessionId}>
            <ButtonLeadingVisual>
              <Trash2 className="h-3.5 w-3.5" />
            </ButtonLeadingVisual>
            <ButtonLabel>Delete</ButtonLabel>
          </Button>
        </div>
      </div>

      <ScrollViewport className="h-full space-y-2">
        {sessions.length === 0 ? <p className="typo-caption text-slate-500">No entries yet.</p> : null}
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
      </ScrollViewport>
    </section>
  );
};
