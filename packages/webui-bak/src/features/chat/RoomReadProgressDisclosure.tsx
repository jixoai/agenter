import type { MessageChannelEntry } from "@agenter/client-sdk";
import { CheckCheck, Clock3, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";

interface RoomReadProgressDisclosureProps {
  readProgress?: MessageChannelEntry["readProgress"];
  readStates?: MessageChannelEntry["readStates"];
}

const formatReadAt = (timestamp: number): string =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));

export const RoomReadProgressDisclosure = ({ readProgress, readStates = [] }: RoomReadProgressDisclosureProps) => {
  const [open, setOpen] = useState(false);
  const totalSeatCount = readProgress?.totalSeatCount ?? 0;
  const readSeatCount = readProgress?.readSeatCount ?? 0;
  const latestVisibleMessageId = readProgress?.latestVisibleMessageId;

  const ratio = totalSeatCount > 0 ? readSeatCount / totalSeatCount : 0;
  const ringToneClassName = latestVisibleMessageId
    ? readSeatCount === totalSeatCount
      ? "text-emerald-600"
      : "text-amber-600"
    : "text-slate-400";
  const strokeDasharray = `${Math.max(0, Math.min(1, ratio)) * 100} 100`;

  const tooltipContent = useMemo(() => {
    if (!latestVisibleMessageId) {
      return "No visible room message yet.";
    }
    return (
      <div className="space-y-1">
        <p className="font-medium text-slate-900">
          {readSeatCount}/{totalSeatCount} seats read
        </p>
        <div className="space-y-1">
          {readStates.slice(0, 6).map((state) => (
            <div key={state.actorId} className="flex items-center justify-between gap-3">
              <span className="truncate">{state.label ?? state.actorId}</span>
              <span className={cn("shrink-0", state.hasReadLatestVisible ? "text-emerald-700" : "text-amber-700")}>
                {state.hasReadLatestVisible ? "read" : "unread"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }, [latestVisibleMessageId, readSeatCount, readStates, totalSeatCount]);

  if (totalSeatCount === 0) {
    return null;
  }

  return (
    <>
      <Tooltip content={tooltipContent}>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Room read progress"
          title="Room read progress"
          className="shrink-0 border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          onClick={() => setOpen(true)}
        >
          <svg viewBox="0 0 36 36" className={cn("h-4 w-4 -rotate-90", ringToneClassName)} aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={strokeDasharray}
            />
          </svg>
        </Button>
      </Tooltip>
      <Dialog
        open={open}
        title="Read progress"
        description={latestVisibleMessageId ? "Latest visible room message collaboration state." : "No visible room message yet."}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <Users className="h-3 w-3" />
              {totalSeatCount} seats
            </Badge>
            <Badge variant={readSeatCount === totalSeatCount && latestVisibleMessageId ? "success" : "secondary"}>
              <CheckCheck className="h-3 w-3" />
              {readSeatCount} read
            </Badge>
            <Badge variant={latestVisibleMessageId && readSeatCount < totalSeatCount ? "warning" : "secondary"}>
              {Math.max(0, totalSeatCount - readSeatCount)} unread
            </Badge>
          </div>
          <div className="space-y-2">
            {readStates.map((state) => (
              <article key={state.actorId} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{state.label ?? state.actorId}</p>
                  <Badge variant="secondary">{state.role}</Badge>
                  {state.currentAdmin ? <Badge variant="warning">current admin</Badge> : null}
                  {state.invalidCredential ? <Badge variant="destructive">credential invalid</Badge> : null}
                  <Badge variant={latestVisibleMessageId ? (state.hasReadLatestVisible ? "success" : "warning") : "secondary"}>
                    {latestVisibleMessageId ? (state.hasReadLatestVisible ? "read" : "unread") : "no visible message"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{state.actorId}</span>
                  {state.readAt ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {state.hasReadLatestVisible ? `Read ${formatReadAt(state.readAt)}` : `Last read ${formatReadAt(state.readAt)}`}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </Dialog>
    </>
  );
};
