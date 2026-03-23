import type { RuntimeConnectionStatus } from "@agenter/client-sdk";
import { Bot, FolderTree, LoaderCircle, PanelLeftOpen, PlugZap, TriangleAlert, WifiOff } from "lucide-react";
import { memo, useCallback, type ReactNode } from "react";

import { Tabs, type TabItem } from "../../components/ui/tabs";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";
import { surfaceToneClassName } from "../../components/ui/surface";
import { IconAction } from "./IconAction";
import { StatusSignal } from "./StatusSignal";

type WorkspaceShellTab = "chat" | "devtools" | "settings";

interface TopHeaderProps {
  locationLabel: string;
  showNavigationTrigger: boolean;
  connectionStatus: RuntimeConnectionStatus;
  aiStatus: string | null;
  onOpenNavigation: () => void;
  routeStatusSlot?: ReactNode;
  workspace?: {
    workspacePath: string;
    workspaceMissing?: boolean;
    activeTab: WorkspaceShellTab;
    onNavigate: (tab: WorkspaceShellTab) => void;
  };
}

const TAB_ITEMS: TabItem[] = [
  { id: "chat", label: "Chat" },
  { id: "devtools", label: "Devtools" },
  { id: "settings", label: "Settings" },
];

const basenamePath = (value: string): string => value.split(/[\\/]+/).filter(Boolean).at(-1) ?? value;

const connectionMeta = (
  status: RuntimeConnectionStatus,
): {
  label: string;
  tone: "muted" | "success" | "warning" | "danger";
  icon: typeof PlugZap;
  iconClassName?: string;
} => {
  if (status === "offline") {
    return {
      label: "Offline",
      tone: "danger",
      icon: WifiOff,
    };
  }
  if (status === "reconnecting") {
    return {
      label: "Reconnecting",
      tone: "warning",
      icon: LoaderCircle,
      iconClassName: "animate-spin",
    };
  }
  if (status === "connecting") {
    return {
      label: "Connecting",
      tone: "muted",
      icon: LoaderCircle,
      iconClassName: "animate-spin",
    };
  }
  return {
    label: "Connected",
    tone: "success",
    icon: PlugZap,
  };
};

const aiTone = (status: string): "muted" | "success" | "warning" | "danger" => {
  if (status === "error") {
    return "danger";
  }
  if (status === "attention" || status === "starting") {
    return "warning";
  }
  if (status === "running" || status === "active" || status === "working") {
    return "success";
  }
  return "muted";
};

export const TopHeader = memo(
  ({
    locationLabel,
    showNavigationTrigger,
    connectionStatus,
    aiStatus,
    onOpenNavigation,
    routeStatusSlot,
    workspace,
  }: TopHeaderProps) => {
    const compactChrome = showNavigationTrigger;
    const transport = connectionMeta(connectionStatus);
    const handleWorkspaceTabChange = useCallback(
      (value: string) => {
        if (!workspace) {
          return;
        }
        workspace.onNavigate(value === "devtools" || value === "settings" ? value : "chat");
      },
      [workspace],
    );

    return (
      <header className={cn(surfaceToneClassName("chrome"), "border-b border-slate-200/80")} data-testid="top-header">
        <div className="grid gap-2 px-3 py-2.5 md:px-4 md:py-3">
          {/* TopHeader is route-local chrome only. GlobalSettings belongs to SidebarNav/Drawer and must not be duplicated here. */}
          <div className={cn("flex items-center gap-2", compactChrome && "gap-1.5")}>
            {showNavigationTrigger ? (
              <IconAction label="Open navigation" icon={PanelLeftOpen} variant="ghost" onClick={onOpenNavigation} />
            ) : null}

            <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", compactChrome && "gap-1.5")}>
              <h1 className="font-nav text-[15px] font-semibold tracking-tight text-slate-900">agenter</h1>
              {!compactChrome || !workspace ? (
                <span className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">{locationLabel}</span>
              ) : null}
              {workspace ? (
                compactChrome ? (
                  routeStatusSlot ? null : (
                    <StatusSignal
                      label={`Workspace ${workspace.workspacePath}${workspace.workspaceMissing ? " (missing)" : ""}`}
                      icon={workspace.workspaceMissing ? TriangleAlert : FolderTree}
                      tone={workspace.workspaceMissing ? "danger" : "muted"}
                      className="h-7 w-7"
                    />
                  )
                ) : (
                  <Tooltip
                    content={
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-slate-900">{workspace.workspacePath}</p>
                        {workspace.workspaceMissing ? <p className="text-[11px] text-rose-700">Workspace missing</p> : null}
                      </div>
                    }
                  >
                    <div
                      className={cn(
                        "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs",
                        "max-w-[min(48vw,18rem)]",
                        workspace.workspaceMissing
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : "border-slate-200 bg-white/90 text-slate-700",
                      )}
                      aria-label={`Workspace ${workspace.workspacePath}`}
                      title={workspace.workspacePath}
                      data-testid="workspace-basename-chip"
                    >
                      {workspace.workspaceMissing ? (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <FolderTree className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate font-medium">{basenamePath(workspace.workspacePath)}</span>
                    </div>
                  </Tooltip>
                )
              ) : null}
            </div>

            <div className={cn("flex items-center gap-1.5", compactChrome && "gap-1")}>
              {compactChrome && routeStatusSlot ? routeStatusSlot : null}
              <StatusSignal
                label={transport.label}
                icon={transport.icon}
                tone={transport.tone}
                iconClassName={transport.iconClassName}
              />
              {aiStatus ? <StatusSignal label={`AI ${aiStatus}`} icon={Bot} tone={aiTone(aiStatus)} /> : null}
            </div>
          </div>

          {workspace ? (
            <div className="border-t border-slate-200/70 pt-2">
              <Tabs items={TAB_ITEMS} value={workspace.activeTab} onValueChange={handleWorkspaceTabChange} />
            </div>
          ) : null}
        </div>
      </header>
    );
  },
);

TopHeader.displayName = "TopHeader";
