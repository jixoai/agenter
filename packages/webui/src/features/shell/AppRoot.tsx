import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppController, useRuntimeSelector } from "../../app-context";
import { NoticeBanner } from "../../components/ui/notice-banner";
import { ViewportMask } from "../../components/ui/overflow-surface";
import { Sheet } from "../../components/ui/sheet";
import { cn } from "../../lib/utils";
import { buildSessionDevtoolsSearch } from "../attention/attention-devtools-route";
import { useIconServiceUrls } from "../profile/icon-service";
import { SidebarNav, SidebarNavContent, defaultPrimaryNavItems, type RunningSessionNavItem } from "./SidebarNav";
import { TopHeader } from "./TopHeader";
import {
  equalHeaderRuntimeState,
  equalRunningSessionsState,
  equalSessionChromeState,
  selectHeaderRuntimeState,
  selectRunningSessionsState,
  selectSessionChromeState,
  selectUnreadTotal,
} from "./runtime-selectors";
import { ShellLayoutProvider } from "./shell-layout-context";
import { useAdaptiveViewport } from "./useAdaptiveViewport";

const SESSION_ROUTE_PATH_RE = /^\/session\/([^/]+)\/(chats|terminals|devtools|settings)$/;
const DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY = "agenter:webui:desktop-sidebar-collapsed";

const readDesktopSidebarCollapsed = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const extractSessionIdFromPath = (pathname: string): string | undefined => {
  const match = SESSION_ROUTE_PATH_RE.exec(pathname);
  return match?.[1];
};

const isSessionRoutePath = (pathname: string): boolean => SESSION_ROUTE_PATH_RE.test(pathname);

const isSessionDevtoolsPath = (pathname: string): boolean => {
  const match = SESSION_ROUTE_PATH_RE.exec(pathname);
  return match?.[2] === "devtools";
};

const resolveSessionTabPath = (pathname: string): "/chats" | "/terminals" | "/devtools" | "/settings" => {
  const match = SESSION_ROUTE_PATH_RE.exec(pathname);
  const tab = match?.[2];
  if (tab === "terminals") {
    return "/terminals";
  }
  if (tab === "devtools") {
    return "/devtools";
  }
  if (tab === "settings") {
    return "/settings";
  }
  return "/chats";
};

const routeLabelFromPath = (pathname: string): string => {
  const sessionMatch = SESSION_ROUTE_PATH_RE.exec(pathname);
  if (sessionMatch) {
    const tab = sessionMatch[2];
    if (tab === "terminals") {
      return "Terminals";
    }
    if (tab === "settings") {
      return "Settings";
    }
    if (tab === "devtools") {
      return "Devtools";
    }
    return "Chats";
  }
  if (pathname.startsWith("/workspace/")) {
    return "Workspace";
  }
  if (pathname === "/workspaces") {
    return "Workspaces";
  }
  if (pathname === "/terminals") {
    return "Terminals";
  }
  if (pathname === "/settings") {
    return "Settings";
  }
  return "Quick Start";
};

