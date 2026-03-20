import { MessageSquare, Settings2, Wrench } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { ViewportMask } from "../../components/ui/overflow-surface";
import { BottomNavBar } from "./BottomNavBar";
import { useAdaptiveViewport, type WorkspaceNavMode } from "./useAdaptiveViewport";
import { WorkspaceHeader } from "./WorkspaceHeader";

type WorkspaceShellTab = "chat" | "devtools" | "settings";

interface WorkspaceShellFrameProps {
  workspacePath: string;
  workspaceMissing?: boolean;
  activeTab: WorkspaceShellTab;
  onNavigate: (tab: WorkspaceShellTab) => void;
  navMode?: WorkspaceNavMode;
  headerActions?: ReactNode;
  children: ReactNode;
}

export const WorkspaceShellFrame = ({
  workspacePath,
  workspaceMissing = false,
  activeTab,
  onNavigate,
  navMode,
  headerActions,
  children,
}: WorkspaceShellFrameProps) => {
  const adaptiveViewport = useAdaptiveViewport();
  const resolvedNavMode = navMode ?? adaptiveViewport.workspaceNavMode;
  const shellItems = useMemo(
    () =>
      [
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
      ] as const,
    [activeTab, onNavigate],
  );

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="shrink-0 px-3 pt-3 md:px-4 md:pt-4">
        <WorkspaceHeader
          workspacePath={workspacePath}
          workspaceMissing={workspaceMissing}
          activeTab={activeTab}
          navMode={resolvedNavMode}
          onNavigate={onNavigate}
          actions={headerActions}
        />
      </div>

      <ViewportMask className="h-full px-3 py-3 md:px-4 md:py-4">{children}</ViewportMask>

      {resolvedNavMode === "bottom" ? (
        <div className="shrink-0">
          <BottomNavBar items={shellItems} />
        </div>
      ) : null}
    </div>
  );
};
