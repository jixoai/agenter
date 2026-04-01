import type { WorkspaceEntry } from "@agenter/client-sdk";
import { FolderCog, History, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { surfaceToneClassName } from "../../components/ui/surface";
import { cn } from "../../lib/utils";
import { WorkspaceItem } from "./WorkspaceItem";
import type { WorkspaceMasterSelection } from "./workspace-surface-types";

interface WorkspacesCatalogSurfaceProps {
  loading: boolean;
  workspaces: WorkspaceEntry[];
  recentPaths: string[];
  unreadByWorkspace: Record<string, number>;
  selection: WorkspaceMasterSelection;
  onSelectSelection: (selection: WorkspaceMasterSelection) => void;
  onToggleFavorite: (path: string) => void;
  onDeleteWorkspace: (path: string) => void;
  onCleanMissing: () => void;
}

const isWorkspaceSelected = (selection: WorkspaceMasterSelection, workspacePath: string): boolean =>
  selection.kind === "workspace" && selection.workspacePath === workspacePath;

const selectionCopy = (
  selection: WorkspaceMasterSelection,
): { title: string; description: string; icon: typeof Sparkles } => {
  if (selection.kind === "history") {
    return {
      title: "History",
      description: "Browse workspaces by last session activity, path, or name.",
      icon: History,
    };
  }
  if (selection.kind === "workspace") {
    return {
      title: selection.workspacePath,
      description: "Open workspace settings or avatar management.",
      icon: FolderCog,
    };
  }
  return {
    title: "Welcome",
    description: "Launch or reattach an avatar with rooms and terminals.",
    icon: Sparkles,
  };
};

const workspaceRecentComparator =
  (recentPaths: string[]) =>
  (left: WorkspaceEntry, right: WorkspaceEntry): number => {
    if (left.path === "~/") {
      return -1;
    }
    if (right.path === "~/") {
      return 1;
    }
    if (left.favorite !== right.favorite) {
      return left.favorite ? -1 : 1;
    }
    const leftRank = recentPaths.indexOf(left.path);
    const rightRank = recentPaths.indexOf(right.path);
    if (leftRank !== rightRank) {
      if (leftRank === -1) {
        return 1;
      }
      if (rightRank === -1) {
        return -1;
      }
      return leftRank - rightRank;
    }
    return left.path.localeCompare(right.path);
  };

export const WorkspacesCatalogSurface = ({
  loading,
  workspaces,
  recentPaths,
  unreadByWorkspace,
  selection,
  onSelectSelection,
  onToggleFavorite,
  onDeleteWorkspace,
  onCleanMissing,
}: WorkspacesCatalogSurfaceProps) => {
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);
  const [pendingCleanMissing, setPendingCleanMissing] = useState(false);
  const sortedWorkspaces = useMemo(
    () => workspaces.slice().sort(workspaceRecentComparator(recentPaths)),
    [recentPaths, workspaces],
  );
  const missingCount = useMemo(() => workspaces.filter((workspace) => workspace.missing).length, [workspaces]);
  const selectedCopy = selectionCopy(selection);
  const SelectionIcon = selectedCopy.icon;

  return (
    <>
      <section
        className={cn(
          surfaceToneClassName("panel"),
          "grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl p-4 shadow-sm",
        )}
      >
        <div className="space-y-3 border-b border-slate-200 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SelectionIcon className="h-4 w-4 text-teal-700" />
                <h2 className="typo-title-3 text-slate-900">Workspaces</h2>
              </div>
              <p className="text-xs text-slate-500">{selectedCopy.description}</p>
            </div>
            {missingCount > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setPendingCleanMissing(true)}>
                Clean Missing {missingCount}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onSelectSelection({ kind: "welcome" })}
              className={cn(
                "h-auto w-full items-start justify-start rounded-xl px-3 py-3 text-left whitespace-normal shadow-none transition-colors",
                selection.kind === "welcome"
                  ? "border-teal-300 bg-teal-50/70 hover:bg-teal-50/70"
                  : "border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Welcome</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Start or reattach avatars with global rooms and terminals.
                  </div>
                </div>
                <Badge variant="secondary">Start</Badge>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onSelectSelection({ kind: "history" })}
              className={cn(
                "h-auto w-full items-start justify-start rounded-xl px-3 py-3 text-left whitespace-normal shadow-none transition-colors",
                selection.kind === "history"
                  ? "border-teal-300 bg-teal-50/70 hover:bg-teal-50/70"
                  : "border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">History</div>
                  <div className="mt-1 text-xs text-slate-500">List workspaces by last use, path, or name.</div>
                </div>
                <Badge variant="secondary">List</Badge>
              </div>
            </Button>
          </div>
        </div>

        <AsyncSurface
          state={resolveAsyncSurfaceState({ loading, hasData: sortedWorkspaces.length > 0 })}
          loadingOverlayLabel="Refreshing workspaces..."
          empty={
            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
              No workspaces found.
            </div>
          }
          className="h-full pt-3"
        >
          <ScrollViewport className="h-full pr-1" data-testid="workspaces-vnext-scroll-viewport">
            <div className="space-y-3">
              {sortedWorkspaces.map((workspace) => (
                <WorkspaceItem
                  key={workspace.path}
                  workspace={workspace}
                  unreadCount={unreadByWorkspace[workspace.path] ?? 0}
                  selected={isWorkspaceSelected(selection, workspace.path)}
                  onSelect={(path) =>
                    onSelectSelection(path ? { kind: "workspace", workspacePath: path } : { kind: "welcome" })
                  }
                  onCreateSession={() => onSelectSelection({ kind: "welcome" })}
                  onToggleFavorite={onToggleFavorite}
                  onDelete={(path) => setPendingDeletePath(path)}
                />
              ))}
            </div>
          </ScrollViewport>
        </AsyncSurface>
      </section>

      <Dialog
        open={pendingDeletePath !== null}
        onClose={() => setPendingDeletePath(null)}
        title="Delete workspace"
        description={pendingDeletePath ? `Delete ${pendingDeletePath}?` : undefined}
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>This removes the workspace entry from the catalog. Session data is not deleted automatically.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingDeletePath(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeletePath) {
                  onDeleteWorkspace(pendingDeletePath);
                }
                setPendingDeletePath(null);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={pendingCleanMissing} onClose={() => setPendingCleanMissing(false)} title="Clean missing workspaces">
        <div className="space-y-3 text-sm text-slate-600">
          <p>Remove catalog entries whose directories are no longer present on disk.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingCleanMissing(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onCleanMissing();
                setPendingCleanMissing(false);
              }}
            >
              Clean
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};
