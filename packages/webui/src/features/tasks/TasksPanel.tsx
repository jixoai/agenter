import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { cn } from "../../lib/utils";

interface TaskItem {
  key: string;
  id: string;
  title: string;
  status: string;
  progress: number;
  blockedBy: string[];
  blocks: string[];
  source: {
    name: string;
    file: string;
  };
}

interface TasksPanelProps {
  tasks: TaskItem[];
  compact?: boolean;
  loading?: boolean;
}

const progressText = (value: number): string => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const statusVariant = (status: string): "success" | "warning" | "destructive" | "secondary" => {
  if (status === "done") {
    return "success";
  }
  if (status === "running" || status === "ready") {
    return "warning";
  }
  if (status === "failed" || status === "canceled") {
    return "destructive";
  }
  return "secondary";
};

export const TasksPanel = ({ tasks, compact = false, loading = false }: TasksPanelProps) => {
  const state = resolveAsyncSurfaceState({ loading, hasData: tasks.length > 0 });

  return (
    <Card className={cn("col-span-1 grid min-h-[40dvh] grid-rows-[auto_minmax(0,1fr)] lg:col-span-2", compact ? "h-full" : "")}>
      <CardHeader className={cn("border-b border-slate-200", compact ? "p-3" : "")}>
        <CardTitle>Tasks</CardTitle>
      </CardHeader>
      <CardContent className={cn("grid h-full grid-rows-[minmax(0,1fr)] p-4", compact ? "p-3" : "")}>
        <AsyncSurface
          state={state}
          loadingOverlayLabel="Refreshing tasks..."
          skeleton={<div className="h-full rounded-lg bg-slate-100" />}
          empty={<p className="text-xs text-slate-500">No tasks loaded.</p>}
          className="flex-1"
        >
          <ScrollViewport className="flex-1 space-y-2 pr-1">
            {tasks.map((task) => (
              <article
                key={task.key}
                className={cn("rounded-lg border border-slate-200 bg-white", compact ? "p-2.5" : "p-3")}
              >
                <div className="mb-1 flex items-center gap-2">
                  <strong className="truncate text-sm text-slate-900">{task.title}</strong>
                  <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                  <Badge variant="secondary">{progressText(task.progress)}</Badge>
                </div>
                <p className="text-[11px] text-slate-600">
                  {task.id} · {task.source.name}
                </p>
                <div className="mt-2 flex gap-2 text-[11px]">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5",
                      task.blockedBy.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
                    )}
                  >
                    blockedBy: {task.blockedBy.length}
                  </span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">blocks: {task.blocks.length}</span>
                </div>
              </article>
            ))}
          </ScrollViewport>
        </AsyncSurface>
      </CardContent>
    </Card>
  );
};
