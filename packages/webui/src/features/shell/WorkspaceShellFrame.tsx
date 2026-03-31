import { type ReactNode } from "react";

import type { TabItem } from "../../components/ui/tabs";
import { ViewportMask } from "../../components/ui/overflow-surface";
import { useShellLayout } from "./shell-layout-context";
import { TopHeader } from "./TopHeader";

interface WorkspaceShellFrameProps {
  locationLabel: string;
  workspacePath: string;
  workspaceMissing?: boolean;
  activeTab: string;
  tabs: TabItem[];
  onNavigate: (tab: string) => void;
  headerStatusSlot?: ReactNode;
  children: ReactNode;
}

export const WorkspaceShellFrame = ({
  locationLabel,
  workspacePath,
  workspaceMissing = false,
  activeTab,
  tabs,
  onNavigate,
  headerStatusSlot,
  children,
}: WorkspaceShellFrameProps) => {
  const shellLayout = useShellLayout();

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      <TopHeader
        locationLabel={locationLabel}
        showNavigationTrigger={shellLayout.showNavigationTrigger}
        connectionStatus={shellLayout.connectionStatus}
        aiStatus={shellLayout.aiStatus}
        onOpenNavigation={shellLayout.onOpenNavigation}
        routeStatusSlot={headerStatusSlot}
        workspace={{
          workspacePath,
          activeTab,
          tabs,
          workspaceMissing,
          onNavigate,
        }}
      />

      <ViewportMask className="h-full min-w-0 px-2.5 py-2.5 md:px-3 md:py-3">{children}</ViewportMask>
    </div>
  );
};
