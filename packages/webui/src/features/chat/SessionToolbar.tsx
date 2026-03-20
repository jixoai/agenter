import { LoaderCircle, Play, Square } from "lucide-react";

import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { cn } from "../../lib/utils";

export type SessionToolbarTone = "neutral" | "active" | "warning" | "danger";

interface SessionToolbarProps {
  sessionStateLabel: string;
  sessionStateTone?: SessionToolbarTone;
  actionLabel: string;
  actionDisabled?: boolean;
  actionPending?: boolean;
  onAction: () => void;
}

const toneClassName = (tone: SessionToolbarTone): string => {
  if (tone === "active") {
    return "bg-emerald-500";
  }
  if (tone === "warning") {
    return "bg-amber-500";
  }
  if (tone === "danger") {
    return "bg-rose-500";
  }
  return "bg-slate-400";
};

export const SessionToolbar = ({
  sessionStateLabel,
  sessionStateTone = "neutral",
  actionLabel,
  actionDisabled = false,
  actionPending = false,
  onAction,
}: SessionToolbarProps) => {
  const showStop = actionLabel.toLowerCase().startsWith("stop");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Session</span>
        <div className="flex min-w-0 items-center gap-x-2 gap-y-1">
          <span className={cn("inline-flex h-2 w-2 rounded-full", toneClassName(sessionStateTone))} />
          <span className="font-medium text-slate-600">{sessionStateLabel}</span>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant={showStop ? "outline" : "default"}
        onClick={onAction}
        disabled={actionDisabled || actionPending}
      >
        <ButtonLeadingVisual>
          {actionPending ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : showStop ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </ButtonLeadingVisual>
        <ButtonLabel>{actionLabel}</ButtonLabel>
      </Button>
    </div>
  );
};
