import type { WorkspaceEntry } from "@agenter/client-sdk";
import { AlertTriangle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Skeleton } from "../../components/ui/skeleton";
import { WorkspaceItem } from "./WorkspaceItem";

interface WorkspacesPanelProps {
  recentPaths: string[];
  workspaces: WorkspaceEntry[];
  unreadByWorkspace?: Record<string, number>;
  selectedPath: string | null;
  loading?: boolean;
  onSelectPath: (path: string | null) => void;
  onToggleFavorite: (path: string) => void;
  onDeleteWorkspace: (path: string) => void;
  onCreateSessionInWorkspace: (path: string) => void;
  onCleanMissing: () => void;
}

const normalize = (text: string): string => text.trim().toLowerCase();

const includeByQuery = (item: WorkspaceEntry, query: string): boolean => {
  if (!query) {
    return true;
  }
  return normalize([item.path, item.group, item.missing ? "missing" : ""].join(" ")).includes(query);
};

const createRecentRank = (paths: string[]): Map<string, number> => {
  const result = new Map<string, number>();
  paths.forEach((path, index) => {
    result.set(path, index);
  });
  return result;
};

const compareByRecent =
  (recentRank: Map<string, number>) =>
  (left: WorkspaceEntry, right: WorkspaceEntry): number => {
    const leftRank = recentRank.get(left.path) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = recentRank.get(right.path) ?? Number.MAX_SAFE_INTEGER;
    if (left.favorite !== right.favorite) {
      return left.favorite ? -1 : 1;
    }
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.path.localeCompare(right.path);
  };

const sectionEntries = (items: WorkspaceEntry[], recentRank: Map<string, number>) => {
  const byGroup = new Map<string, WorkspaceEntry[]>();
  for (const item of items) {
    const list = byGroup.get(item.group) ?? [];
    list.push(item);
    byGroup.set(item.group, list);
  }

  const compare = compareByRecent(recentRank);
  const namedGroups = [...byGroup.entries()]
    .filter(([group]) => group !== "Other")
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([group, entries]) => [group, [...entries].sort(compare)] as const);

  const other = byGroup.get("Other");
  return {
    namedGroups,
    other: other ? [...other].sort(compare) : [],
  };
};

