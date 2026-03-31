import type { GlobalTerminalEntry } from "@agenter/client-sdk";

import { Badge } from "../../components/ui/badge";
import { ProfileImage } from "../../components/ui/profile-image";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";

type TerminalSeat = NonNullable<GlobalTerminalEntry["actors"]>[number];

export interface TerminalActorMeta {
  label: string;
  iconUrl?: string;
  subtitle?: string;
}

interface TerminalActorGroupProps {
  actors: TerminalSeat[];
  resolveActorMeta?: (actorId: string) => TerminalActorMeta | null;
  maxVisible?: number;
  className?: string;
}

const roleBorderClass = (role: TerminalSeat["role"]): string => {
  switch (role) {
    case "admin":
      return "border-amber-400";
    case "writer":
      return "border-emerald-500";
    case "requester":
      return "border-lime-500";
    default:
      return "border-rose-400";
  }
};

const presenceBadgeClass = (actor: Pick<TerminalSeat, "online" | "focused">): string => {
  if (!actor.online) {
    return "bg-slate-400";
  }
  if (actor.focused) {
    return "bg-blue-600";
  }
  return "bg-indigo-500";
};

const describeRole = (actor: TerminalSeat): string => {
  const parts: string[] = [actor.role];
  if (actor.currentAdmin) {
    parts.push("current admin");
  } else if (typeof actor.adminCandidateRank === "number") {
    parts.push(`admin candidate #${actor.adminCandidateRank + 1}`);
  }
  if (actor.leaseExpiresAt) {
    parts.push(`lease until ${new Date(actor.leaseExpiresAt).toLocaleString()}`);
  }
  if (actor.invalidCredential) {
    parts.push("credential invalid");
  }
  return parts.join(" · ");
};

const fallbackLabel = (actorId: string): string => {
  const value = actorId.split(":").at(-1) ?? actorId;
  return value.length > 0 ? value : actorId;
};

const ActorChip = ({
  actor,
  meta,
}: {
  actor: TerminalSeat;
  meta: TerminalActorMeta | null;
}) => {
  const label = meta?.label ?? actor.label ?? fallbackLabel(actor.actorId);
  const tooltip = (
    <div className="max-w-[22rem] space-y-1 text-left">
      <p className="font-medium text-slate-900">{label}</p>
      <p className="break-all text-slate-600">{actor.actorId}</p>
      {meta?.subtitle ? <p className="break-all text-slate-600">{meta.subtitle}</p> : null}
      <div className="flex flex-wrap gap-1">
        <Badge variant="secondary">{describeRole(actor)}</Badge>
        <Badge variant="secondary">{actor.online ? (actor.focused ? "online + focused" : "online") : "offline"}</Badge>
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltip}>
      <span className="relative inline-flex">
        <ProfileImage
          src={meta?.iconUrl}
          label={label}
          alt={label}
          className={cn(
            "h-9 w-9 rounded-full border-2 bg-white text-[11px] shadow-xs",
            roleBorderClass(actor.role),
            actor.currentAdmin ? "ring-2 ring-amber-200 ring-offset-2 ring-offset-white" : "",
          )}
        />
        <span
          className={cn(
            "absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white",
            presenceBadgeClass(actor),
          )}
        />
      </span>
    </Tooltip>
  );
};

export const TerminalActorGroup = ({
  actors,
  resolveActorMeta,
  maxVisible = 6,
  className,
}: TerminalActorGroupProps) => {
  if (actors.length === 0) {
    return (
      <div className={cn("inline-flex items-center gap-2 text-xs text-slate-500", className)}>
        <span className="inline-flex h-9 items-center rounded-full border border-dashed border-slate-300 px-3">
          No attached actors
        </span>
      </div>
    );
  }

  const visible = actors.slice(0, maxVisible);
  const hiddenCount = Math.max(0, actors.length - visible.length);

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className="flex items-center -space-x-2">
        {visible.map((actor) => (
          <ActorChip key={actor.actorId} actor={actor} meta={resolveActorMeta?.(actor.actorId) ?? null} />
        ))}
        {hiddenCount > 0 ? (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-600 shadow-xs">
            +{hiddenCount}
          </span>
        ) : null}
      </div>
      <span className="hidden text-xs text-slate-500 md:inline">{actors.length} seats</span>
    </div>
  );
};
