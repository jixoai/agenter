import type { MessageControlPlaneEntry } from "@agenter/message-system";

interface MutableMessageSeatEntry {
  actorId: string;
  label?: string;
  online?: boolean;
  focused?: boolean;
}

export interface MessageSeatEntry {
  actorId: string;
  label: string;
  online?: boolean;
  focused?: boolean;
}

export interface MessageChannelPresenceSummary {
  totalSeatCount: number;
  participantLabels: string[];
  onlineLabels: string[];
  offlineLabels: string[];
  focusedLabels: string[];
}

const normalizeLabel = (label: string | undefined): string | undefined => {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const isFriendlyLabel = (label: string | undefined, actorId: string): label is string => {
  const normalized = normalizeLabel(label);
  return normalized !== undefined && normalized !== actorId;
};

const resolvePreferredSeatLabel = (
  actorId: string,
  existingLabel: string | undefined,
  incomingLabel: string | undefined,
): string => {
  if (isFriendlyLabel(existingLabel, actorId)) {
    return existingLabel;
  }
  if (isFriendlyLabel(incomingLabel, actorId)) {
    return incomingLabel;
  }
  return normalizeLabel(existingLabel) ?? normalizeLabel(incomingLabel) ?? actorId;
};

const upsertSeat = (
  roster: Map<string, MutableMessageSeatEntry>,
  input: MutableMessageSeatEntry,
): void => {
  const existing = roster.get(input.actorId);
  roster.set(input.actorId, {
    actorId: input.actorId,
    label: resolvePreferredSeatLabel(input.actorId, existing?.label, input.label),
    online: input.online ?? existing?.online,
    focused: input.focused ?? existing?.focused,
  });
};

export const listMessageSeatEntries = (channel: MessageControlPlaneEntry): MessageSeatEntry[] => {
  const roster = new Map<string, MutableMessageSeatEntry>();
  for (const participant of channel.participants) {
    upsertSeat(roster, {
      actorId: participant.id,
      label: participant.label,
    });
  }
  for (const state of channel.readStates ?? []) {
    upsertSeat(roster, {
      actorId: state.actorId,
      label: state.label,
      online: state.online,
      focused: state.focused,
    });
  }
  return [...roster.values()].map((entry) => ({
    actorId: entry.actorId,
    label: resolvePreferredSeatLabel(entry.actorId, entry.label, undefined),
    online: entry.online,
    focused: entry.focused,
  }));
};

export const summarizeMessageChannelPresence = (channel: MessageControlPlaneEntry): MessageChannelPresenceSummary => {
  const seats = listMessageSeatEntries(channel);
  return {
    totalSeatCount: seats.length,
    participantLabels: seats.map((seat) => seat.label),
    onlineLabels: seats.filter((seat) => seat.online === true).map((seat) => seat.label),
    offlineLabels: seats.filter((seat) => seat.online === false).map((seat) => seat.label),
    focusedLabels: seats.filter((seat) => seat.focused === true).map((seat) => seat.label),
  };
};
