import { memo } from "react";
import type { RuntimeConnectionStatus } from "@agenter/client-sdk";
import { PanelLeftOpen } from "lucide-react";

import { surfaceToneClassName } from "../../components/ui/surface";
import { cn } from "../../lib/utils";
import { transportStatusMeta } from "../../shared/status-meta";
import { IconAction } from "./IconAction";

interface AppHeaderProps {
  locationLabel: string;
  showNavigationTrigger: boolean;
  connectionStatus: RuntimeConnectionStatus;
  aiStatus: string | null;
  onOpenNavigation: () => void;
}

const aiToneClassName = (status: string): string => {
  if (status === "error") {
    return "text-rose-700";
  }
  if (status === "attention" || status === "starting") {
    return "text-amber-700";
  }
  if (status === "running" || status === "active" || status === "working") {
    return "text-emerald-700";
  }
  if (status === "idle" || status === "ready" || status === "stopped") {
    return "text-slate-500";
  }
  return "text-slate-500";
};

export const AppHeader = memo(({
  locationLabel,
  showNavigationTrigger,
  connectionStatus,
  aiStatus,
  onOpenNavigation,
}: AppHeaderProps) => {
  const transport = transportStatusMeta(connectionStatus);
  return (
    // AppHeader is passive global chrome only. Workspace identity, route tabs,
    // and session actions stay inside workspace-local scaffold surfaces.
    <header className={cn(surfaceToneClassName("chrome"), "border-b border-slate-200")}>
      <div className="flex items-start gap-3 px-3 py-3 md:px-4">
        {showNavigationTrigger ? (
          <IconAction label="Open navigation" icon={PanelLeftOpen} variant="ghost" onClick={onOpenNavigation} />
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-nav text-base font-semibold tracking-tight text-slate-900">agenter</h1>
            <span className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
              {locationLabel}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={cn("font-medium", transport.className)}>{transport.label}</span>
            {aiStatus ? <span className={cn("font-medium", aiToneClassName(aiStatus))}>{`AI ${aiStatus}`}</span> : null}
          </div>
        </div>
      </div>
    </header>
  );
});

AppHeader.displayName = "AppHeader";
