import { Info } from "lucide-react";
import { useCallback, useState, type ComponentType, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Tooltip } from "./tooltip";

export type SurfaceSignalTone = "neutral" | "active" | "warning" | "danger";

interface SurfaceSignalDisclosureProps {
  label: string;
  title?: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: SurfaceSignalTone;
  children: ReactNode;
  footer?: ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  testId?: string;
}

const TONE_CLASS_NAME: Record<SurfaceSignalTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80",
  warning: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/80",
  danger: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100/80",
};

export const SurfaceSignalDisclosure = ({
  label,
  title,
  description,
  icon: Icon = Info,
  tone = "neutral",
  children,
  footer,
  triggerClassName,
  contentClassName,
  open: openProp,
  onOpenChange,
  testId,
}: SurfaceSignalDisclosureProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [onOpenChange, openProp],
  );

  const trigger = (
    <Button
      type="button"
      size="icon"
      variant="outline"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={() => setOpen(true)}
      className={cn("shrink-0", TONE_CLASS_NAME[tone], triggerClassName)}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      <Tooltip content={label}>{trigger}</Tooltip>
      <Dialog open={open} title={title ?? label} description={description} onClose={() => setOpen(false)} footer={footer}>
        <div className={cn("space-y-3", contentClassName)}>{children}</div>
      </Dialog>
    </>
  );
};
