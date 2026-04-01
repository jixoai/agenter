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
}

export interface RoomParticipantDraft {
  key: string;
  id: string;
}

export const buildDefaultRoomParticipantDrafts = (): RoomParticipantDraft[] => [];

export const toRoomParticipantDrafts = (
  participants: RoomParticipantInput[],
  keySalt: string | number,
): RoomParticipantDraft[] =>
  participants.map((participant, index) => ({
    key: `participant-${participant.id || "unknown"}-${index}-${keySalt}`,
    id: participant.id,
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
    });
  }

  return participants;
};
