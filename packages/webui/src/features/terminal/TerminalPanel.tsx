import type { RuntimeClientState } from "@agenter/client-sdk";

import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";

interface TerminalPanelProps {
  runtime: RuntimeClientState["runtimes"][string] | undefined;
  snapshots: RuntimeClientState["terminalSnapshotsBySession"][string] | undefined;
}

const statusVariant = (status: "IDLE" | "BUSY") => (status === "BUSY" ? "warning" : "secondary");

export const TerminalPanel = ({ runtime, snapshots }: TerminalPanelProps) => {
  if (!runtime || runtime.terminals.length === 0) {
    return <p className="text-xs text-slate-500">No terminal in this session.</p>;
  }

  const focused = runtime.terminals.find((item) => item.terminalId === runtime.focusedTerminalId) ?? runtime.terminals[0];
  const snapshot = snapshots?.[focused.terminalId];

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Terminal</h3>
        <Badge variant={statusVariant(focused.status)}>{focused.status}</Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {runtime.terminals.map((terminal) => (
          <span
            key={terminal.terminalId}
            className={cn(
              "rounded-md px-2 py-1 text-[11px]",
              terminal.terminalId === focused.terminalId
                ? "bg-teal-100 text-teal-900"
                : "bg-slate-100 text-slate-700",
            )}
          >
            {terminal.terminalId}
          </span>
        ))}
      </div>

      <div className="rounded-xl bg-slate-950 p-2">
        <pre className="max-h-[45dvh] overflow-auto whitespace-pre text-[12px] leading-[1.25rem] text-slate-200">
          {(snapshot?.lines ?? []).join("\n")}
        </pre>
      </div>

      <p className="text-[11px] text-slate-500">
        seq: {snapshot?.seq ?? focused.seq} · size: {snapshot?.rows ?? "?"}x{snapshot?.cols ?? "?"}
      </p>
    </section>
  );
};
