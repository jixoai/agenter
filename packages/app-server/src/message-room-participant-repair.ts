import { type MessageContactId, type MessageControlPlane, type MessageControlPlaneEntry } from "@agenter/message-system";

const isCanonicalMessageContactId = (value: string): value is MessageContactId =>
  value.startsWith("auth:") || value.startsWith("session:") || value.startsWith("system:");

export const roomNeedsParticipantRepair = (channel: Pick<MessageControlPlaneEntry, "participants">): boolean =>
  channel.participants.some((participant) => !isCanonicalMessageContactId(participant.id.trim()));

export const repairRoomParticipantsIfNeeded = (
  messageSystem: MessageControlPlane,
  channel: MessageControlPlaneEntry,
): MessageControlPlaneEntry => {
  if (!roomNeedsParticipantRepair(channel)) {
    return channel;
  }
  return messageSystem.updateChannelAuthorized({
    chatId: channel.chatId,
    accessToken: channel.accessToken,
    patch: {
      participants: channel.participants,
    },
  });
};
