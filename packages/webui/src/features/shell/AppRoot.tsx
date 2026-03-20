import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppController, useRuntimeSelector } from "../../app-context";
import { NoticeBanner } from "../../components/ui/notice-banner";
import { ViewportMask } from "../../components/ui/overflow-surface";
import { Sheet } from "../../components/ui/sheet";
import { cn } from "../../lib/utils";
import { AppHeader } from "./AppHeader";
import { SidebarNav, SidebarNavContent, defaultPrimaryNavItems, type RunningSessionNavItem } from "./SidebarNav";
import {
  equalHeaderRuntimeState,
  equalRunningSessionsState,
  equalSessionChromeState,
  selectHeaderRuntimeState,
  selectRunningSessionsState,
  selectSessionChromeState,
  selectUnreadTotal,
} from "./runtime-selectors";
import { useAdaptiveViewport } from "./useAdaptiveViewport";

const routeLabelFromPath = (pathname: string): string => {
  if (pathname.startsWith("/workspace/")) {
    return "Workspace";
  }
  if (pathname === "/workspaces") {
    return "Workspaces";
  }
  if (pathname === "/settings") {
    return "Settings";
  }
  if (pathname === "/workspace/chat") {
    return "Chat";
  }
  if (pathname === "/workspace/devtools") {
    return "Devtools";
  }
  if (pathname === "/workspace/settings") {
    return "Settings";
  }
  return "Quick Start";
};

const resolveWorkspaceTarget = (
  pathname: string,
): "/workspace/chat" | "/workspace/devtools" | "/workspace/settings" => {
  if (pathname === "/workspace/devtools") {
    return "/workspace/devtools";
  }
  if (pathname === "/workspace/settings") {
    return "/workspace/settings";
  }
  return "/workspace/chat";
};

const resolveHeaderAiStatus = (
  routeSession: { status: string } | null,
  routeRuntime?: { started: boolean; loopPhase: string } | null,
): string | null => {
  if (routeRuntime?.started) {
    return routeRuntime.loopPhase === "waiting_commits" ? "ready" : "working";
  }
  if (routeSession?.status === "error") {
    return "attention";
  }
  if (routeSession?.status === "starting") {
    return "starting";
  }
  return null;
};

