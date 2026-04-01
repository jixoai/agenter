import { Ban, CircleAlert, CircleCheckBig, LoaderCircle, Timer } from "lucide-react";

import { Badge } from "./badge";
import { JSONViewer } from "./json-viewer";

export type ToolInvocationStatus = "waiting" | "running" | "success" | "failed" | "cancelled";

export interface ToolInvocationPayloadView {
  value: unknown;
  rawText?: string;
}

export interface ToolInvocationView {
  invocationId: string;
  toolName: string;
  status: ToolInvocationStatus;
  call?: ToolInvocationPayloadView | null;
  result?: ToolInvocationPayloadView | null;
  error?: string | null;
  meta?: Record<string, unknown>;
  startedAt?: number;
  finishedAt?: number;
}

interface ToolInvocationCardProps {
  invocation: ToolInvocationView;
  className?: string;
}

const statusBadgeVariant = (status: ToolInvocationStatus): "secondary" | "warning" | "success" | "destructive" => {
  if (status === "running") {
    return "warning";
  }
  if (status === "success") {
    return "success";
  }
  if (status === "failed") {
    return "destructive";
  }
  return "secondary";
};

const statusLabel = (status: ToolInvocationStatus): string => {
  if (status === "running") {
    return "running";
  }
  if (status === "success") {
    return "success";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  return "waiting";
};

const StatusIcon = ({ status }: { status: ToolInvocationStatus }) => {
  if (status === "running") {
    return <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-600" />;
  }
  if (status === "success") {
    return <CircleCheckBig className="h-3.5 w-3.5 text-emerald-600" />;
  }
  if (status === "failed") {
    return <CircleAlert className="h-3.5 w-3.5 text-rose-600" />;
  }
  if (status === "cancelled") {
    return <Ban className="h-3.5 w-3.5 text-slate-500" />;
  }
  return <Timer className="h-3.5 w-3.5 text-slate-500" />;
};

const PayloadSection = ({
  label,
  payload,
}: {
  label: "Call" | "Result";
  payload: ToolInvocationPayloadView;
}) => (
  <section className="space-y-1.5">
    <h5 className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">{label}</h5>
    <JSONViewer value={payload.value} rawText={payload.rawText} />
  </section>
);

const hasVisiblePayload = (payload: ToolInvocationPayloadView | null | undefined): payload is ToolInvocationPayloadView => {
  if (!payload) {
    return false;
  }
  if (typeof payload.rawText === "string" && payload.rawText.trim().length > 0) {
    return true;
  }
  if (typeof payload.value === "string") {
    return payload.value.trim().length > 0;
  }
  return payload.value !== undefined && payload.value !== null;
};

export const ToolInvocationCard = ({ invocation, className = "" }: ToolInvocationCardProps) => {
  const visibleCall = hasVisiblePayload(invocation.call) ? invocation.call : null;
  const visibleResult = hasVisiblePayload(invocation.result) ? invocation.result : null;
  return (
    <article className={`space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 ${className}`.trim()}>
      <header className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
          <StatusIcon status={invocation.status} />
          <span>{invocation.toolName}</span>
        </div>
        <Badge variant={statusBadgeVariant(invocation.status)}>{statusLabel(invocation.status)}</Badge>
        {invocation.startedAt ? (
          <span className="text-[11px] text-slate-500">
            {new Date(invocation.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        ) : null}
      </header>

      {invocation.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-700">{invocation.error}</div>
      ) : null}

      <div className="space-y-2">
        {visibleCall ? <PayloadSection label="Call" payload={visibleCall} /> : null}
        {visibleResult ? <PayloadSection label="Result" payload={visibleResult} /> : null}
      </div>
    </article>
  );
};
