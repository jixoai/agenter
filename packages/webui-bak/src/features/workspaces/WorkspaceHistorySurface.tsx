import type { WorkspaceEntry } from "@agenter/client-sdk";
import { ArrowUpDown } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Select } from "../../components/ui/select";
import { surfaceToneClassName } from "../../components/ui/surface";
import { WorkspaceItem } from "./WorkspaceItem";
import type { WorkspaceHistorySortMode } from "./workspace-surface-types";

interface WorkspaceHistorySurfaceProps {
  workspaces: WorkspaceEntry[];
  unreadByWorkspace: Record<string, number>;
  sortMode: WorkspaceHistorySortMode;
  onSortModeChange: (mode: WorkspaceHistorySortMode) => void;
  onOpenWorkspace: (workspacePath: string) => void;
}

export const WorkspaceHistorySurface = ({
  workspaces,
  unreadByWorkspace,
  sortMode,
  onSortModeChange,
  onOpenWorkspace,
}: WorkspaceHistorySurfaceProps) => {
  return (
    <section className={surfaceToneClassName("panel") + " grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl p-4 shadow-sm"}>
      <div className="space-y-2 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="typo-title-3 text-slate-900">History</h2>
            <p className="mt-1 text-xs text-slate-500">All workspaces ordered by recent use, path, or visible name.</p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-slate-500" />
            <Select
              aria-label="History sort mode"
              value={sortMode}
              onChange={(event) => onSortModeChange(event.currentTarget.value as WorkspaceHistorySortMode)}
              className="w-[10rem]"
            >
              <option value="recent">Last used</option>
              <option value="path">Path</option>
              <option value="name">Name</option>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Badge variant="secondary">{workspaces.length} workspaces</Badge>
          <span>Only workspaces with started sessions appear first in recent mode.</span>
        </div>
      </div>

      <ScrollViewport className="h-full pr-1" data-testid="workspace-history-scroll-viewport">
        <div className="space-y-3 pt-3">
          {workspaces.map((workspace) => (
            <div key={workspace.path} className="space-y-2">
              <WorkspaceItem
                workspace={workspace}
                unreadCount={unreadByWorkspace[workspace.path] ?? 0}
                selected={false}
                onSelect={(path) => {
                  if (path) {
                    onOpenWorkspace(path);
                  }
                }}
                onCreateSession={(path) => onOpenWorkspace(path)}
                onToggleFavorite={() => undefined}
                onDelete={() => undefined}
              />
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => onOpenWorkspace(workspace.path)}>
                  Open Workspace
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollViewport>
    </section>
  );
};
