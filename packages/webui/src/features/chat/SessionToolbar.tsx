import { Ban, LoaderCircle, MoreHorizontal, Play, Square } from "lucide-react";

import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/utils";

export type SessionToolbarTone = "neutral" | "active" | "warning" | "danger";

interface SessionToolbarProps {
  sessionStateLabel: string;
  sessionStateTone?: SessionToolbarTone;
  actionLabel: string;
  actionDisabled?: boolean;
  actionPending?: boolean;
  onAction: () => void;
  abortDisabled?: boolean;
  abortPending?: boolean;
  onAbort?: () => void;
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
  abortDisabled = false,
  abortPending = false,
  onAbort,
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

      <div className="flex items-center gap-2">
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

        {onAbort ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Session actions"
              title="Session actions"
              className="rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Advanced actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={abortDisabled || abortPending}
                onClick={onAbort}
                className="text-rose-700 data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-800"
              >
                {abortPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                <span>Abort session</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
};
