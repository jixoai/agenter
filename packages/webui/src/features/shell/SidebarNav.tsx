import { ChevronLeft, ChevronRight, FolderTree, MessageSquare, Settings2, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual, ButtonTrailingVisual } from "../../components/ui/button";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { ProfileImage } from "../../components/ui/profile-image";
import { surfaceToneClassName } from "../../components/ui/surface";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";
import { sessionStatusMeta } from "../../shared/status-meta";

type SidebarPrimaryKey = "quickstart" | "workspaces" | "settings";

interface NavAvatar {
  label: string;
  hue: number;
}

export interface PrimaryNavItem {
  key: SidebarPrimaryKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  badgeCount?: number;
  onSelect: () => void;
}

export interface RunningSessionNavItem {
  sessionId: string;
  name: string;
  workspacePath: string;
  iconUrl?: string;
  active: boolean;
  unreadCount: number;
  status: string;
  onSelect: () => void;
}

interface SidebarNavProps {
  primaryItems: PrimaryNavItem[];
  runningSessions: RunningSessionNavItem[];
  compact?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  className?: string;
}

const isRunningStatus = (status: string): status is "stopped" | "starting" | "running" | "error" =>
  status === "running" || status === "starting" || status === "error" || status === "stopped";

const basenamePath = (value: string): string =>
  value
    .split(/[\\/]+/)
    .filter(Boolean)
    .at(-1) ?? value;

const hashPath = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
};

const createWorkspaceAvatar = (workspacePath: string): NavAvatar => ({
  label: basenamePath(workspacePath).slice(0, 1) || "W",
  hue: hashPath(workspacePath),
});

const SidebarSection = ({ label, collapsed }: { label: string; collapsed: boolean }) =>
  collapsed ? (
    <p className="sr-only">{label}</p>
  ) : (
    <div className="px-1">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">{label}</p>
    </div>
  );

const SidebarWorkspaceGlyph = ({ avatar }: { avatar: NavAvatar }) => (
  <span
    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
    style={{
      backgroundColor: `oklch(0.85 0.09 ${avatar.hue})`,
      color: `oklch(0.32 0.08 ${avatar.hue})`,
    }}
  >
    {avatar.label.toUpperCase()}
  </span>
);

