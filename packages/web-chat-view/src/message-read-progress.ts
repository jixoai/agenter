import type { MessageContactId } from "@agenter/message-system/types";

import { fallbackActorLabel, resolveMessageActorId } from "./message-utils";
import type {
  WebChatActorPresentation,
  WebChatActorResolveInput,
  WebChatMessageReadActor,
  WebChatMessageReadProgress,
  WebChatMessageRenderInput,
} from "./types";

type ResolveActorPresentation = (input: WebChatActorResolveInput) => WebChatActorPresentation | null;

const uniqueContactIds = (contactIds: readonly MessageContactId[] | undefined): MessageContactId[] => {
  if (!Array.isArray(contactIds)) {
    return [];
  }
  return [...new Set(contactIds)];
};

const resolveReadStatusSenderContactId = (renderInput: WebChatMessageRenderInput): MessageContactId | null => {
  return (
    renderInput.message.senderContactId ??
    resolveMessageActorId(renderInput.channel, renderInput.message, renderInput.viewerActorId)
  );
};

const filterOutSenderContactId = (
  contactIds: readonly MessageContactId[] | undefined,
  senderContactId: MessageContactId | null,
): MessageContactId[] => {
  const normalizedContactIds = uniqueContactIds(contactIds);
  if (!senderContactId) {
    return normalizedContactIds;
  }
  return normalizedContactIds.filter((contactId) => contactId !== senderContactId);
};

const resolveActorFallbackLabel = (input: {
  actorId: MessageContactId;
  renderInput: WebChatMessageRenderInput;
}): string => {
  const seat = input.renderInput.channel.seatStates?.find((candidate) => candidate.contactId === input.actorId);
  const participant = input.renderInput.channel.participants.find((candidate) => candidate.id === input.actorId);
  return (
    seat?.label ??
    participant?.label ??
    (input.actorId === input.renderInput.viewerActorId ? "You" : fallbackActorLabel(input.actorId))
  );
};

const resolveReadActor = (
  actorId: MessageContactId,
  renderInput: WebChatMessageRenderInput,
  resolveActorPresentation: ResolveActorPresentation | undefined,
): WebChatMessageReadActor => {
  const fallbackLabel = resolveActorFallbackLabel({ actorId, renderInput });
  const presentation = resolveActorPresentation?.({
    channel: renderInput.channel,
    message: renderInput.message,
    viewerActorId: renderInput.viewerActorId,
    role: actorId === renderInput.viewerActorId ? "viewer" : "participant",
    actorId,
    fallbackLabel,
  });
  return {
    actorId,
    label: presentation?.label ?? fallbackLabel,
    subtitle: presentation?.subtitle ?? actorId,
    iconUrl: presentation?.iconUrl ?? null,
  };
};

export const resolveDefaultMessageReadProgress = (
  renderInput: WebChatMessageRenderInput,
  resolveActorPresentation?: ResolveActorPresentation,
): WebChatMessageReadProgress | null => {
  const senderContactId = resolveReadStatusSenderContactId(renderInput);
  const readContactIds = filterOutSenderContactId(renderInput.message.readContactIds, senderContactId);
  const readContactIdSet = new Set<MessageContactId>(readContactIds);
  const unreadContactIds = filterOutSenderContactId(renderInput.message.unreadContactIds, senderContactId).filter(
    (contactId) => !readContactIdSet.has(contactId),
  );
  const totalCount = readContactIds.length + unreadContactIds.length;
  if (totalCount === 0) {
    return null;
  }
  return {
    readCount: readContactIds.length,
    totalCount,
    readActors: readContactIds.map((actorId) => resolveReadActor(actorId, renderInput, resolveActorPresentation)),
    unreadActors: unreadContactIds.map((actorId) => resolveReadActor(actorId, renderInput, resolveActorPresentation)),
  };
};
