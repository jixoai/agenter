import type {
  MessageContactRecord,
  MessageContactRequestRecord,
  MessageControlPlaneEntry,
  MessageRecord,
  MessageSourceSubscriptionRecord,
} from "@agenter/message-system";
import type { WebChatComposerMentionSuggestion } from "@agenter/web-chat-view";

import type { ReviewPeopleEnvelope, ReviewProfile } from "./review-example.types";

export type ReviewShellDestination = "messages" | "contacts" | "me";

export interface ReviewConversationProjection {
  id: string;
  chatId: string | null;
  title: string;
  subtitle: string;
  meta: string;
  badge: number | null;
  avatarLabel: string;
  kind: "room" | "direct" | "system";
  contactKey: string | null;
  openableRoom: boolean;
}

export interface ReviewContactProjection {
  key: string;
  ownerActorId: string;
  sourceId: string;
  sourceLabel: string;
  remoteActorId: string;
  label: string;
  subtitle: string;
  iconUrl: string | null;
  directLabel: string;
  localDirectChatId: string | null;
  record: MessageContactRecord;
}

export interface ReviewContactRequestProjection {
  key: string;
  direction: MessageContactRequestRecord["direction"];
  state: MessageContactRequestRecord["state"];
  sourceId: string;
  sourceLabel: string;
  remoteActorId: string;
  label: string;
  subtitle: string;
  iconUrl: string | null;
  message: string | null;
  record: MessageContactRequestRecord;
}

export interface ReviewSourceProjection {
  sourceId: string;
  label: string;
  endpoint: string;
  callbackSummary: string;
  trustState: string;
  contactCount: number;
  pendingRequestCount: number;
  record: MessageSourceSubscriptionRecord;
}

export interface ReviewPeopleProjection {
  conversations: ReviewConversationProjection[];
  contacts: ReviewContactProjection[];
  contactRequests: ReviewContactRequestProjection[];
  sources: ReviewSourceProjection[];
  pendingRequestCount: number;
}

export const createContactIdentity = (contact: Pick<MessageContactRecord, "ownerActorId" | "sourceId" | "remoteActorId">): string =>
  `${contact.ownerActorId}::${contact.sourceId}::${contact.remoteActorId}`;

export const createRequestIdentity = (request: Pick<MessageContactRequestRecord, "ownerActorId" | "requestId">): string =>
  `${request.ownerActorId}::${request.requestId}`;

export const createContactMentionSuggestions = (
  contacts: readonly ReviewContactProjection[],
): WebChatComposerMentionSuggestion[] =>
  contacts.map((contact) => ({
    id: contact.key,
    label: contact.label,
    apply: `@${contact.label}`,
    detail: `${contact.sourceLabel} · ${contact.remoteActorId}`,
    iconUrl: contact.iconUrl ?? undefined,
  }));

const avatarLabel = (label: string): string => {
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  const words = trimmed.split(/\s+/u).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word.slice(0, 1).toUpperCase())
      .join("");
  }
  return trimmed.slice(0, 2).toUpperCase();
};

const metadataString = (metadata: Record<string, unknown> | undefined, key: string): string | null => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const sourceLabelById = (sources: readonly MessageSourceSubscriptionRecord[]): Map<string, string> =>
  new Map(sources.map((source) => [source.sourceId, source.label || source.sourceId]));

const formatLatestMeta = (message: MessageRecord | undefined): string => {
  if (!message?.createdAt) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(message.createdAt));
};

const latestMessageSummary = (message: MessageRecord | undefined): string => {
  const content = message?.content?.trim();
  if (!content) {
    return "No messages yet";
  }
  return content.replace(/\s+/gu, " ").slice(0, 72);
};

const projectActiveRoomConversation = (
  channel: MessageControlPlaneEntry | null,
  messages: readonly MessageRecord[],
  profile: ReviewProfile | null,
): ReviewConversationProjection[] => {
  if (!channel) {
    return [
      {
        id: "review-setup",
        chatId: null,
        title: "Review room needed",
        subtitle: "Save or import URL + token to connect",
        meta: "",
        badge: null,
        avatarLabel: "R",
        kind: "system",
        contactKey: null,
        openableRoom: false,
      },
    ];
  }
  const latest = messages.at(-1);
  return [
    {
      id: `room:${channel.chatId}`,
      chatId: channel.chatId,
      title: channel.title,
      subtitle: latestMessageSummary(latest),
      meta: formatLatestMeta(latest),
      badge: null,
      avatarLabel: avatarLabel(channel.title),
      kind: "room",
      contactKey: null,
      openableRoom: Boolean(profile),
    },
  ];
};