const PrimaryButton = ({
  item,
  compact,
  collapsed,
}: {
  item: PrimaryNavItem;
  compact: boolean;
  collapsed: boolean;
}) => {
  const Icon = item.icon;
  if (collapsed) {
    return (
      <Tooltip content={<span>{item.label}</span>}>
        <Button
          type="button"
          size="icon"
          variant={item.active ? "secondary" : "ghost"}
          onClick={item.onSelect}
          className={cn(
            "relative h-11 w-11 rounded-xl",
            item.active ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200" : "text-slate-700",
          )}
          aria-label={item.label}
          title={item.label}
          aria-current={item.active ? "page" : undefined}
        >
          <Icon className="h-4 w-4" />
          {item.badgeCount && item.badgeCount > 0 ? (
            <span className="absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold text-white">
              {item.badgeCount}
            </span>
          ) : null}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant={item.active ? "secondary" : "ghost"}
      onClick={item.onSelect}
      className={cn(
        "w-full justify-start rounded-xl",
        item.active ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200" : "text-slate-700",
        compact ? "min-h-10" : "min-h-11",
      )}
      aria-current={item.active ? "page" : undefined}
    >
      <ButtonLeadingVisual>
        <Icon className="h-4 w-4" />
      </ButtonLeadingVisual>
      <ButtonLabel>{item.label}</ButtonLabel>
      {item.badgeCount && item.badgeCount > 0 ? (
        <ButtonTrailingVisual>
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
            {item.badgeCount}
          </span>
        </ButtonTrailingVisual>
      ) : null}
    </Button>
  );
};

const SessionButton = ({ item, collapsed }: { item: RunningSessionNavItem; collapsed: boolean }) => {
  const workspaceAvatar = createWorkspaceAvatar(item.workspacePath);
  const status = sessionStatusMeta(isRunningStatus(item.status) ? item.status : "stopped");
  const summary = [item.name, item.sessionId, item.workspacePath].filter(Boolean).join(" · ");
  if (collapsed) {
    return (
      <Tooltip
        content={
          <div className="max-w-[22rem] space-y-1">
            <p className="font-medium text-slate-900">{item.name}</p>
            <p className="break-all text-slate-600">{item.sessionId}</p>
            <p className="break-all text-slate-600">{item.workspacePath}</p>
          </div>
        }
      >
        <button
          type="button"
          onClick={item.onSelect}
          aria-label={summary}
          title={summary}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
            item.active ? "bg-teal-50 text-slate-900 ring-1 ring-teal-200" : "text-slate-700 hover:bg-slate-100",
          )}
        >
          {item.iconUrl ? (
            <ProfileImage
              src={item.iconUrl}
              label={item.name}
              alt={item.name}
              className="h-7 w-7 shrink-0 rounded-lg"
            />
          ) : (
            <SidebarWorkspaceGlyph avatar={workspaceAvatar} />
          )}
          {item.unreadCount > 0 ? (
            <span className="absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold text-white">
              {item.unreadCount}
            </span>
          ) : null}
          <span
            className={cn(
              "absolute right-1 bottom-1 inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white",
              status.variant === "success"
                ? "bg-emerald-500"
                : status.variant === "warning"
                  ? "bg-amber-500"
                  : status.variant === "destructive"
                    ? "bg-rose-500"
                    : "bg-slate-400",
            )}
          />
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      content={
        <div className="max-w-[22rem] space-y-1">
          <p className="font-medium text-slate-900">{item.name}</p>
          <p className="break-all text-slate-600">{item.sessionId}</p>
          <p className="break-all text-slate-600">{item.workspacePath}</p>
        </div>
      }
    >
      <button
        type="button"
        onClick={item.onSelect}
        aria-label={summary}
        title={summary}
        className={cn(
          "w-full rounded-xl px-2 py-2 text-left transition-colors",
          item.active ? "bg-teal-50 text-slate-900 ring-1 ring-teal-200" : "text-slate-700 hover:bg-slate-100",
        )}
      >
        <div className="flex items-start gap-2.5">
          {item.iconUrl ? (
            <ProfileImage
              src={item.iconUrl}
              label={item.name}
              alt={item.name}
              className="h-7 w-7 shrink-0 rounded-lg"
            />
          ) : (
            <SidebarWorkspaceGlyph avatar={workspaceAvatar} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-slate-900">{item.name}</span>
              {item.unreadCount > 0 ? <Badge variant="warning">{item.unreadCount}</Badge> : null}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-slate-400" />
              <span className="truncate text-[11px] text-slate-500">{item.sessionId}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex h-2 w-2 rounded-full",
                  status.variant === "success"
                    ? "bg-emerald-500"
                    : status.variant === "warning"
                      ? "bg-amber-500"
                      : status.variant === "destructive"
                        ? "bg-rose-500"
                        : "bg-slate-400",
                )}
              />
              <span className="truncate text-[11px] text-slate-500">
                {basenamePath(item.workspacePath)} · {status.label}
              </span>
            </div>
          </div>
        </div>
      </button>
    </Tooltip>
  );
};

const SidebarNavEmpty = ({ compact, collapsed }: { compact: boolean; collapsed: boolean }) =>
  collapsed ? (
    <div
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-500"
      title="No running sessions."
      aria-label="No running sessions."
    >
      0
    </div>
  ) : (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500",
        compact ? "" : "min-h-20",
      )}
    >
      No running sessions.
    </div>
  );

