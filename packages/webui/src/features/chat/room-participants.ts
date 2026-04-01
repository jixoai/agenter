export type RoomParticipantRole = "avatar" | "user" | "system";

export interface RoomActorOption {
  actorId: string;
  actorKind: "auth" | "session";
  label: string;
  subtitle?: string;
  iconUrl?: string | null;
}

export interface RoomParticipantInput {
  id: string;
  label?: string;
  role?: RoomParticipantRole;
}

export interface RoomParticipantDraft {
  key: string;
  id: string;
  role: RoomParticipantRole;
}

const resolveRoleFromActorId = (actorId: string): RoomParticipantRole => {
  if (actorId.startsWith("session:")) {
    return "avatar";
  }
  if (actorId.startsWith("auth:")) {
    return "user";
  }
  return "system";
};

export const resolveRoomParticipantRole = (
  actorOptions: RoomActorOption[],
  actorId: string,
  fallback: RoomParticipantRole = resolveRoleFromActorId(actorId),
): RoomParticipantRole => {
  const option = actorOptions.find((entry) => entry.actorId === actorId);
  if (!option) {
    return fallback;
  }
  return option.actorKind === "session" ? "avatar" : "user";
};

export const buildDefaultRoomParticipantDrafts = (actorOptions: RoomActorOption[]): RoomParticipantDraft[] =>
  actorOptions
    .filter((option) => option.actorKind === "session")
    .map((option, index) => ({
      key: `participant-${option.actorId}-${index}`,
      id: option.actorId,
      role: resolveRoomParticipantRole(actorOptions, option.actorId),
    }));

export const toRoomParticipantDrafts = (
  participants: RoomParticipantInput[],
  actorOptions: RoomActorOption[],
  keySalt: string | number,
): RoomParticipantDraft[] =>
  participants.map((participant, index) => ({
    key: `participant-${participant.id || "unknown"}-${index}-${keySalt}`,
    id: participant.id,
    role: resolveRoomParticipantRole(actorOptions, participant.id, participant.role ?? "user"),
  }));

export const normalizeRoomParticipants = (
  drafts: RoomParticipantDraft[],
  actorOptions: RoomActorOption[],
): RoomParticipantInput[] => {
  const actorMeta = new Map(actorOptions.map((option) => [option.actorId, option]));
  const seen = new Set<string>();
  const participants: RoomParticipantInput[] = [];

  for (const draft of drafts) {
    const id = draft.id.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const actor = actorMeta.get(id);
    participants.push({
      id,
      label: actor?.label,
      role: resolveRoomParticipantRole(actorOptions, id, draft.role),
    });
  }

  return participants;
};
