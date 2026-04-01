import { CheckCircle2, Cpu, LoaderCircle, TriangleAlert } from "lucide-react";

import { Button, ButtonLabel, ButtonLeadingVisual } from "../../../components/ui/button";

export const StatusIcon = ({ status }: { status: "ok" | "error" | "running" | "done" | "cancelled" }) => {
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }
  if (status === "cancelled") {
    return <TriangleAlert className="h-4 w-4 text-amber-600" />;
  }
  if (status === "error") {
    return <TriangleAlert className="h-4 w-4 text-rose-600" />;
  }
  if (status === "running") {
    return <LoaderCircle className="h-4 w-4 animate-spin text-amber-600" />;
  }
  return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
};

interface PanelHeaderProps {
  label: string;
  count: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore?: () => void | Promise<void>;
}

export const PanelHeader = ({ label, count, hasMore, loading, onLoadMore }: PanelHeaderProps) => (
  <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2 py-1.5">
    <span className="text-[11px] font-medium text-slate-700">
      {label} ({count})
    </span>
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!hasMore || loading || !onLoadMore}
      onClick={() => {
        void onLoadMore?.();
      }}
      className="text-[11px] text-slate-600 shadow-xs"
    >
      {loading ? (
        <span className="inline-flex items-center gap-1">
          <LoaderCircle className="h-3 w-3 animate-spin" />
          Loading...
        </span>
      ) : (
        <>
          <ButtonLeadingVisual>
            <Cpu className="h-3 w-3" />
          </ButtonLeadingVisual>
          <ButtonLabel>Load older</ButtonLabel>
        </>
      )}
    </Button>
  </div>
);
