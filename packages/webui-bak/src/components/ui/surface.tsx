import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "../../lib/utils";

type DivProps = ComponentPropsWithoutRef<"div">;
export type SurfaceTone = "chrome" | "panel" | "inset";

const SURFACE_TONE_CLASS_NAMES: Record<SurfaceTone, string> = {
  chrome: "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/92",
  panel: "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80",
  inset: "rounded-xl bg-slate-50 ring-1 ring-slate-200/70",
};

export const surfaceToneClassName = (tone: SurfaceTone): string => SURFACE_TONE_CLASS_NAMES[tone];

export const Surface = forwardRef<HTMLDivElement, DivProps & { tone?: SurfaceTone }>(
  ({ tone = "panel", className, ...props }, ref) => {
    return <div ref={ref} data-surface-tone={tone} className={cn(surfaceToneClassName(tone), className)} {...props} />;
  },
);

Surface.displayName = "Surface";
