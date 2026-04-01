import {
  ChevronLeft,
  ChevronRight,
  FolderTree,
  MessageSquare,
  MessagesSquare,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual, ButtonTrailingVisual } from "../../components/ui/button";
import { CardButton } from "../../components/ui/card";
import { ProfileImage } from "../../components/ui/profile-image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarScrollArea,
} from "../../components/ui/sidebar";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";
import { sessionStatusMeta } from "../../shared/status-meta";

type SidebarPrimaryKey = "chats" | "workspaces" | "terminals";

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

export interface SidebarOperatorProfileItem {
  label: string;
  subtitle: string;
  iconUrl?: string | null;
  roleLabel: string;
  active: boolean;
  onSelect: () => void;
}

interface SidebarNavProps {
  primaryItems: PrimaryNavItem[];
  runningSessions: RunningSessionNavItem[];
  operatorProfile?: SidebarOperatorProfileItem | null;
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
        <SidebarMenuButton
          type="button"
          collapsed
          isActive={item.active}
          onClick={item.onSelect}
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
        </SidebarMenuButton>
      </Tooltip>
    );
  }

  return (
    <SidebarMenuButton
      type="button"
      isActive={item.active}
      onClick={item.onSelect}
      className={cn(compact ? "min-h-10" : "min-h-11")}
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
    </SidebarMenuButton>
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
        <Button
          type="button"
          size="icon"
          variant={item.active ? "secondary" : "ghost"}
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
        </Button>
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
      <CardButton
        type="button"
        onClick={item.onSelect}
        aria-label={summary}
        title={summary}
        className={cn(
          "w-full px-2 py-2",
          item.active
            ? "border-teal-200 bg-teal-50 text-slate-900 ring-1 ring-teal-200"
            : "text-slate-700 hover:bg-slate-100",
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
      </CardButton>
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
          <MessagesSquare className="h-4 w-4" />
        </span>
        {toggleButton}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2 px-1">
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-700 text-white">
          <MessagesSquare className="h-4 w-4" />
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

const OperatorProfileButton = ({ item, collapsed }: { item: SidebarOperatorProfileItem; collapsed: boolean }) => {
  const summary = [item.label, item.roleLabel, item.subtitle].filter(Boolean).join(" · ");
  if (collapsed) {
    return (
      <Tooltip
        content={
          <div className="max-w-[22rem] space-y-1">
            <p className="font-medium text-slate-900">{item.label}</p>
            <p className="text-slate-600">{item.roleLabel}</p>
            <p className="break-all text-slate-600">{item.subtitle}</p>
          </div>
        }
      >
        <Button
          type="button"
          size="icon"
          variant={item.active ? "secondary" : "ghost"}
          onClick={item.onSelect}
          aria-label={summary}
          title={summary}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
            item.active ? "bg-teal-50 text-slate-900 ring-1 ring-teal-200" : "text-slate-700 hover:bg-slate-100",
          )}
        >
          <ProfileImage src={item.iconUrl} label={item.label} alt={item.label} className="h-8 w-8 rounded-xl" />
        </Button>
      </Tooltip>
    );
  }

  return (
    <CardButton
      type="button"
      onClick={item.onSelect}
      aria-label={summary}
      title={summary}
      className={cn(
        "w-full px-2.5 py-2",
        item.active ? "border-teal-200 bg-teal-50 text-slate-900" : "bg-white/80 text-slate-700 hover:bg-slate-100",
      )}
    >
      <div className="flex items-start gap-2.5">
        <ProfileImage src={item.iconUrl} label={item.label} alt={item.label} className="h-9 w-9 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-900">{item.label}</span>
            <Badge variant="secondary">{item.roleLabel}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3 w-3" />
            <span className="truncate">{item.subtitle}</span>
          </div>
        </div>
      </div>
    </CardButton>
  );
};

export const SidebarNavContent = ({
  primaryItems,
  runningSessions,
  operatorProfile,
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
          ? "grid-rows-[minmax(0,1fr)_auto] px-3 py-3"
          : iconRail
            ? "justify-items-center px-2 py-3"
            : "px-3 py-3",
      )}
      data-sidebar-collapsed={iconRail ? "true" : "false"}
    >
      {!compact ? (
        <SidebarHeader className={cn(iconRail && "w-full")}>
          <SidebarNavBrand collapsed={iconRail} onToggleCollapsed={onToggleCollapsed} />
        </SidebarHeader>
      ) : null}

      <SidebarContent className={cn(iconRail && "w-full")}>
        <div className="grid h-full min-h-0 gap-4">
          <SidebarGroup className={cn(iconRail && "w-full")}>
            <SidebarGroupLabel collapsed={iconRail}>Navigate</SidebarGroupLabel>
            <SidebarMenu className={cn(iconRail && "flex flex-col items-center")}>
              {primaryItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <PrimaryButton item={item} compact={compact} collapsed={iconRail} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className={cn("grid min-h-0 grid-rows-[auto_minmax(0,1fr)]", iconRail && "w-full")}>
            <SidebarGroupLabel collapsed={iconRail}>Running Avatars</SidebarGroupLabel>
            <SidebarScrollArea
              data-testid="sidebar-running-avatars-viewport"
              className={cn("pr-1", iconRail ? "" : "space-y-1")}
            >
              {runningSessions.length === 0 ? (
                <div className={cn(iconRail && "flex justify-center")}>
                  <SidebarNavEmpty compact={compact} collapsed={iconRail} />
                </div>
              ) : (
                <SidebarMenu className={cn(iconRail ? "flex flex-col items-center gap-2 space-y-0" : "space-y-1")}>
                  {runningSessions.map((item) => (
                    <SidebarMenuItem key={item.sessionId}>
                      <SessionButton item={item} collapsed={iconRail} />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarScrollArea>
          </SidebarGroup>
        </div>
      </SidebarContent>

      {operatorProfile ? (
        <SidebarFooter className={cn(iconRail && "w-full")}>
          <SidebarGroup className={cn(iconRail && "w-full")}>
            <SidebarGroupLabel collapsed={iconRail}>Operator</SidebarGroupLabel>
            <div className={cn(iconRail && "flex justify-center")}>
              <OperatorProfileButton item={operatorProfile} collapsed={iconRail} />
            </div>
          </SidebarGroup>
        </SidebarFooter>
      ) : null}
    </div>
  );
};

export const SidebarNav = ({ className, compact = false, collapsed = false, ...props }: SidebarNavProps) => (
  <Sidebar data-testid="app-sidebar-nav" collapsed={collapsed && !compact} className={className}>
    <SidebarNavContent {...props} compact={compact} collapsed={collapsed} />
  </Sidebar>
);

export const defaultPrimaryNavItems = (input: {
  chatsActive: boolean;
  workspacesActive: boolean;
  terminalsActive: boolean;
  unreadWorkspaces?: number;
  onSelectChats: () => void;
  onSelectWorkspaces: () => void;
  onSelectTerminals: () => void;
}): PrimaryNavItem[] => [
  {
    key: "chats",
    label: "Chats",
    icon: MessagesSquare,
    active: input.chatsActive,
    onSelect: input.onSelectChats,
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
    key: "terminals",
    label: "Terminals",
    icon: TerminalSquare,
    active: input.terminalsActive,
    onSelect: input.onSelectTerminals,
  },
];
