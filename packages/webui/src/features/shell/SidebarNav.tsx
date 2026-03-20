import { FolderTree, MessageSquare, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual, ButtonTrailingVisual } from "../../components/ui/button";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { surfaceToneClassName } from "../../components/ui/surface";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";
import { sessionStatusMeta } from "../../shared/status-meta";

type SidebarPrimaryKey = "quickstart" | "workspaces";

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
  active: boolean;
  unreadCount: number;
  status: string;
  onSelect: () => void;
}

interface SidebarNavProps {
  primaryItems: PrimaryNavItem[];
  runningSessions: RunningSessionNavItem[];
  compact?: boolean;
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

const SidebarSection = ({ label }: { label: string }) => (
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

const PrimaryButton = ({ item, compact }: { item: PrimaryNavItem; compact: boolean }) => {
  const Icon = item.icon;

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

const SessionButton = ({ item }: { item: RunningSessionNavItem }) => {
  const avatar = createWorkspaceAvatar(item.workspacePath);
  const status = sessionStatusMeta(isRunningStatus(item.status) ? item.status : "stopped");
  const summary = [item.name, item.sessionId, item.workspacePath].filter(Boolean).join(" · ");

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
          <SidebarWorkspaceGlyph avatar={avatar} />
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

const SidebarNavEmpty = ({ compact }: { compact: boolean }) => (
  <div
    className={cn(
      "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500",
      compact ? "" : "min-h-20",
    )}
  >
    No running sessions.
  </div>
);

const SidebarNavBrand = () => (
  <div className="px-1">
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-700 text-white">
        <Sparkles className="h-4 w-4" />
      </span>
      <div>
        <p className="font-nav text-sm font-semibold tracking-tight text-slate-900">agenter</p>
        <p className="text-[11px] text-slate-500">Workspace-first shell</p>
      </div>
    </div>
  </div>
);

export const SidebarNavContent = ({ primaryItems, runningSessions, compact = false }: SidebarNavProps) => (
  <div
    className={cn(
      "grid h-full gap-4",
      compact ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[auto_auto_minmax(0,1fr)] px-3 py-3",
    )}
  >
    {!compact ? <SidebarNavBrand /> : null}

    <section className="space-y-2">
      <SidebarSection label="Navigate" />
      <div className="space-y-1">
        {primaryItems.map((item) => (
          <PrimaryButton key={item.key} item={item} compact={compact} />
        ))}
      </div>
    </section>

    <section className="grid grid-rows-[auto_minmax(0,1fr)] gap-2">
      <SidebarSection label="Running Sessions" />
      <ScrollViewport data-testid="sidebar-running-sessions-viewport" className="h-full space-y-1 pr-1">
        {runningSessions.length === 0 ? (
          <SidebarNavEmpty compact={compact} />
        ) : (
          runningSessions.map((item) => <SessionButton key={item.sessionId} item={item} />)
        )}
      </ScrollViewport>
    </section>
  </div>
);

export const SidebarNav = ({ className, ...props }: SidebarNavProps) => (
  <aside
    className={cn(
      surfaceToneClassName("chrome"),
      "hidden h-full w-[18.5rem] shrink-0 border-r border-slate-200 xl:flex xl:flex-col",
      className,
    )}
  >
    <SidebarNavContent {...props} />
  </aside>
);

export const defaultPrimaryNavItems = (input: {
  quickStartActive: boolean;
  workspacesActive: boolean;
  unreadWorkspaces?: number;
  onSelectQuickStart: () => void;
  onSelectWorkspaces: () => void;
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
];