const projectDirectConversations = (
  contacts: readonly ReviewContactProjection[],
  activeChannel: MessageControlPlaneEntry | null,
): ReviewConversationProjection[] =>
  contacts
    .filter((contact) => contact.localDirectChatId)
    .map((contact) => ({
      id: `direct:${contact.key}`,
      chatId: contact.localDirectChatId,
      title: contact.label,
      subtitle: `${contact.sourceLabel} · ${contact.subtitle}`,
      meta: contact.directLabel,
      badge: null,
      avatarLabel: avatarLabel(contact.label),
      kind: "direct" as const,
      contactKey: contact.key,
      openableRoom: Boolean(contact.localDirectChatId && contact.localDirectChatId === activeChannel?.chatId),
    }));

export const buildReviewPeopleProjection = (input: {
  people: ReviewPeopleEnvelope | null;
  activeProfile: ReviewProfile | null;
  activeChannel: MessageControlPlaneEntry | null;
  initialMessages: readonly MessageRecord[];
}): ReviewPeopleProjection => {
  const sources = input.people?.sources ?? [];
  const sourceLabels = sourceLabelById(sources);
  const contacts = (input.people?.contacts ?? [])
    .map<ReviewContactProjection>((contact) => {
      const sourceLabel = sourceLabels.get(contact.sourceId) ?? contact.sourceId;
      return {
        key: createContactIdentity(contact),
        ownerActorId: contact.ownerActorId,
        sourceId: contact.sourceId,
        sourceLabel,
        remoteActorId: contact.remoteActorId,
        label: contact.label,
        subtitle: contact.subtitle ?? contact.remoteActorId,
        iconUrl: contact.iconUrl ?? null,
        directLabel: contact.localDirectChatId ? "direct" : "contact",
        localDirectChatId: contact.localDirectChatId ?? null,
        record: contact,
      };
    })
    .sort((left, right) => left.sourceLabel.localeCompare(right.sourceLabel) || left.label.localeCompare(right.label));

  const contactRequests = (input.people?.contactRequests ?? []).map<ReviewContactRequestProjection>((request) => ({
    key: createRequestIdentity(request),
    direction: request.direction,
    state: request.state,
    sourceId: request.sourceId,
    sourceLabel: sourceLabels.get(request.sourceId) ?? request.sourceId,
    remoteActorId: request.remoteActorId,
    label: request.remoteLabel ?? request.remoteActorId,
    subtitle: request.remoteSubtitle ?? `${request.direction} · ${request.state}`,
    iconUrl: request.remoteIconUrl ?? null,
    message: request.message ?? null,
    record: request,
  }));

  const sourceProjections = sources.map<ReviewSourceProjection>((source) => {
    const pendingRequestCount = contactRequests.filter(
      (request) => request.sourceId === source.sourceId && request.state === "pending",
    ).length;
    return {
      sourceId: source.sourceId,
      label: source.label || source.sourceId,
      endpoint: source.endpoint,
      callbackSummary: source.callbackSourceId
        ? `${source.callbackSourceId}${source.callbackEndpoint ? ` · ${source.callbackEndpoint}` : ""}`
        : "No callback source",
      trustState: metadataString(source.metadata, "health") ?? "ready",
      contactCount: contacts.filter((contact) => contact.sourceId === source.sourceId).length,
      pendingRequestCount,
      record: source,
    };
  });

  return {
    conversations: [
      ...projectActiveRoomConversation(input.activeChannel, input.initialMessages, input.activeProfile),
      ...projectDirectConversations(contacts, input.activeChannel),
    ],
    contacts,
    contactRequests,
    sources: sourceProjections,
    pendingRequestCount: contactRequests.filter((request) => request.state === "pending").length,
  };
};