export const AppRoot = () => {
  const controller = useAppController();
  const navigate = useNavigate();
  const location = useRouterState({
    select: (state) => state.location,
  });
  const adaptiveViewport = useAdaptiveViewport();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const connected = useRuntimeSelector((state) => state.connected);
  const connectionStatus = useRuntimeSelector((state) => state.connectionStatus);
  const unreadTotal = useRuntimeSelector(selectUnreadTotal);
  const hydrateSession = controller.hydrateSession;
  const retainApiCallStream = controller.retainApiCallStream;

  const searchParams =
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const routeSessionId = searchParams.get("sessionId") ?? undefined;
  const routeSession = useRuntimeSelector(selectSessionChromeState(routeSessionId), equalSessionChromeState);
  const routeRuntime = useRuntimeSelector(selectHeaderRuntimeState(routeSessionId), equalHeaderRuntimeState);
  const runningSessionStates = useRuntimeSelector(selectRunningSessionsState, equalRunningSessionsState);

  const handleOpenNavigation = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const handleSelectQuickStart = useCallback(() => {
    void navigate({ to: "/" });
    setMobileSidebarOpen(false);
  }, [navigate]);

  const handleSelectWorkspaces = useCallback(() => {
    void navigate({ to: "/workspaces" });
    setMobileSidebarOpen(false);
  }, [navigate]);

  const handleSelectSettings = useCallback(() => {
    void navigate({ to: "/settings" });
    setMobileSidebarOpen(false);
  }, [navigate]);

  useEffect(() => {
    if (!connected || !routeSessionId) {
      return;
    }
    void hydrateSession(routeSessionId);
  }, [connected, hydrateSession, routeSessionId]);

  useEffect(() => {
    if (!connected || location.pathname !== "/workspace/devtools" || !routeSessionId) {
      return;
    }
    return retainApiCallStream(routeSessionId);
  }, [connected, location.pathname, retainApiCallStream, routeSessionId]);

  const primaryItems = useMemo(
    () =>
      defaultPrimaryNavItems({
        quickStartActive: location.pathname === "/",
        workspacesActive: location.pathname === "/workspaces",
        settingsActive: location.pathname === "/settings",
        unreadWorkspaces: unreadTotal,
        onSelectQuickStart: handleSelectQuickStart,
        onSelectWorkspaces: handleSelectWorkspaces,
        onSelectSettings: handleSelectSettings,
      }),
    [handleSelectQuickStart, handleSelectSettings, handleSelectWorkspaces, location.pathname, unreadTotal],
  );

  const runningSessions = useMemo<RunningSessionNavItem[]>(() => {
    const targetRoute = resolveWorkspaceTarget(location.pathname);

    return runningSessionStates
      .map((session) => ({
        sessionId: session.sessionId,
        name: session.name,
        workspacePath: session.workspacePath,
        iconUrl: controller.runtimeStore.sessionIconUrl(session.sessionId),
        active: session.sessionId === routeSessionId,
        unreadCount: session.unreadCount,
        status: session.status,
        onSelect: () => {
          void navigate({
            to: targetRoute,
            search: { workspacePath: session.workspacePath, sessionId: session.sessionId },
          });
          setMobileSidebarOpen(false);
        },
      }))
      .sort((left, right) => {
        if (left.active !== right.active) {
          return left.active ? -1 : 1;
        }
        if (left.unreadCount !== right.unreadCount) {
          return right.unreadCount - left.unreadCount;
        }
        return left.name.localeCompare(right.name);
      });
  }, [controller.runtimeStore, location.pathname, navigate, routeSessionId, runningSessionStates]);

  const showGlobalNotice =
    controller.notice.length > 0 && (location.pathname === "/" || location.pathname === "/workspaces");
  const isWorkspaceRoute = location.pathname.startsWith("/workspace/");
  const showSidebarRail = adaptiveViewport.globalNavMode === "rail";
  const showDrawerTrigger = adaptiveViewport.globalNavMode === "drawer";

  return (
    <main className="h-dvh bg-[radial-gradient(circle_at_top,#e2f2ff,#f8fafc_48%)] text-slate-900">
      <ViewportMask className="h-full">
        <div className="flex h-full">
          {showSidebarRail ? <SidebarNav primaryItems={primaryItems} runningSessions={runningSessions} /> : null}

          <section className="flex min-w-0 flex-1 flex-col">
            <AppHeader
              locationLabel={routeLabelFromPath(location.pathname)}
              showNavigationTrigger={showDrawerTrigger}
              connectionStatus={connectionStatus}
              aiStatus={resolveHeaderAiStatus(routeSession, routeRuntime)}
              onOpenNavigation={handleOpenNavigation}
            />

            <ViewportMask className="flex-1">
              <div
                className={cn(
                  "grid h-full",
                  showGlobalNotice ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)]",
                )}
              >
                {showGlobalNotice ? (
                  <div className="shrink-0 px-3 pt-3 md:px-4 md:pt-4">
                    <NoticeBanner tone="destructive">{controller.notice}</NoticeBanner>
                  </div>
                ) : null}

                {isWorkspaceRoute ? (
                  <ViewportMask className="h-full">
                    <Outlet />
                  </ViewportMask>
                ) : (
                  <div className="h-full px-3 py-3 md:px-4 md:py-4">
                    <Outlet />
                  </div>
                )}
              </div>
            </ViewportMask>
          </section>
        </div>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} side="left" title="Navigation">
          <SidebarNavContent primaryItems={primaryItems} runningSessions={runningSessions} compact />
        </Sheet>
      </ViewportMask>
    </main>
  );
};
