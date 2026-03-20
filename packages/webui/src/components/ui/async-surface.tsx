import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export type AsyncSurfaceState = "empty-loading" | "empty-idle" | "ready-loading" | "ready-idle";

interface AsyncSurfaceProps {
  state: AsyncSurfaceState;
  empty: ReactNode;
  skeleton?: ReactNode;
  loadingOverlayLabel?: string;
  className?: string;
  viewportClassName?: string;
  children?: ReactNode;
}

export const resolveAsyncSurfaceState = (input: { loading: boolean; hasData: boolean }): AsyncSurfaceState => {
  if (input.hasData) {
    return input.loading ? "ready-loading" : "ready-idle";
  }
  return input.loading ? "empty-loading" : "empty-idle";
};

export const AsyncSurface = ({
  state,
  empty,
  skeleton,
  loadingOverlayLabel = "Refreshing…",
  className,
  viewportClassName,
  children,
}: AsyncSurfaceProps) => {
  if (state === "empty-loading") {
    return <div className={cn("flex basis-0 flex-col", className)}>{skeleton ?? empty}</div>;
  }

  if (state === "empty-idle") {
    return <div className={cn("flex basis-0 flex-col", className)}>{empty}</div>;
  }

  return (
    <div className={cn("relative grid basis-0 grid-rows-[minmax(0,1fr)]", className)}>
      {viewportClassName ? <div className={viewportClassName}>{children}</div> : children}
      {state === "ready-loading" ? (
        <div className="pointer-events-none absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/92 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          <span>{loadingOverlayLabel}</span>
        </div>
      ) : null}
    </div>
  );
};
