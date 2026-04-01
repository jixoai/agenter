import { Plus, Trash2, UserRoundSearch } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ProfileImage } from "../../components/ui/profile-image";
import { Select } from "../../components/ui/select";
import type { RoomActorOption, RoomParticipantDraft, RoomParticipantRole } from "./room-participants";

interface RoomParticipantEditorProps {
  participants: RoomParticipantDraft[];
  actorOptions: RoomActorOption[];
  canEdit: boolean;
  fieldIdPrefix: string;
  onActorChange: (key: string, actorId: string) => void;
  onRoleChange: (key: string, role: RoomParticipantRole) => void;
  onRemove: (key: string) => void;
  onAdd?: () => void;
}

export const RoomParticipantEditor = ({
  participants,
  actorOptions,
  canEdit,
  fieldIdPrefix,
  onActorChange,
  onRoleChange,
  onRemove,
  onAdd,
}: RoomParticipantEditorProps) => {
  const actorMeta = new Map(actorOptions.map((option) => [option.actorId, option]));

  return (
    <div className="space-y-2">
      {participants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          No actors are selected for this room yet.
        </div>
      ) : null}

      {participants.map((participant, index) => {
        const actor = actorMeta.get(participant.id);
        const hasUnavailableSource = Boolean(participant.id) && !actor;

        return (
          <div
            key={participant.key}
            className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_7rem_auto]"
          >
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600" htmlFor={`${fieldIdPrefix}-actor-${participant.key}`}>
                Actor
              </label>
              <Select
                id={`${fieldIdPrefix}-actor-${participant.key}`}
                aria-label={`Participant actor ${index + 1}`}
                disabled={!canEdit}
                value={participant.id}
                onChange={(event) => onActorChange(participant.key, event.currentTarget.value)}
              >
                <option value="">Select actor</option>
                {hasUnavailableSource ? <option value={participant.id}>Unavailable source · {participant.id}</option> : null}
                {actorOptions.map((option) => (
                  <option key={option.actorId} value={option.actorId}>
                    {[option.label, option.actorKind, option.subtitle].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              {actor ? (
                <div className="flex items-center gap-3">
                  <ProfileImage src={actor.iconUrl} label={actor.label} className="h-9 w-9 rounded-2xl" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{actor.label}</p>
                      <Badge variant="secondary">{actor.actorKind}</Badge>
                    </div>
                    <p className="break-all text-xs text-slate-500">{actor.subtitle ?? actor.actorId}</p>
                  </div>
                </div>
              ) : participant.id ? (
                <div className="space-y-1 text-xs text-amber-700">
                  <div className="flex items-center gap-2 font-medium">
                    <UserRoundSearch className="h-3.5 w-3.5" />
                    <span>Source unavailable</span>
                  </div>
                  <p className="break-all text-slate-500">{participant.id}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select an auth actor or a session actor.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600" htmlFor={`${fieldIdPrefix}-role-${participant.key}`}>
                Role
              </label>
              <Select
                id={`${fieldIdPrefix}-role-${participant.key}`}
                aria-label={`Participant role ${index + 1}`}
                disabled={!canEdit}
                value={participant.role}
                onChange={(event) => onRoleChange(participant.key, event.currentTarget.value as RoomParticipantRole)}
              >
                <option value="avatar">avatar</option>
                <option value="user">user</option>
                <option value="system">system</option>
              </Select>
            </div>

            {canEdit ? (
              <div className="flex items-end justify-end">
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove participant ${index + 1}`} onClick={() => onRemove(participant.key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}

      {canEdit && onAdd ? (
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add participant
        </Button>
      ) : null}
    </div>
  );
};
