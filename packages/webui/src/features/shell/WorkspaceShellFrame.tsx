import { type ReactNode } from "react";

import { ViewportMask } from "../../components/ui/overflow-surface";
import { useShellLayout } from "./shell-layout-context";
import { TopHeader } from "./TopHeader";

type WorkspaceShellTab = "chat" | "devtools" | "settings";

interface WorkspaceShellFrameProps {
  workspacePath: string;
  workspaceMissing?: boolean;
  activeTab: WorkspaceShellTab;
  onNavigate: (tab: WorkspaceShellTab) => void;
  headerStatusSlot?: ReactNode;
  children: ReactNode;
}

export const WorkspaceShellFrame = ({
  workspacePath,
  workspaceMissing = false,
  activeTab,
  onNavigate,
  headerStatusSlot,
  children,
}: WorkspaceShellFrameProps) => {
  const shellLayout = useShellLayout();

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      <TopHeader
        locationLabel={activeTab === "devtools" ? "Devtools" : activeTab === "settings" ? "Settings" : "Chat"}
        showNavigationTrigger={shellLayout.showNavigationTrigger}
        connectionStatus={shellLayout.connectionStatus}
        aiStatus={shellLayout.aiStatus}
        onOpenNavigation={shellLayout.onOpenNavigation}
        routeStatusSlot={headerStatusSlot}
        workspace={{
          workspacePath,
          activeTab,
          workspaceMissing,
          onNavigate,
        }}
      />

      <ViewportMask className="h-full min-w-0 px-2.5 py-2.5 md:px-3 md:py-3">{children}</ViewportMask>
    </div>
  );
};