const LoadingShell = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }, (_, index) => (
      <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-5/6" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

export const WorkspacesPanel = ({
  recentPaths,
  workspaces,
  unreadByWorkspace = {},
  selectedPath,
  loading = false,
  onSelectPath,
  onToggleFavorite,
  onDeleteWorkspace,
  onCreateSessionInWorkspace,
  onCleanMissing,
}: WorkspacesPanelProps) => {
  const [query, setQuery] = useState("");
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);
  const [pendingCleanMissing, setPendingCleanMissing] = useState(false);
  const normalizedQuery = normalize(query);
  const recentRank = useMemo(() => createRecentRank(recentPaths), [recentPaths]);
  const missingCount = useMemo(() => workspaces.filter((item) => item.missing).length, [workspaces]);

  useEffect(() => {
    if (!selectedPath) {
      return;
    }
    if (!workspaces.some((item) => item.path === selectedPath)) {
      onSelectPath(null);
    }
  }, [onSelectPath, selectedPath, workspaces]);

  const filtered = useMemo(
    () => workspaces.filter((item) => includeByQuery(item, normalizedQuery)),
    [workspaces, normalizedQuery],
  );

  const compare = useMemo(() => compareByRecent(recentRank), [recentRank]);
  const recent = useMemo(
    () =>
      recentPaths
        .map((path) => filtered.find((item) => item.path === path))
        .filter((item): item is WorkspaceEntry => Boolean(item))
        .slice(0, 5),
    [filtered, recentPaths],
  );
  const favorites = useMemo(() => filtered.filter((item) => item.favorite).sort(compare), [compare, filtered]);
  const grouped = useMemo(() => sectionEntries(filtered, recentRank), [filtered, recentRank]);

  return (
    <>
      <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white/96 p-4 shadow-sm">
        <div className="space-y-2 pb-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="typo-title-3 text-slate-900">Workspaces</h2>
            {missingCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingCleanMissing(true)}
                title="Clean missing workspaces"
              >
                <ButtonLeadingVisual>
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                </ButtonLeadingVisual>
                <ButtonLabel>{`Clean Missing ${missingCount}`}</ButtonLabel>
              </Button>
            ) : null}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workspace or group"
              className="pl-9"
            />
          </div>
        </div>

        <AsyncSurface
          state={resolveAsyncSurfaceState({ loading, hasData: filtered.length > 0 })}
          loadingOverlayLabel="Refreshing workspaces..."
          skeleton={<LoadingShell />}
          empty={
            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
              No workspace found.
            </div>
          }
          className="h-full"
        >
          <ScrollViewport data-testid="workspaces-scroll-viewport" className="h-full pr-1">
            <div className="space-y-4">
              {recent.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="typo-caption text-slate-500">Recent</h3>
                  {recent.map((item) => (
                    <WorkspaceItem
                      key={item.path}
                      workspace={item}
                      unreadCount={unreadByWorkspace[item.path] ?? 0}
                      selected={selectedPath === item.path}
                      onSelect={onSelectPath}
                      onCreateSession={onCreateSessionInWorkspace}
                      onToggleFavorite={onToggleFavorite}
                      onDelete={(path) => setPendingDeletePath(path)}
                    />
                  ))}
                </section>
              ) : null}

              {favorites.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="typo-caption text-slate-500">Favorites</h3>
                  {favorites.map((item) => (
                    <WorkspaceItem
                      key={item.path}
                      workspace={item}
                      unreadCount={unreadByWorkspace[item.path] ?? 0}
                      selected={selectedPath === item.path}
                      onSelect={onSelectPath}
                      onCreateSession={onCreateSessionInWorkspace}
                      onToggleFavorite={onToggleFavorite}
                      onDelete={(path) => setPendingDeletePath(path)}
                    />
                  ))}
                </section>
              ) : null}

              {grouped.namedGroups.map(([group, entries]) => (
                <section key={group} className="space-y-2">
                  <h3 className="typo-caption text-slate-500">{group}</h3>
                  {entries.map((item) => (
                    <WorkspaceItem
                      key={item.path}
                      workspace={item}
                      unreadCount={unreadByWorkspace[item.path] ?? 0}
                      selected={selectedPath === item.path}
                      onSelect={onSelectPath}
                      onCreateSession={onCreateSessionInWorkspace}
                      onToggleFavorite={onToggleFavorite}
                      onDelete={(path) => setPendingDeletePath(path)}
                    />
                  ))}
                </section>
              ))}

              {grouped.other.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="typo-caption text-slate-500">Other</h3>
                  {grouped.other.map((item) => (
                    <WorkspaceItem
                      key={item.path}
                      workspace={item}
                      unreadCount={unreadByWorkspace[item.path] ?? 0}
                      selected={selectedPath === item.path}
                      onSelect={onSelectPath}
                      onCreateSession={onCreateSessionInWorkspace}
                      onToggleFavorite={onToggleFavorite}
                      onDelete={(path) => setPendingDeletePath(path)}
                    />
                  ))}
                </section>
              ) : null}
            </div>
          </ScrollViewport>
        </AsyncSurface>
      </section>

      <Dialog
        open={pendingDeletePath !== null}
        title="Delete workspace"
        description={
          pendingDeletePath
            ? `Remove ${pendingDeletePath} from the workspace list? This does not delete the folder.`
            : undefined
        }
        onClose={() => setPendingDeletePath(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDeletePath(null)}>
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
          </>
        }
      >
        <p className="text-sm text-slate-600">
          The workspace entry will be removed from Agenter, but files on disk stay untouched.
        </p>
      </Dialog>

      <Dialog
        open={pendingCleanMissing}
        title="Clean missing workspaces"
        description={
          missingCount > 0
            ? `Remove ${missingCount} missing workspace${missingCount === 1 ? "" : "s"} from Agenter?`
            : undefined
        }
        onClose={() => setPendingCleanMissing(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingCleanMissing(false)}>
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
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This only removes broken workspace references from the list. Existing files and archived sessions stay
          untouched.
        </p>
      </Dialog>
    </>
  );
};
