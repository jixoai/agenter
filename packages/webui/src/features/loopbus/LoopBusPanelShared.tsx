import { CheckCircle2, Cpu, LoaderCircle, TriangleAlert } from "lucide-react";

export const StatusIcon = ({ status }: { status: "ok" | "error" | "running" }) => {
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
    <button
      type="button"
      disabled={!hasMore || loading || !onLoadMore}
      onClick={() => {
        void onLoadMore?.();
      }}
      className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 shadow-xs ring-1 ring-slate-200 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <span className="inline-flex items-center gap-1">
          <LoaderCircle className="h-3 w-3 animate-spin" />
          Loading...
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          Load older
        </span>
      )}
    </button>
  </div>
);
