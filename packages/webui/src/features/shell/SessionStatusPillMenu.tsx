import { AlertTriangle, Ban, ChevronDown, LoaderCircle, Pause, Play, Square } from "lucide-react";

import { ButtonLabel, ButtonLeadingVisual, ButtonTrailingVisual } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";

export type SessionStatusTone = "neutral" | "active" | "warning" | "danger";

interface SessionStatusPillMenuProps {
  statusLabel: string;
  tone?: SessionStatusTone;
  triggerVariant?: "pill" | "icon";
  primaryActionLabel: string;
  primaryActionDisabled?: boolean;
  primaryActionPending?: boolean;
  onPrimaryAction: () => void;
  abortDisabled?: boolean;
  abortPending?: boolean;
  onAbort?: () => void;
  className?: string;
}

const TRIGGER_TONE_CLASS_NAME: Record<SessionStatusTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80",
  warning: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100/80",
  danger: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100/80",
};

const DOT_TONE_CLASS_NAME: Record<SessionStatusTone, string> = {
  neutral: "bg-slate-400",
  active: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

const ICON_TRIGGER_TONE_CLASS_NAME: Record<SessionStatusTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80",
  warning: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/80",
  danger: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100/80",
};

const primaryActionIsStop = (label: string): boolean => label.toLowerCase().startsWith("stop");

const resolveStatusIcon = (input: { statusLabel: string; tone: SessionStatusTone }) => {
  const normalized = input.statusLabel.toLowerCase();
  if (normalized.includes("starting")) {
    return {
      Icon: LoaderCircle,
      iconClassName: "animate-spin",
    };
  }
  if (normalized.includes("paused")) {
    return {
      Icon: Pause,
      iconClassName: "",
    };
  }
  if (normalized.includes("error") || input.tone === "danger") {
    return {
      Icon: AlertTriangle,
      iconClassName: "",
    };
  }
  if (normalized.includes("running") || input.tone === "active") {
    return {
      Icon: Play,
      iconClassName: "",
    };
  }
  return {
    Icon: Square,
    iconClassName: "",
  };
};

export const SessionStatusPillMenu = ({
  statusLabel,
  tone = "neutral",
  triggerVariant = "pill",
  primaryActionLabel,
  primaryActionDisabled = false,
  primaryActionPending = false,
  onPrimaryAction,
  abortDisabled = false,
  abortPending = false,
  onAbort,
  className,
}: SessionStatusPillMenuProps) => {
  const showStop = primaryActionIsStop(primaryActionLabel);
  const statusIcon = resolveStatusIcon({ statusLabel, tone });
  const StatusIcon = statusIcon.Icon;

  const trigger = (
    <DropdownMenuTrigger
      aria-label={`Session status: ${statusLabel}`}
      title={statusLabel}
      data-testid="session-status-pill-trigger"
      className={cn(
        triggerVariant === "icon"
          ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border p-0 shadow-xs [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0"
          : "max-w-full rounded-full border px-3 py-1.5 text-xs shadow-xs",
        triggerVariant === "icon" ? ICON_TRIGGER_TONE_CLASS_NAME[tone] : TRIGGER_TONE_CLASS_NAME[tone],
        className,
      )}
    >
      {triggerVariant === "icon" ? (
        <StatusIcon className={cn("h-4 w-4", statusIcon.iconClassName)} />
      ) : (
        <>
          <ButtonLeadingVisual>
            <span className={cn("h-2 w-2 rounded-full", DOT_TONE_CLASS_NAME[tone])} />
          </ButtonLeadingVisual>
          <ButtonLabel>
            <span className="truncate font-medium">{statusLabel}</span>
          </ButtonLabel>
          <ButtonTrailingVisual>
            <ChevronDown className="h-3.5 w-3.5" />
          </ButtonTrailingVisual>
        </>
      )}
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {triggerVariant === "icon" ? <Tooltip content={statusLabel}>{trigger}</Tooltip> : trigger}

      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuLabel>Session actions</DropdownMenuLabel>
        <div className="px-2 pb-1 text-xs text-slate-500">{statusLabel}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={primaryActionDisabled || primaryActionPending} onClick={onPrimaryAction}>
          {primaryActionPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : showStop ? (
            <Square className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span>{primaryActionLabel}</span>
        </DropdownMenuItem>
        {onAbort ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={abortDisabled || abortPending}
              onClick={onAbort}
              className="text-rose-700 data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-800"
            >
              {abortPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              <span>Abort session</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
