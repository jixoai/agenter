import { MessageSquare, Settings2, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { Tabs, type TabItem } from "../../components/ui/tabs";
import { BottomNavBar } from "./BottomNavBar";

type WorkspaceShellTab = "chat" | "devtools" | "settings";

interface WorkspaceShellFrameProps {
  workspacePath: string;
  workspaceMissing?: boolean;
  activeTab: WorkspaceShellTab;
  onNavigate: (tab: WorkspaceShellTab) => void;
  children: ReactNode;
}

const desktopTabItems: TabItem[] = [
  { id: "chat", label: "Chat" },
  { id: "devtools", label: "Devtools" },
  { id: "settings", label: "Settings" },
];

const basenamePath = (value: string): string => value.split(/[\\/]+/).filter(Boolean).at(-1) ?? value;

export const WorkspaceShellFrame = ({
  workspacePath,
  workspaceMissing = false,
  activeTab,
  onNavigate,
  children,
}: WorkspaceShellFrameProps) => {
  const shellItems = [
    {
      key: "chat",
      label: "Chat",
      icon: MessageSquare,
      active: activeTab === "chat",
      onClick: () => onNavigate("chat"),
    },
    {
      key: "devtools",
      label: "Devtools",
      icon: Wrench,
      active: activeTab === "devtools",
      onClick: () => onNavigate("devtools"),
    },
    {
      key: "settings",
      label: "Settings",
      icon: Settings2,
      active: activeTab === "settings",
      onClick: () => onNavigate("settings"),
    },
  ] as const;

  return (
    <div className="flex h-full flex-col">
      <section className="mb-2 shrink-0 border-b border-slate-200/80 px-1 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
              {workspaceMissing ? <span className="text-[11px] font-medium text-rose-700">Missing</span> : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">{basenamePath(workspacePath)}</h2>
              <p className="hidden min-w-0 text-xs text-slate-500 md:block" title={workspacePath}>
                {workspacePath}
              </p>
            </div>
          </div>

          <div className="hidden lg:block">
            <Tabs
              items={desktopTabItems}
              value={activeTab}
              onValueChange={(value) => onNavigate(value as WorkspaceShellTab)}
            />
          </div>
        </div>
      </section>

      <div className="flex-1">{children}</div>

      <div className="mt-2 lg:hidden">
        <BottomNavBar items={[...shellItems]} />
      </div>
    </div>
  );
};
