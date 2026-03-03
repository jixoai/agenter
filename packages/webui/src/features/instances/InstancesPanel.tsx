import type { SessionInstance } from "@agenter/client-sdk";
import { Plus, Play, Square, Trash2 } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { cn } from "../../lib/utils";

interface InstancesPanelProps {
  instances: SessionInstance[];
  activeInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  onCreate: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}

export const InstancesPanel = ({
  instances,
  activeInstanceId,
  onSelect,
  onCreate,
  onStart,
  onStop,
  onDelete,
}: InstancesPanelProps) => {
  const statusVariant = (status: SessionInstance["status"]): "success" | "warning" | "destructive" | "secondary" => {
    if (status === "running") {
      return "success";
    }
    if (status === "starting") {
      return "warning";
    }
    if (status === "error") {
      return "destructive";
    }
    return "secondary";
  };

  return (
    <Card className="col-span-1 lg:row-span-2">
      <CardHeader className="border-b border-slate-200">
        <CardTitle>Instances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onCreate} size="sm">
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
          <Button onClick={onStart} size="sm" variant="secondary" disabled={!activeInstanceId}>
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
          <Button onClick={onStop} size="sm" variant="secondary" disabled={!activeInstanceId}>
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
          <Button onClick={onDelete} size="sm" variant="destructive" disabled={!activeInstanceId}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
        <div className="max-h-[58dvh] space-y-2 overflow-auto pr-1">
        {instances.map((instance) => (
          <button
            key={instance.id}
            className={cn(
              "w-full rounded-lg border p-3 text-left transition-colors",
              instance.id === activeInstanceId
                ? "border-teal-600 bg-teal-50"
                : "border-slate-200 bg-white hover:bg-slate-50",
            )}
            onClick={() => onSelect(instance.id)}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="truncate text-sm text-slate-900">{instance.name}</strong>
              <Badge variant={statusVariant(instance.status)}>{instance.status}</Badge>
            </div>
            <small className="line-clamp-2 block text-xs text-slate-600">{instance.cwd}</small>
          </button>
        ))}
        </div>
      </CardContent>
    </Card>
  );
};
