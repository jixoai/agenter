import type { LucideIcon } from "lucide-react";

import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";

interface StatusSignalProps {
  label: string;
  icon: LucideIcon;
  tone?: "muted" | "success" | "warning" | "danger";
  className?: string;
  iconClassName?: string;
}

const TONE_CLASS_NAME: Record<NonNullable<StatusSignalProps["tone"]>, string> = {
  muted: "border-slate-200 bg-white/90 text-slate-500",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export const StatusSignal = ({
  label,
  icon: Icon,
  tone = "muted",
  className,
  iconClassName,
}: StatusSignalProps) => {
  return (
    <Tooltip content={label}>
      <span
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-xs",
          TONE_CLASS_NAME[tone],
          className,
        )}
      >
        <Icon className={cn("h-4 w-4", iconClassName)} />
      </span>
    </Tooltip>
  );
};