const SidebarNavBrand = ({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed?: () => void }) => {
  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const toggleButton = onToggleCollapsed ? (
    <Tooltip content={<span>{toggleLabel}</span>}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onToggleCollapsed}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="h-9 w-9 rounded-xl text-slate-500"
      >
        <ToggleIcon className="h-4 w-4" />
      </Button>
    </Tooltip>
  ) : null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 px-1">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-700 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        {toggleButton}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2 px-1">
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-700 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="font-nav text-sm font-semibold tracking-tight text-slate-900">agenter</p>
          <p className="text-[11px] text-slate-500">Workspace-first shell</p>
        </div>
      </div>
      {toggleButton}
    </div>
  );
};

export const SidebarNavContent = ({
  primaryItems,
  runningSessions,
  compact = false,
  collapsed = false,
  onToggleCollapsed,
}: SidebarNavProps) => {
  const iconRail = collapsed && !compact;

  return (
    <div
      className={cn(
        "grid h-full gap-4",
        compact
          ? "grid-rows-[auto_minmax(0,1fr)]"
          : iconRail
            ? "grid-rows-[auto_auto_minmax(0,1fr)] justify-items-center px-2 py-3"
            : "grid-rows-[auto_auto_minmax(0,1fr)] px-3 py-3",
      )}
      data-sidebar-collapsed={iconRail ? "true" : "false"}
    >
      {!compact ? <SidebarNavBrand collapsed={iconRail} onToggleCollapsed={onToggleCollapsed} /> : null}

      <section className={cn("space-y-2", iconRail && "w-full")}>
        <SidebarSection label="Navigate" collapsed={iconRail} />
        <div className={cn("space-y-1", iconRail && "flex flex-col items-center")}>
          {primaryItems.map((item) => (
            <PrimaryButton key={item.key} item={item} compact={compact} collapsed={iconRail} />
          ))}
        </div>
      </section>

      <section className={cn("grid grid-rows-[auto_minmax(0,1fr)] gap-2", iconRail && "w-full")}>
        <SidebarSection label="Running Sessions" collapsed={iconRail} />
        <ScrollViewport
          data-testid="sidebar-running-sessions-viewport"
          className={cn("h-full pr-1", iconRail ? "" : "space-y-1")}
        >
          {runningSessions.length === 0 ? (
            <div className={cn(iconRail && "flex justify-center")}>
              <SidebarNavEmpty compact={compact} collapsed={iconRail} />
            </div>
          ) : (
            <div className={cn(iconRail ? "flex flex-col items-center gap-2" : "space-y-1")}>
              {runningSessions.map((item) => (
                <SessionButton key={item.sessionId} item={item} collapsed={iconRail} />
              ))}
            </div>
          )}
        </ScrollViewport>
      </section>
    </div>
  );
};

export const SidebarNav = ({ className, compact = false, collapsed = false, ...props }: SidebarNavProps) => (
  <aside
    data-testid="app-sidebar-nav"
    data-sidebar-collapsed={collapsed && !compact ? "true" : "false"}
    className={cn(
      surfaceToneClassName("chrome"),
      "hidden h-full shrink-0 border-r border-slate-200 transition-[width] duration-200 ease-out xl:flex xl:flex-col",
      collapsed && !compact ? "w-[4.75rem]" : "w-[18.5rem]",
      className,
    )}
  >
    <SidebarNavContent {...props} compact={compact} collapsed={collapsed} />
  </aside>
);

export const defaultPrimaryNavItems = (input: {
  quickStartActive: boolean;
  workspacesActive: boolean;
  settingsActive: boolean;
  unreadWorkspaces?: number;
  onSelectQuickStart: () => void;
  onSelectWorkspaces: () => void;
  onSelectSettings: () => void;
}): PrimaryNavItem[] => [
  {
    key: "quickstart",
    label: "Quick Start",
    icon: Sparkles,
    active: input.quickStartActive,
    onSelect: input.onSelectQuickStart,
  },
  {
    key: "workspaces",
    label: "Workspaces",
    icon: FolderTree,
    active: input.workspacesActive,
    badgeCount: input.unreadWorkspaces,
    onSelect: input.onSelectWorkspaces,
  },
  {
    key: "settings",
    label: "Global Settings",
    icon: Settings2,
    active: input.settingsActive,
    onSelect: input.onSelectSettings,
  },
];
