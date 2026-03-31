import type { GlobalTerminalApprovalRequest, GlobalTerminalEntry } from "@agenter/client-sdk";
import { Clock3, ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";

interface TerminalApprovalRequestsDialogProps {
  open: boolean;
  terminal: GlobalTerminalEntry | null;
  onClose: () => void;
  onListApprovalRequests: (input: {
    terminalId: string;
    statuses?: GlobalTerminalApprovalRequest["status"][];
  }) => Promise<GlobalTerminalApprovalRequest[]>;
  onApproveRequest: (input: { terminalId: string; requestId: string; durationMs: number }) => Promise<unknown>;
  onDenyRequest: (input: { terminalId: string; requestId: string }) => Promise<unknown>;
  onChanged: () => Promise<void> | void;
}

const approvalDurations = [
  { label: "30m", value: 30 * 60 * 1000 },
  { label: "2h", value: 2 * 60 * 60 * 1000 },
  { label: "24h", value: 24 * 60 * 60 * 1000 },
] as const;

const formatRequestInput = (request: GlobalTerminalApprovalRequest): string => {
  const text = request.requestedInput?.text?.trim();
  if (!text) {
    return "No input payload captured.";
  }
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
};

export const TerminalApprovalRequestsDialog = ({
  open,
  terminal,
  onClose,
  onListApprovalRequests,
  onApproveRequest,
  onDenyRequest,
  onChanged,
}: TerminalApprovalRequestsDialogProps) => {
  const [requests, setRequests] = useState<GlobalTerminalApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    if (!terminal) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await onListApprovalRequests({
        terminalId: terminal.terminalId,
        statuses: ["pending"],
      });
      setRequests(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !terminal) {
      return;
    }
    void load();
  }, [open, terminal?.terminalId]);

  const runDecision = async (requestId: string, action: () => Promise<unknown>) => {
    setBusyKey(requestId);
    setError(null);
    try {
      await action();
      await load();
      await onChanged();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : String(decisionError));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Dialog
      open={open}
      title={terminal ? `Pending approvals for ${terminal.title ?? terminal.terminalId}` : "Pending approvals"}
      description="Requester writes wait here until the current terminal admin approves a timeboxed lease or explicitly denies the request."
      onClose={() => {
        if (busyKey) {
          return;
        }
        onClose();
      }}
      footer={
        <Button type="button" variant="ghost" onClick={onClose} disabled={Boolean(busyKey)}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        {loading ? <div className="text-sm text-slate-500">Loading pending approvals…</div> : null}

        {!loading && requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No pending approval requests.
          </div>
        ) : null}

        <div className="space-y-3">
          {requests.map((request) => (
            <article key={request.requestId} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{request.participantId}</span>
                    <Badge variant="warning">pending</Badge>
                    {request.assignedAdminId ? <Badge variant="secondary">admin {request.assignedAdminId}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>expires {new Date(request.expiresAt).toLocaleString()}</span>
                  </div>
                  <pre className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)] max-h-28 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
                    {formatRequestInput(request)}
                  </pre>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {approvalDurations.map((duration) => (
                    <Button
                      key={duration.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyKey === request.requestId}
                      onClick={() =>
                        void runDecision(request.requestId, async () => {
                          await onApproveRequest({
                            terminalId: request.terminalId,
                            requestId: request.requestId,
                            durationMs: duration.value,
                          });
                        })
                      }
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      {duration.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyKey === request.requestId}
                    onClick={() =>
                      void runDecision(request.requestId, async () => {
                        await onDenyRequest({
                          terminalId: request.terminalId,
                          requestId: request.requestId,
                        });
                      })
                    }
                  >
                    <ShieldX className="mr-1 h-3.5 w-3.5" />
                    Deny
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Dialog>
  );
};