const resolveHeaderAiStatus = (
  routeSession: { status: string } | null,
  routeRuntime?: {
    started: boolean;
    schedulerPhase: string;
    scheduler?: { runtimeStatus: string; unresolvedScoreCount?: number } | null;
  } | null,
): string | null => {
  if (routeRuntime?.started) {
    if (routeRuntime.scheduler?.runtimeStatus === "backoff" || routeRuntime.scheduler?.runtimeStatus === "waiting") {
      return "working";
    }
    return routeRuntime.schedulerPhase === "waiting_commits" ? "ready" : "working";
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
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(readDesktopSidebarCollapsed);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const connected = useRuntimeSelector((state) => state.connected);
  const connectionStatus = useRuntimeSelector((state) => state.connectionStatus);
  const unreadTotal = useRuntimeSelector(selectUnreadTotal);
  const hydrateSession = controller.hydrateSession;
  const iconUrls = useIconServiceUrls(controller.runtimeStore);

  const routeSessionId = extractSessionIdFromPath(location.pathname) ?? undefined;
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

  const handleSelectTerminals = useCallback(() => {
    void navigate({ to: "/terminals" });
    setMobileSidebarOpen(false);
  }, [navigate]);

  useEffect(() => {
    if (!connected || !routeSessionId) {
      return;
    }
    void hydrateSession(routeSessionId);
  }, [connected, hydrateSession, routeSessionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY, desktopSidebarCollapsed ? "true" : "false");
    } catch {
      // Ignore storage failures; collapsed state can remain session-local.
    }
  }, [desktopSidebarCollapsed]);

  const primaryItems = useMemo(
    () =>
      defaultPrimaryNavItems({
        quickStartActive: location.pathname === "/",
        workspacesActive: location.pathname === "/workspaces",
        terminalsActive: location.pathname === "/terminals",
        settingsActive: location.pathname === "/settings",
        unreadWorkspaces: unreadTotal,
        onSelectQuickStart: handleSelectQuickStart,
        onSelectWorkspaces: handleSelectWorkspaces,
        onSelectTerminals: handleSelectTerminals,
        onSelectSettings: handleSelectSettings,
      }),
    [handleSelectQuickStart, handleSelectSettings, handleSelectTerminals, handleSelectWorkspaces, location.pathname, unreadTotal],
  );

  const runningSessions = useMemo<RunningSessionNavItem[]>(() => {
    return runningSessionStates
      .map((session) => ({
        sessionId: session.sessionId,
        name: session.name,
        workspacePath: session.workspacePath,
        iconUrl: iconUrls.session(session.sessionId) ?? undefined,
        active: session.sessionId === routeSessionId,
        unreadCount: session.unreadCount,
        status: session.status,
        onSelect: () => {
          const targetTabPath = resolveSessionTabPath(location.pathname);
          if (targetTabPath === "/devtools") {
            void navigate({
              to: "/session/$sessionId/devtools",
              params: { sessionId: session.sessionId },
              search: buildSessionDevtoolsSearch({ panel: "attention" }),
            });
            setMobileSidebarOpen(false);
            return;
          }
          if (targetTabPath === "/terminals") {
            void navigate({
              to: "/session/$sessionId/terminals",
              params: { sessionId: session.sessionId },
            });
            setMobileSidebarOpen(false);
            return;
          }
          if (targetTabPath === "/settings") {
            void navigate({
              to: "/session/$sessionId/settings",
              params: { sessionId: session.sessionId },
            });
            setMobileSidebarOpen(false);
            return;
          }
          void navigate({
            to: "/session/$sessionId/chats",
            params: { sessionId: session.sessionId },
            search: { chatId: undefined },
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
  }, [iconUrls, location.pathname, navigate, routeSessionId, runningSessionStates]);

  const showGlobalNotice =
    controller.notice.length > 0 && (location.pathname === "/" || location.pathname === "/workspaces");
  const isWorkspaceRoute = isSessionRoutePath(location.pathname);
  const showSidebarRail = adaptiveViewport.globalNavMode === "rail";
  const showDrawerTrigger = adaptiveViewport.globalNavMode === "drawer";
  const headerAiStatus = resolveHeaderAiStatus(routeSession, routeRuntime);

  return (
    <main className="h-dvh bg-[radial-gradient(circle_at_top,#e2f2ff,#f8fafc_48%)] text-slate-900">
      <ViewportMask className="h-full">
        <div className="flex h-full">
          {showSidebarRail ? (
            <SidebarNav
              primaryItems={primaryItems}
              runningSessions={runningSessions}
              collapsed={desktopSidebarCollapsed}
              onToggleCollapsed={() => setDesktopSidebarCollapsed((current) => !current)}
            />
          ) : null}

          <ShellLayoutProvider
            value={{
              showNavigationTrigger: showDrawerTrigger,
              connectionStatus,
              aiStatus: headerAiStatus,
              onOpenNavigation: handleOpenNavigation,
            }}
          >
            <section className="flex min-w-0 flex-1 flex-col">
              {/* GlobalSettings stays in SidebarNav/Drawer only. TopHeader is page-local chrome and must not absorb app-level settings entry points. */}
              {!isWorkspaceRoute ? (
                <TopHeader
                  locationLabel={routeLabelFromPath(location.pathname)}
                  showNavigationTrigger={showDrawerTrigger}
                  connectionStatus={connectionStatus}
                  aiStatus={headerAiStatus}
                  onOpenNavigation={handleOpenNavigation}
                />
              ) : null}

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
          </ShellLayoutProvider>
        </div>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} side="left" title="Navigation">
          <SidebarNavContent primaryItems={primaryItems} runningSessions={runningSessions} compact />
        </Sheet>
      </ViewportMask>
    </main>
  );
};
