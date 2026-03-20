import { memo, useCallback, type ReactNode } from "react";

import { Tabs, type TabItem } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import type { WorkspaceNavMode } from "./useAdaptiveViewport";

type WorkspaceShellTab = "chat" | "devtools" | "settings";

interface WorkspaceHeaderProps {
  workspacePath: string;
  workspaceMissing?: boolean;
  activeTab: WorkspaceShellTab;
  navMode: WorkspaceNavMode;
  onNavigate: (tab: WorkspaceShellTab) => void;
  actions?: ReactNode;
}

const tabItems: TabItem[] = [
  { id: "chat", label: "Chat" },
  { id: "devtools", label: "Devtools" },
  { id: "settings", label: "Settings" },
];

const basenamePath = (value: string): string => value.split(/[\\/]+/).filter(Boolean).at(-1) ?? value;

const routeLabel = (tab: WorkspaceShellTab): string => {
  if (tab === "devtools") {
    return "Devtools";
  }
  if (tab === "settings") {
    return "Settings";
  }
  return "Chat";
};

export const WorkspaceHeader = memo(({
  workspacePath,
  workspaceMissing = false,
  activeTab,
  navMode,
  onNavigate,
  actions,
}: WorkspaceHeaderProps) => {
  const handleValueChange = useCallback(
    (value: string) => {
      onNavigate(value as WorkspaceShellTab);
    },
    [onNavigate],
  );

  return (
    <section className="rounded-[1.35rem] border border-slate-200/80 bg-white/72 px-3 py-3 backdrop-blur md:px-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
            <span className="text-[11px] font-medium text-slate-400">/</span>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{routeLabel(activeTab)}</p>
            {workspaceMissing ? <span className="text-[11px] font-medium text-rose-700">Missing</span> : null}
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">{basenamePath(workspacePath)}</h2>
            <p className="hidden min-w-0 text-xs text-slate-500 md:block" title={workspacePath}>
              {workspacePath}
            </p>
          </div>
        </div>

        {actions ? <div className="flex min-w-0 max-w-full flex-1 justify-end">{actions}</div> : null}
      </div>

      {navMode === "top" ? (
        <div className={cn("mt-3 flex items-center justify-start", actions ? "border-t border-slate-200/80 pt-3" : "")}>
          <Tabs items={tabItems} value={activeTab} onValueChange={handleValueChange} />
        </div>
      ) : null}
    </section>
  );
});

WorkspaceHeader.displayName = "WorkspaceHeader";
