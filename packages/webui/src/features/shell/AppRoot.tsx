import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useAppController, useRuntimeSelector } from "../../app-context";
import { NoticeBanner } from "../../components/ui/notice-banner";
import { ViewportMask } from "../../components/ui/overflow-surface";
import { Sheet } from "../../components/ui/sheet";
import { AppHeader } from "./AppHeader";
import { SidebarNav, SidebarNavContent, defaultPrimaryNavItems, type RunningSessionNavItem } from "./SidebarNav";
import { useCompactViewport } from "./useCompactViewport";

const unreadTotal = (record: Record<string, number>): number =>
  Object.values(record).reduce((total, value) => total + value, 0);

const routeLabelFromPath = (pathname: string): string => {
  if (pathname === "/workspaces") {
    return "Workspaces";
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

const isRunningSession = (sessionStatus: string): boolean =>
  sessionStatus === "running" || sessionStatus === "starting";

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
  const compactViewport = useCompactViewport();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const connected = useRuntimeSelector((state) => state.connected);
  const connectionStatus = useRuntimeSelector((state) => state.connectionStatus);
  const sessions = useRuntimeSelector((state) => state.sessions);
  const unreadBySession = useRuntimeSelector((state) => state.unreadBySession);
  const hydrateSession = controller.hydrateSession;
  const retainApiCallStream = controller.retainApiCallStream;

  const searchParams =
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const routeSessionId = searchParams.get("sessionId") ?? undefined;
  const routeSession = routeSessionId ? (sessions.find((item) => item.id === routeSessionId) ?? null) : null;
  const routeRuntime = useRuntimeSelector((state) => (routeSessionId ? state.runtimes[routeSessionId] : undefined));

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
        quickStartActive: location.pathname !== "/workspaces",
        workspacesActive: location.pathname === "/workspaces",
        unreadWorkspaces: unreadTotal(unreadBySession),
        onSelectQuickStart: () => {
          void navigate({ to: "/" });
          setMobileSidebarOpen(false);
        },
        onSelectWorkspaces: () => {
          void navigate({ to: "/workspaces" });
          setMobileSidebarOpen(false);
        },
      }),
    [location.pathname, navigate, unreadBySession],
  );

  const runningSessions = useMemo<RunningSessionNavItem[]>(() => {
    const targetRoute = resolveWorkspaceTarget(location.pathname);

    return sessions
      .filter((session) => isRunningSession(session.status))
      .map((session) => ({
        sessionId: session.id,
        name: session.name,
        workspacePath: session.cwd,
        active: session.id === routeSessionId,
        unreadCount: unreadBySession[session.id] ?? 0,
        status: session.status,
        onSelect: () => {
          void navigate({
            to: targetRoute,
            search: { workspacePath: session.cwd, sessionId: session.id },
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
  }, [location.pathname, navigate, routeSessionId, sessions, unreadBySession]);

  const showGlobalNotice =
    controller.notice.length > 0 && (location.pathname === "/" || location.pathname === "/workspaces");

  return (
    <main className="h-dvh bg-[radial-gradient(circle_at_top,#e2f2ff,#f8fafc_48%)] text-slate-900">
      <ViewportMask className="h-full">
        <div className="flex h-full">
          <SidebarNav primaryItems={primaryItems} runningSessions={runningSessions} />

          <section className="flex min-w-0 flex-1 flex-col">
            <AppHeader
              locationLabel={routeLabelFromPath(location.pathname)}
              compactViewport={compactViewport}
              connectionStatus={connectionStatus}
              aiStatus={resolveHeaderAiStatus(routeSession, routeRuntime)}
              onOpenNavigation={() => setMobileSidebarOpen(true)}
            />

            <div className="flex flex-1 flex-col">
              {showGlobalNotice ? (
                <div className="shrink-0 px-3 pt-3 md:px-4 md:pt-4">
                  <NoticeBanner tone="destructive">{controller.notice}</NoticeBanner>
                </div>
              ) : null}

              <div className="flex-1 px-3 py-3 md:px-4 md:py-4">
                <Outlet />
              </div>
            </div>
          </section>
        </div>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} side="left" title="Navigation">
          <SidebarNavContent primaryItems={primaryItems} runningSessions={runningSessions} compact />
        </Sheet>
      </ViewportMask>
    </main>
  );
};
