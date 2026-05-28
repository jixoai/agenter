import { createHash, randomUUID } from "node:crypto";

import {
  buildManagedInvitationAcceptPayload,
  buildManagedInvitationShareDescriptor,
  createManagedInvitationId,
  createManagedInvitationToken,
  digestManagedInvitationPayload,
  hashManagedInvitationToken,
  isManagedInvitationExpired,
  parseManagedInvitationDescriptorInput,
  validateManagedInvitationRecipientBinding,
  verifyManagedInvitationAcceptProof,
} from "@agenter/managed-seat-invitation-handshake";
import { AttentionControlPlane } from "@agenter/attention-system";
import {
  generatePrincipalKeyPair,
  isPrincipalId,
  normalizePrincipalId,
  type PrincipalId,
} from "@agenter/principal-crypto";
import { MessageDb } from "./message-db";
import { MessageFollowUpRuntime, type MessageFollowUpSink } from "./message-follow-up-runtime";
import { resolveDefaultMessageControlDbPath } from "./message-paths";
import type { MessageAuthorizedQueryInput, MessageQueryResult } from "./message-query-types";
import type {
  CommitWaitHandle,
  MessageAcceptSeatInput,
  MessageContactId,
  MessageContactStateRecord,
  MessageAdminWorkItem,
  MessageAppendInput,
  MessageAuthorizedEditInput,
  MessageAuthorizedMarkReadInput,
  MessageAuthorizedPageInput,
  MessageAuthorizedReadInput,
  MessageAuthorizedRecallInput,
  MessageAuthorizedWriteInput,
  MessageChannelAccessProjection,
  MessageChannelAccessRole,
  MessageChannelGrantRecord,
  MessageChannelPatchInput,
  MessageConfigSeatInput,
  MessageContactRecord,
  MessageContactRequestCreateInput,
  MessageContactRequestDirection,
  MessageContactRequestRecord,
  MessageContactRequestState,
  MessageContactUpsertInput,
  MessageControlPlaneConfig,
  MessageControlPlaneConfigPatch,
  MessageControlPlaneEntry,
  MessageCreateInitialUserInput,
  MessageCreateInput,
  MessageEditInput,
  MessageFocusOp,
  MessageFollowUpReminderPresentation,
  MessageFollowUpRequest,
  MessageFollowUpTaskRecord,
  MessageInvitationRecord,
  MessageInviteSeatInput,
  MessageIssueGrantInput,
  MessageIssuedGrant,
  MessageManagedSeatClass,
  MessageManagedSeatPayload,
  MessageParticipant,
  MessageRecallInput,
  MessageRecord,
  MessageRevokeSeatInput,
  MessageSeatStateProjection,
  MessageSnapshot,
  MessageSourceSubscriptionInput,
  MessageSourceSubscriptionRecord,
  MessageSystemIdentity,
  MessageTranscriptPage,
  MessageTransportClientMessage,
  MessageTransportConfig,
  MessageTransportEndpoint,
  MessageTransportServerMessage,
  MessageUnreadRoomSummary,
  ReversePage,
  ReverseTimeCursor,
} from "./types";

const truncateFollowUpTitle = (value: string, limit = 64): string => {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit - 1)}...`;
};

const toYamlLikeBlock = (input: Record<string, unknown>): string =>
  Object.entries(input)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");

const mdFence = (language: string, value: string): string => `\`\`\`${language}\n${value}\n\`\`\``;

export const buildMessageFollowUpReminderPresentation = (input: {
  chatId: string;
  anchorMessageId: number;
  dueAt: number;
  messageContent: string;
}): MessageFollowUpReminderPresentation => {
  const trimmedContent = input.messageContent.trim();
  const titleSuffix =
    trimmedContent.length > 0 ? truncateFollowUpTitle(trimmedContent) : `message ${input.anchorMessageId}`;
  const metaYaml = toYamlLikeBlock({
    kind: "message-follow-up-reminder",
    chatId: input.chatId,
    anchorMessageId: input.anchorMessageId,
    dueAt: new Date(input.dueAt).toISOString(),
  });
  const body = trimmedContent.length > 0 ? mdFence("text", input.messageContent) : "_empty room message_";
  return {
    title: `Re-evaluate room follow-up: ${titleSuffix}`,
    detailValue: [mdFence("yaml", metaYaml), body].join("\n\n"),
    detailFormat: "text/markdown",
    detailKind: "replace",
  };
};

interface Waiter {
  afterVersion: number;
  resolve: (value: { version: string }) => void;
  reject: (reason: unknown) => void;
  active: boolean;
}

interface UnreadWaiter {
  contactId: MessageContactId;
  afterVersion: number;
  resolve: (value: { contactId: MessageContactId; version: string }) => void;
  reject: (reason: unknown) => void;
  active: boolean;
}

interface MessageSocketData {
  chatId: string;
  contactId: string | null;
  accessRole: MessageChannelAccessRole;
  accessToken: string;
  cleanup: Array<() => void>;
}

interface ContactPresence {
  online: boolean;
  expiresAt: number | null;
  invalidCredential: boolean;
}

type MessageChannelChangeReason =
  | "created"
  | "updated"
  | "archived"
  | "deleted"
  | "message"
  | "read"
  | "grant-issued"
  | "grant-revoked"
  | "focus"
  | "presence";

interface MessageChannelChangePayload {
  chatId: string;
  reason: MessageChannelChangeReason;
  builtIn: boolean;
  roomRevision: string;
  transcriptRevision: string;
  contactId?: MessageContactId;
}

const TRUSTED_BOOTSTRAP_LABEL = "Trusted bootstrap";
const TRUSTED_BOOTSTRAP_PARTICIPANT_ID: MessageContactId = "system:trusted-bootstrap";
const ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY = "roomAdminGroupCandidateIds";
const ROOM_CURRENT_ADMIN_ID_KEY = "currentRoomAdminId";
const ROOM_PENDING_ADMIN_WORK_KEY = "pendingAdminWork";
const TRANSIENT_CONTACT_PRESENCE_TTL_MS = 90_000;
const DEFAULT_MANAGED_INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const cloneTransport = (input?: MessageTransportConfig): MessageTransportConfig => ({
  host: input?.host ?? "127.0.0.1",
  port: input?.port ?? null,
  pathPrefix: input?.pathPrefix ?? "/room",
});

const parseClientMessage = (raw: string): MessageTransportClientMessage | null => {
  try {
    const parsed = JSON.parse(raw) as MessageTransportClientMessage;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const parseVersion = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
const createOpaqueToken = (): string => `msgtok_${randomUUID().replace(/-/g, "")}`;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;
const LEGACY_CONTACT_ID_PATTERN = /^(auth|session|system):.+$/;
const fallbackContactLabel = (contactId: string): string => contactId.split(":").at(-1) ?? contactId;

const isCanonicalContactId = (value: string): value is MessageContactId =>
  isPrincipalId(value) ||
  (LEGACY_CONTACT_ID_PATTERN.test(value) &&
    (value.startsWith("auth:") || value.startsWith("session:") || value.startsWith("system:")));

const normalizeChannelParticipants = (participants?: MessageParticipant[]): MessageParticipant[] | undefined => {
  if (!participants) {
    return undefined;
  }
  const seen = new Set<string>();
  const normalized: MessageParticipant[] = [];
  for (const participant of participants) {
    const id = participant.id.trim();
    if (!isCanonicalContactId(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const label = participant.label?.trim();
    normalized.push(label ? { id, label } : { id });
  }
  return normalized;
};

const normalizeCreateInitialUsers = (
  initialUsers?: MessageCreateInitialUserInput[],
): MessageCreateInitialUserInput[] | undefined => {
  if (!initialUsers) {
    return undefined;
  }
  const normalized = new Map<MessageContactId, MessageCreateInitialUserInput>();
  for (const user of initialUsers) {
    const contactId = user.contactId.trim();
    if (!isCanonicalContactId(contactId)) {
      throw new Error("room initial user contactId must be a principal id or auth:/session:/system: contact id");
    }
    const current = normalized.get(contactId);
    const currentRank = current ? roleRank(current.role) : -1;
    const nextRank = roleRank(user.role);
    const label = user.label?.trim() || current?.label;
    normalized.set(contactId, {
      contactId,
      label,
      role: nextRank >= currentRank ? user.role : current!.role,
      focused: Boolean(current?.focused || user.focused),
    });
  }
  return [...normalized.values()];
};

const mergeParticipantsWithInitialUsers = (
  participants: MessageParticipant[] | undefined,
  initialUsers: MessageCreateInitialUserInput[] | undefined,
): MessageParticipant[] | undefined => {
  if (!participants && !initialUsers?.length) {
    return undefined;
  }
  const merged = new Map<string, MessageParticipant>();
  for (const participant of participants ?? []) {
    merged.set(participant.id, participant);
  }
  for (const user of initialUsers ?? []) {
    merged.set(user.contactId, user.label ? { id: user.contactId, label: user.label } : { id: user.contactId });
  }
  return [...merged.values()];
};
const remapContactId = (
  contactId: MessageContactId | undefined,
  contactIdMap: ReadonlyMap<MessageContactId, MessageContactId>,
): MessageContactId | undefined => (contactId ? (contactIdMap.get(contactId) ?? contactId) : undefined);
const remapContactIds = (
  contactIds: readonly MessageContactId[],
  contactIdMap: ReadonlyMap<MessageContactId, MessageContactId>,
): MessageContactId[] =>
  [...new Set(contactIds.map((contactId) => contactIdMap.get(contactId) ?? contactId))].sort((left, right) =>
    left.localeCompare(right),
  );

const roleRank = (role: MessageChannelAccessRole): number => {
  if (role === "admin") {
    return 2;
  }
  if (role === "member") {
    return 1;
  }
  return 0;
};

export class MessageControlPlane {
  private readonly db: MessageDb;
  private readonly followUpRuntime: MessageFollowUpRuntime;
  private readonly identity: MessageSystemIdentity;
  private readonly focusedChatIdsByContact = new Map<string, Set<string>>();
  private readonly contactPresence = new Map<string, ContactPresence>();
  private readonly trustedBootstrapTokens = new Map<string, string>();
  private readonly messageListeners = new Set<(payload: { chatId: string; message: MessageRecord }) => void>();
  private readonly channelChangeListeners = new Set<(payload: MessageChannelChangePayload) => void>();
  private readonly focusListeners = new Set<
    (payload: { contactId: string; chatIds: string[]; changedChatIds: string[] }) => void
  >();
  private readonly waiters = new Set<Waiter>();
  private readonly unreadWaiters = new Set<UnreadWaiter>();
  private readonly unreadVersionByContact = new Map<MessageContactId, number>();
  private config: MessageControlPlaneConfig;
  private transportServer: Bun.Server<MessageSocketData> | null = null;
  private headVersion = 0;

  constructor(
    private readonly options: {
      dbPath?: string;
      initialConfig?: MessageControlPlaneConfig;
      superadminContactId?: PrincipalId;
      systemId?: PrincipalId;
      roomManagementRoot?: string;
    } = {},
  ) {
    const superadminContactId = options.superadminContactId
      ? normalizePrincipalId(options.superadminContactId)
      : generatePrincipalKeyPair().principalId;
    const systemId = normalizePrincipalId(options.systemId ?? superadminContactId);
    this.identity = {
      systemId,
      superadminContactId,
      defaultLocal: systemId === superadminContactId,
    };
    this.config = {
      defaultOwner: options.initialConfig?.defaultOwner ?? "agenter",
      transport: cloneTransport(options.initialConfig?.transport),
    };
    this.db = new MessageDb(options.dbPath ?? resolveDefaultMessageControlDbPath());
    this.followUpRuntime = new MessageFollowUpRuntime({
      db: this.db,
      getMessage: (chatId, messageId) => this.db.getMessage(chatId, messageId),
      resolveLatestActiveVisibleMessage: (chatId) => this.db.resolveLatestActiveVisibleMessage(chatId),
      commitReminder: async (task) => {
        const presentation = buildMessageFollowUpReminderPresentation({
          chatId: task.chatId,
          anchorMessageId: task.messageId,
          dueAt: task.dueAt,
          messageContent: task.message.content,
        });
        const plane = new AttentionControlPlane({
          root: task.attentionRoot,
        });
        const result = await plane.commit({
          context: {
            contextId: task.attentionContextId,
            owner: task.attentionOwner,
          },
          commit: {
            ingressType: "commit",
            contextMutation: "preserve",
            meta: {
              author: task.attentionOwner,
              source: "message",
              src: `msg:${task.chatId}/${task.messageId}`,
              tags: ["message", "follow_up_reminder"],
              createdAt: new Date(task.dueAt).toISOString(),
            },
            scores: {
              [`msg:${task.chatId}/${task.messageId}`]: 100,
            },
            summary: presentation.title,
            change: {
              type: "update",
              value: presentation.detailValue,
              format: presentation.detailFormat,
            },
          },
        });
        return {
          reminderContextId: result.context.contextId,
          reminderCommitId: result.commit.commitId,
        };
      },
    });
  }

  getSystemIdentity(): MessageSystemIdentity {
    return { ...this.identity };
  }

  close(): void {
    this.stopTransport();
    this.trustedBootstrapTokens.clear();
    this.unreadVersionByContact.clear();
    this.followUpRuntime.close();
    this.db.close();
  }

  onMessage(listener: (payload: { chatId: string; message: MessageRecord }) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onChannelChanged(listener: (payload: MessageChannelChangePayload) => void): () => void {
    this.channelChangeListeners.add(listener);
    return () => this.channelChangeListeners.delete(listener);
  }

  onFocus(listener: (payload: { contactId: string; chatIds: string[]; changedChatIds: string[] }) => void): () => void {
    this.focusListeners.add(listener);
    return () => this.focusListeners.delete(listener);
  }

  setContactPresence(contactId: MessageContactId, input: { online: boolean; ttlMs?: number } | boolean): void {
    this.assertContactId(contactId);
    const online = typeof input === "boolean" ? input : input.online;
    const now = Date.now();
    const current = this.contactPresence.get(contactId);
    if (!online) {
      this.contactPresence.delete(contactId);
      this.db.touchContactState(contactId, {
        lastActiveAt: now,
        online: false,
      });
      this.syncAdminAssignments();
      if (current) {
        this.emitPresenceChanged(contactId);
      }
      return;
    }
    const ttlMs = typeof input === "boolean" ? undefined : input.ttlMs;
    this.contactPresence.set(contactId, {
      online: true,
      expiresAt: typeof ttlMs === "number" && ttlMs > 0 ? now + ttlMs : null,
      invalidCredential: current?.invalidCredential ?? false,
    });
    this.db.touchContactState(contactId, {
      lastActiveAt: now,
      lastLoginAt: current?.online ? undefined : now,
      online: true,
    });
    this.syncAdminAssignments();
    if (!current?.online) {
      this.emitPresenceChanged(contactId);
    }
  }

  setCredentialState(contactId: MessageContactId, input: { invalidCredential: boolean }): void {
    this.assertContactId(contactId);
    const current = this.contactPresence.get(contactId);
    this.contactPresence.set(contactId, {
      online: current?.online ?? false,
      expiresAt: current?.expiresAt ?? null,
      invalidCredential: input.invalidCredential,
    });
    if ((current?.invalidCredential ?? false) !== input.invalidCredential) {
      this.emitPresenceChanged(contactId);
    }
  }

  listChannelsForContact(
    contactId: MessageContactId,
    input: { includeArchived?: boolean; touchPresence?: boolean } = {},
  ): MessageControlPlaneEntry[] {
    this.assertContactId(contactId);
    if (input.touchPresence ?? true) {
      this.touchContactPresence(contactId);
    }
    const focusedIds = this.getFocusedChatIdsForContact(contactId);
    return this.db.listContactChannelAccess(contactId, input.includeArchived ?? false).map(({ channel, grant }) =>
      this.withProjection(
        {
          ...channel,
          focused: focusedIds.has(channel.chatId),
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        this.createProjection({
          chatId: channel.chatId,
          accessRole: grant.role,
          accessToken: grant.accessToken ?? this.issueContactAccessToken(channel.chatId, contactId, grant.role),
          participantId: grant.participantId as MessageContactId,
        }),
      ),
    );
  }

  getChannelForContact(
    chatId: string,
    contactId: MessageContactId,
    input: { includeArchived?: boolean; touchPresence?: boolean } = {},
  ): MessageControlPlaneEntry | undefined {
    return this.listChannelsForContact(contactId, input).find((channel) => channel.chatId === chatId);
  }

  listChannels(input: { includeArchived?: boolean } = {}): MessageControlPlaneEntry[] {
    return this.db
      .listChannels(this.getFocusedChatIdsForContact(TRUSTED_BOOTSTRAP_PARTICIPANT_ID), input.includeArchived ?? false)
      .map((channel) =>
        this.withProjection(
          {
            ...channel,
            metadata: this.withAdminState(channel.chatId, channel.metadata),
          },
          this.issueTrustedBootstrapAccess(channel.chatId),
        ),
      );
  }

  getChannel(chatId: string, input: { includeArchived?: boolean } = {}): MessageControlPlaneEntry | undefined {
    const channel = this.db.getChannel(
      chatId,
      this.getFocusedChatIdsForContact(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(chatId),
    );
    if (!channel) {
      return undefined;
    }
    if (channel.archivedAt && !input.includeArchived) {
      return undefined;
    }
    return channel
      ? this.withProjection(
          {
            ...channel,
            metadata: this.withAdminState(channel.chatId, channel.metadata),
          },
          this.issueTrustedBootstrapAccess(chatId),
        )
      : undefined;
  }

  getMessage(chatId: string, messageId: number): MessageRecord | undefined {
    return this.db.getMessage(chatId, messageId);
  }

  registerFollowUpSink(ownerSessionId: string, sink: MessageFollowUpSink): () => void {
    return this.followUpRuntime.registerSink(ownerSessionId, sink);
  }

  listFollowUpTasks(input: { chatId?: string; ownerSessionId?: string } = {}): MessageFollowUpTaskRecord[] {
    return this.followUpRuntime.listTasks(input);
  }

  createChannel(input: MessageCreateInput): MessageControlPlaneEntry {
    if (!isPrincipalId(input.chatId)) {
      throw new Error(`invalid room id: ${input.chatId}`);
    }
    const initialUsers = normalizeCreateInitialUsers(input.initialUsers);
    const participants = mergeParticipantsWithInitialUsers(
      normalizeChannelParticipants(input.participants),
      initialUsers,
    );
    this.assertRoomModeParticipants(participants, input.metadata);
    const channel = this.db.createChannel(
      {
        ...input,
        kind: "room",
        owner: input.owner ?? this.config.defaultOwner,
        superKey: input.superKey ?? this.identity.superadminContactId,
        systemId: input.systemId ?? this.identity.systemId,
        participants,
      },
      this.getFocusedChatIdsForContact(input.bootstrapContactId ?? TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(input.chatId),
    );
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: channel.chatId,
      reason: "created",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      roomRevision: channel.roomRevision,
      transcriptRevision: channel.transcriptRevision,
      contactId: input.bootstrapContactId,
    });
    const adminProjection = input.bootstrapContactId
      ? this.ensureContactAccess(input.chatId, input.bootstrapContactId, "admin", input.adminToken)
      : this.issueTrustedBootstrapAccess(input.chatId, input.adminToken);
    if (input.bootstrapContactId) {
      this.focusForContact(input.bootstrapContactId, "add", [input.chatId]);
    }

    for (const user of initialUsers ?? []) {
      if (input.bootstrapContactId && user.contactId === input.bootstrapContactId) {
        if (user.focused) {
          this.focusForContact(user.contactId, "add", [input.chatId]);
        }
        continue;
      }
      const issued = this.issueChannelGrantAuthorized({
        chatId: input.chatId,
        accessToken: adminProjection.accessToken,
        role: user.role,
        label: user.label,
        participantId: user.contactId,
      });
      if (user.focused) {
        this.focusAuthorized("add", [{ chatId: input.chatId, accessToken: issued.accessToken }]);
      }
    }

    if (input.bootstrapContactId) {
      return this.withProjection(
        {
          ...channel,
          focused: true,
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        adminProjection,
      );
    }
    return this.withProjection(
      {
        ...channel,
        metadata: this.withAdminState(channel.chatId, channel.metadata),
      },
      adminProjection,
    );
  }

  focus(op: MessageFocusOp = "replace", chatIds: string[] = []): string[] {
    return this.focusForContact(TRUSTED_BOOTSTRAP_PARTICIPANT_ID, op, chatIds);
  }

  focusForContact(contactId: MessageContactId, op: MessageFocusOp = "replace", chatIds: string[] = []): string[] {
    this.assertContactId(contactId);
    const validIds = chatIds.filter((chatId) => {
      const channel = this.db.getChannel(chatId);
      return Boolean(channel) && !channel?.archivedAt;
    });
    const previous = new Set(this.getFocusedChatIdsForContact(contactId));
    const current = new Set(previous);
    switch (op) {
      case "add":
        for (const chatId of validIds) {
          current.add(chatId);
        }
        break;
      case "remove":
        for (const chatId of validIds) {
          current.delete(chatId);
        }
        break;
      case "replace":
        current.clear();
        for (const chatId of validIds) {
          current.add(chatId);
        }
        break;
      case "clear":
        current.clear();
        break;
    }
    this.focusedChatIdsByContact.set(contactId, current);
    const changedChatIds = [
      ...new Set([...previous, ...current].filter((chatId) => previous.has(chatId) !== current.has(chatId))),
    ];
    if (changedChatIds.length > 0) {
      this.bumpVersion();
      for (const chatId of changedChatIds) {
        const revisions = this.db.bumpRoomRevision(chatId);
        this.emitChannelChanged({
          chatId,
          reason: "focus",
          builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(chatId)?.metadata),
          ...revisions,
          contactId,
        });
      }
    }
    const payload = { contactId, chatIds: [...current], changedChatIds };
    for (const listener of this.focusListeners) {
      listener(payload);
    }
    return payload.chatIds;
  }

  focusAuthorized(op: MessageFocusOp, access: Array<{ chatId: string; accessToken: string }>): string[] {
    const grants = access.map(({ chatId, accessToken }) => this.requireAccess(chatId, accessToken, "readonly"));
    const contactId = grants[0]?.participantId;
    if (!contactId || !isCanonicalContactId(contactId)) {
      return this.focus(
        op,
        grants.map((grant) => grant.chatId),
      );
    }
    const allowedChatIds = grants
      .map((grant) => grant.chatId)
      .filter((chatId, index, items) => items.indexOf(chatId) === index);
    return this.focusForContact(contactId as MessageContactId, op, allowedChatIds);
  }

  getFocusedChatIds(contactId: MessageContactId = TRUSTED_BOOTSTRAP_PARTICIPANT_ID): string[] {
    return [...this.getFocusedChatIdsForContact(contactId)];
  }

  private isBuiltInChannelMetadata(metadata: Record<string, unknown> | undefined): boolean {
    return metadata?.builtIn === true;
  }

  private resolveAuthorizedQueryChatIds(input: MessageAuthorizedQueryInput): string[] {
    const requested = input.chatId;
    if (typeof requested === "string" && requested !== "*") {
      if (input.accessToken) {
        this.requireAccess(requested, input.accessToken, "readonly");
        return [requested];
      }
      if (input.contactId && !input.superadminContactId) {
        const room = this.getChannelForContact(requested, input.contactId, {
          includeArchived: false,
          touchPresence: false,
        });
        if (!room) {
          throw new Error("message room credential-invalid");
        }
        return [requested];
      }
      const room = this.getChannel(requested, { includeArchived: false });
      if (!room) {
        throw new Error(`unknown message room: ${requested}`);
      }
      return [requested];
    }

    if (input.accessToken) {
      throw new Error("message query accessToken only supports a single room");
    }

    if (input.contactId && !input.superadminContactId) {
      const allowed = this.listChannelsForContact(input.contactId, {
        includeArchived: false,
        touchPresence: false,
      }).map((channel) => channel.chatId);
      if (requested === "*") {
        return allowed;
      }
      const wanted = [...new Set(requested)];
      const allowedSet = new Set(allowed);
      const denied = wanted.filter((chatId) => !allowedSet.has(chatId));
      if (denied.length > 0) {
        throw new Error("message room credential-invalid");
      }
      return wanted;
    }

    const available = this.listChannels({ includeArchived: false }).map((channel) => channel.chatId);
    if (requested === "*") {
      return available;
    }
    const known = new Set(available);
    for (const chatId of requested) {
      if (!known.has(chatId)) {
        throw new Error(`unknown message room: ${chatId}`);
      }
    }
    return [...new Set(requested)];
  }

  private emitChannelChanged(payload: MessageChannelChangePayload): void {
    for (const listener of this.channelChangeListeners) {
      listener(payload);
    }
  }

  private emitPresenceChanged(contactId: MessageContactId): void {
    const seen = new Set<string>();
    for (const { channel } of this.db.listContactChannelAccess(contactId, true)) {
      if (seen.has(channel.chatId)) {
        continue;
      }
      seen.add(channel.chatId);
      const revisions = this.db.bumpRoomRevision(channel.chatId);
      this.emitChannelChanged({
        chatId: channel.chatId,
        reason: "presence",
        builtIn: this.isBuiltInChannelMetadata(channel.metadata),
        ...revisions,
        contactId,
      });
    }
  }

  send(input: MessageAppendInput): MessageRecord {
    const createdAt = input.createdAt ?? Date.now();
    const visibleAt = input.visibleAt ?? createdAt;
    const from = input.from?.trim() || (input.senderContactId ? fallbackContactLabel(input.senderContactId) : "User");
    const readMembership =
      input.readContactIds || input.unreadContactIds
        ? {
            readContactIds: input.readContactIds ?? [],
            unreadContactIds: input.unreadContactIds ?? [],
          }
        : this.createInitialReadMembership(input.chatId, input.senderContactId);
    const result = this.db.appendMessageDetailed({
      ...input,
      sourceSystemId: input.sourceSystemId ?? this.identity.systemId,
      from,
      createdAt,
      visibleAt,
      readContactIds: readMembership.readContactIds,
      unreadContactIds: readMembership.unreadContactIds,
    });
    if (!result.inserted) {
      return result.message;
    }
    const message = result.message;
    if (result.followUpTask) {
      this.followUpRuntime.upsertTask(result.followUpTask);
    }
    const revisions = this.db.bumpRoomRevision(input.chatId, {
      updatedAt: message.updatedAt,
      transcriptChanged: true,
    });
    this.bumpVersion();
    this.bumpUnreadVersions(result.readContactIds, result.unreadContactIds);
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "message",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      ...revisions,
    });
    return message;
  }

  edit(input: MessageEditInput): MessageRecord {
    const message = this.db.editMessage(input);
    const revisions = this.db.bumpRoomRevision(input.chatId, {
      updatedAt: message.updatedAt,
      transcriptChanged: true,
    });
    this.bumpVersion();
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "message",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      ...revisions,
    });
    return message;
  }

  recall(input: MessageRecallInput): MessageRecord {
    // Recall preserves the transcript row as durable history, but it also
    // changes active unread projections; both version streams must be bumped.
    const { message, unreadChangedContactIds } = this.db.recallMessage(input);
    const revisions = this.db.bumpRoomRevision(input.chatId, {
      updatedAt: message.updatedAt,
      transcriptChanged: true,
    });
    this.bumpVersion();
    this.bumpUnreadVersions(unreadChangedContactIds);
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "message",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      ...revisions,
    });
    return message;
  }

  sendAuthorized(input: MessageAuthorizedWriteInput | (Omit<MessageAuthorizedWriteInput, "accessToken"> & { superKey: PrincipalId })): MessageRecord {
    if (!("accessToken" in input)) {
      throw new Error("message channel participant member access required to send");
    }
    if (input.kind === "error") {
      if (!input.payload?.error) {
        throw new Error("message channel error payload required");
      }
      return this.sendErrorAuthorized({
        ...input,
        payload: { error: input.payload.error },
      });
    }
    if (input.kind === "interactive") {
      if (!input.payload?.interactive) {
        throw new Error("message channel interactive payload required");
      }
      return this.sendInteractiveAuthorized({
        ...input,
        payload: { interactive: input.payload.interactive },
      });
    }
    const grant = this.requireAccess(input.chatId, input.accessToken, "member");
    const sender = this.resolveAuthorizedSender(input.chatId, grant, input);
    const readMembership = this.createInitialReadMembership(input.chatId, sender.senderContactId);
    const createdAt = input.createdAt ?? Date.now();
    const visibleAt = input.visibleAt ?? createdAt;
    return this.send({
      chatId: input.chatId,
      ref: input.ref,
      clientMessageId: input.clientMessageId,
      senderContactId: sender.senderContactId,
      from: sender.from,
      kind: input.kind,
      content: input.content,
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
      visibleAt,
      readContactIds: readMembership.readContactIds,
      unreadContactIds: readMembership.unreadContactIds,
      metadata: input.metadata,
      followUp: input.followUp,
      attachments: input.attachments,
      payload: input.payload,
    });
  }

  refreshFollowUpAuthorized(input: {
    chatId: string;
    accessToken: string;
    messageId: number;
    followUp: MessageFollowUpRequest;
  }): MessageFollowUpTaskRecord {
    const grant = this.requireAccess(input.chatId, input.accessToken, "member");
    const target = this.db.getMessage(input.chatId, input.messageId);
    if (!target) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    const contactId =
      grant.participantId && isCanonicalContactId(grant.participantId)
        ? (grant.participantId as MessageContactId)
        : undefined;
    if (contactId && !this.isTrustedBootstrapGrant(grant) && target.senderContactId !== contactId) {
      throw new Error("message follow-up refresh requires original sender");
    }
    const task = this.db.upsertMessageFollowUpTask({
      chatId: input.chatId,
      messageId: input.messageId,
      followUp: input.followUp,
    });
    this.followUpRuntime.upsertTask(task);
    return task;
  }

  editAuthorized(input: MessageAuthorizedEditInput): MessageRecord {
    const grant = this.requireAccess(input.chatId, input.accessToken, "member");
    const target = this.db.getMessage(input.chatId, input.messageId);
    if (!target) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    const editorContactId =
      grant.participantId && isCanonicalContactId(grant.participantId)
        ? (grant.participantId as MessageContactId)
        : undefined;
    if (editorContactId && !this.isTrustedBootstrapGrant(grant) && target.senderContactId !== editorContactId) {
      throw new Error("message edit requires original sender");
    }
    return this.edit(input);
  }

  recallAuthorized(input: MessageAuthorizedRecallInput): MessageRecord {
    const grant = this.requireAccess(input.chatId, input.accessToken, "member");
    const target = this.db.getMessage(input.chatId, input.messageId);
    if (!target) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    const recallContactId =
      grant.participantId && isCanonicalContactId(grant.participantId)
        ? (grant.participantId as MessageContactId)
        : undefined;
    if (recallContactId && !this.isTrustedBootstrapGrant(grant) && target.senderContactId !== recallContactId) {
      throw new Error("message recall requires original sender");
    }
    return this.recall({
      ...input,
      recalledByContactId: input.recalledByContactId ?? recallContactId,
    });
  }

  sendErrorAuthorized(
    input: MessageAuthorizedWriteInput & {
      payload: NonNullable<MessageAuthorizedWriteInput["payload"]> & {
        error: NonNullable<NonNullable<MessageAuthorizedWriteInput["payload"]>["error"]>;
      };
    },
  ): MessageRecord {
    const grant = this.requireAccess(input.chatId, input.accessToken, "admin");
    const sender = this.resolveAuthorizedSender(input.chatId, grant, input);
    const readMembership = this.createInitialReadMembership(input.chatId, sender.senderContactId);
    return this.send({
      chatId: input.chatId,
      ref: input.ref,
      clientMessageId: input.clientMessageId,
      senderContactId: sender.senderContactId,
      from: sender.from,
      kind: "error",
      content: input.content,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      visibleAt: input.visibleAt ?? input.createdAt ?? Date.now(),
      readContactIds: readMembership.readContactIds,
      unreadContactIds: readMembership.unreadContactIds,
      metadata: input.metadata,
      followUp: input.followUp,
      attachments: input.attachments,
      payload: {
        error: input.payload.error,
      },
    });
  }

  sendInteractiveAuthorized(
    input: MessageAuthorizedWriteInput & {
      payload: NonNullable<MessageAuthorizedWriteInput["payload"]> & {
        interactive: NonNullable<NonNullable<MessageAuthorizedWriteInput["payload"]>["interactive"]>;
      };
    },
  ): MessageRecord {
    const grant = this.requireAccess(input.chatId, input.accessToken, "member");
    const sender = this.resolveAuthorizedSender(input.chatId, grant, input);
    const readMembership = this.createInitialReadMembership(input.chatId, sender.senderContactId);
    return this.send({
      chatId: input.chatId,
      ref: input.ref,
      clientMessageId: input.clientMessageId,
      senderContactId: sender.senderContactId,
      from: sender.from,
      kind: "interactive",
      content: input.content,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      visibleAt: input.visibleAt ?? input.createdAt ?? Date.now(),
      readContactIds: readMembership.readContactIds,
      unreadContactIds: readMembership.unreadContactIds,
      metadata: input.metadata,
      followUp: input.followUp,
      attachments: input.attachments,
      payload: {
        interactive: input.payload.interactive,
      },
    });
  }

  reply(input: MessageAppendInput): MessageRecord {
    return this.send(input);
  }

  replyAuthorized(input: MessageAuthorizedWriteInput): MessageRecord {
    return this.sendAuthorized(input);
  }

  queryMessages(input: { chatId: string; before?: ReverseTimeCursor | null; limit?: number }): MessageTranscriptPage {
    const page = this.db.pageMessages(input.chatId, { before: input.before, limit: input.limit });
    return {
      ...page,
      ...this.db.getRoomRevisionVector(input.chatId),
      headVersion: this.getHeadVersion(),
    };
  }

  queryActiveVisibleMessages(input: {
    chatId: string;
    before?: ReverseTimeCursor | null;
    limit?: number;
  }): ReversePage<MessageRecord> {
    // Runtime readiness, watches, dedup, and scheduler-facing views must use
    // this active projection instead of raw transcript pagination.
    return this.db.pageActiveVisibleMessages(input.chatId, { before: input.before, limit: input.limit });
  }

  queryMessagesAuthorized(input: MessageAuthorizedPageInput): MessageTranscriptPage {
    this.requireAccess(input.chatId, input.accessToken, "readonly");
    return this.queryMessages({ chatId: input.chatId, before: input.before, limit: input.limit });
  }

  queryAuthorized(input: MessageAuthorizedQueryInput): MessageQueryResult {
    const chatIds = this.resolveAuthorizedQueryChatIds(input);
    return this.db.queryMessagesByIndex({
      chatIds,
      mode: input.mode,
      query: input.query,
      offset: input.offset,
      limit: input.limit,
    });
  }

  resolveLatestVisibleMessage(chatId: string, input: { includeRecalled?: boolean } = {}): MessageRecord | undefined {
    return this.db.resolveLatestVisibleMessage(chatId, input);
  }

  resolveLatestActiveVisibleMessage(chatId: string): MessageRecord | undefined {
    // "Latest active" intentionally excludes recalled history. Use
    // resolveLatestVisibleMessage(..., { includeRecalled }) for transcript views.
    return this.db.resolveLatestActiveVisibleMessage(chatId);
  }

  markChannelReadAuthorized(input: MessageAuthorizedMarkReadInput): MessageControlPlaneEntry {
    const grant = this.requireAccess(input.chatId, input.accessToken, "readonly");
    const channel = this.db.getChannel(
      input.chatId,
      grant.participantId
        ? this.getFocusedChatIdsForContact(grant.participantId as MessageContactId).has(input.chatId)
        : false,
    );
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }

    if (!grant.participantId || !isCanonicalContactId(grant.participantId) || this.isTrustedBootstrapGrant(grant)) {
      return this.withProjection(
        {
          ...channel,
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        this.createProjection({
          chatId: input.chatId,
          accessRole: grant.role,
          accessToken: input.accessToken,
          participantId: grant.participantId as MessageContactId | undefined,
        }),
      );
    }

    const target = input.messageId
      ? this.db.getMessage(input.chatId, input.messageId)
      : this.db.resolveLatestVisibleMessage(input.chatId);
    if (input.messageId && !target) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    if (!target) {
      return this.withProjection(
        {
          ...channel,
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        this.createProjection({
          chatId: input.chatId,
          accessRole: grant.role,
          accessToken: input.accessToken,
          participantId: grant.participantId as MessageContactId,
        }),
      );
    }
    const result = this.db.markMessagesReadUpTo({
      chatId: input.chatId,
      contactId: grant.participantId as MessageContactId,
      targetRowId: target.rowId,
    });
    if (result.changed) {
      const revisions = this.db.bumpRoomRevision(input.chatId);
      this.bumpVersion();
      this.bumpUnreadVersion(grant.participantId as MessageContactId);
      this.emitChannelChanged({
        chatId: input.chatId,
        reason: "read",
        builtIn: this.isBuiltInChannelMetadata(channel.metadata),
        ...revisions,
        contactId: grant.participantId as MessageContactId,
      });
    }

    return this.withProjection(
      {
        ...channel,
        metadata: this.withAdminState(channel.chatId, channel.metadata),
      },
      this.createProjection({
        chatId: input.chatId,
        accessRole: grant.role,
        accessToken: input.accessToken,
        participantId: grant.participantId as MessageContactId,
      }),
    );
  }

  snapshot(chatId: string, limit = 50): MessageSnapshot {
    const snapshot = this.db.snapshot(
      chatId,
      this.getFocusedChatIdsForContact(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(chatId),
      limit,
    );
    const revisions = this.db.getRoomRevisionVector(chatId);
    return {
      channel: this.withProjection(
        {
          ...snapshot.channel,
          metadata: this.withAdminState(snapshot.channel.chatId, snapshot.channel.metadata),
        },
        this.issueTrustedBootstrapAccess(chatId),
      ),
      items: snapshot.items,
      nextBefore: this.db.pageMessages(chatId, { limit }).nextBefore,
      hasMoreBefore: this.db.pageMessages(chatId, { limit }).hasMoreBefore,
      ...revisions,
      headVersion: this.getHeadVersion(),
    };
  }

  snapshotAuthorized(input: (MessageAuthorizedReadInput | { chatId: string; superKey: PrincipalId }) & { limit?: number }): MessageSnapshot {
    const grant =
      "superKey" in input
        ? this.requireRoomControl(input.chatId, input.superKey, "readonly")
        : this.requireAccess(input.chatId, input.accessToken, "readonly");
    const page = this.db.pageMessages(input.chatId, { limit: input.limit });
    const snapshot = this.db.snapshot(
      input.chatId,
      grant.participantId
        ? this.getFocusedChatIdsForContact(grant.participantId as MessageContactId).has(input.chatId)
        : false,
      input.limit ?? 50,
    );
    const revisions = this.db.getRoomRevisionVector(input.chatId);
    return {
      channel: this.withProjection(
        {
          ...snapshot.channel,
          metadata: this.withAdminState(snapshot.channel.chatId, snapshot.channel.metadata),
        },
        this.createProjection({
          chatId: input.chatId,
          accessRole: grant.role,
          accessToken: grant.accessToken ?? ("accessToken" in input ? input.accessToken : ""),
          participantId: grant.participantId as MessageContactId | undefined,
        }),
      ),
      items: page.items,
      nextBefore: page.nextBefore,
      hasMoreBefore: page.hasMoreBefore,
      ...revisions,
      headVersion: this.getHeadVersion(),
    };
  }

  updateChannelAuthorized(input: {
    chatId: string;
    accessToken?: string;
    superadminContactId?: MessageContactId;
    superKey?: PrincipalId;
    patch: MessageChannelPatchInput;
  }): MessageControlPlaneEntry {
    const grant = input.superKey
      ? this.requireRoomControl(input.chatId, input.superKey)
      : this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    const patch = this.normalizeChannelPatch(input.patch, input.chatId);
    const channel = this.db.updateChannel(
      input.chatId,
      patch,
      grant.participantId
        ? this.getFocusedChatIdsForContact(grant.participantId as MessageContactId).has(input.chatId)
        : false,
    );
    const revisions = this.db.bumpRoomRevision(input.chatId, {
      updatedAt: channel.updatedAt,
    });
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "updated",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      ...revisions,
      contactId: grant.participantId as MessageContactId | undefined,
    });
    return this.withProjection(
      {
        ...channel,
        metadata: this.withAdminState(channel.chatId, channel.metadata),
      },
      this.createProjection({
        chatId: input.chatId,
        accessRole: grant.role,
        accessToken: grant.accessToken ?? input.accessToken ?? "",
        participantId: grant.participantId as MessageContactId | undefined,
      }),
    );
  }

  repairChannelContactAliases(input: {
    chatId: string;
    aliases: Array<{
      fromContactId: MessageContactId;
      toContactId: MessageContactId;
    }>;
  }): MessageControlPlaneEntry | undefined {
    const contactIdMap = new Map<MessageContactId, MessageContactId>();
    for (const alias of input.aliases) {
      this.assertContactId(alias.fromContactId);
      this.assertContactId(alias.toContactId);
      if (alias.fromContactId !== alias.toContactId) {
        contactIdMap.set(alias.fromContactId, alias.toContactId);
      }
    }
    const focused = this.getFocusedChatIdsForContact(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(input.chatId);
    const channel = this.db.getChannel(input.chatId, focused);
    if (!channel) {
      return undefined;
    }
    if (contactIdMap.size === 0) {
      return this.withProjection(
        {
          ...channel,
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        this.issueTrustedBootstrapAccess(input.chatId),
      );
    }

    const grantsChanged = this.repairActiveGrantsForContactAliases(input.chatId, contactIdMap);
    const messagesChanged = this.db.repairMessageContactIds(input.chatId, contactIdMap).changed;
    const roomStateChanged = this.db.repairContactRoomStateAliases(input.chatId, contactIdMap).changed;
    const nextParticipants = this.repairChannelParticipants(channel.participants, contactIdMap);
    const nextMetadata = this.withAdminState(input.chatId, this.repairChannelMetadata(channel.metadata, contactIdMap));
    const participantsChanged =
      nextParticipants.length !== channel.participants.length ||
      nextParticipants.some((participant, index) => {
        const current = channel.participants[index];
        return current?.id !== participant.id || current?.label !== participant.label;
      });
    const metadataChanged = JSON.stringify(nextMetadata) !== JSON.stringify(channel.metadata ?? {});
    if (participantsChanged || metadataChanged) {
      this.db.updateChannel(
        input.chatId,
        {
          participants: nextParticipants,
          metadata: nextMetadata,
        },
        focused,
      );
    }
    if (grantsChanged || messagesChanged || roomStateChanged || participantsChanged || metadataChanged) {
      const revisions = this.db.bumpRoomRevision(input.chatId);
      this.bumpVersion();
      this.emitChannelChanged({
        chatId: input.chatId,
        reason: "updated",
        builtIn: this.isBuiltInChannelMetadata(nextMetadata),
        ...revisions,
      });
    }
    const repaired = this.db.getChannel(input.chatId, focused)!;
    return this.withProjection(
      {
        ...repaired,
        metadata: this.withAdminState(repaired.chatId, repaired.metadata),
      },
      this.issueTrustedBootstrapAccess(input.chatId),
    );
  }

  archiveChannelAuthorized(input: {
    chatId: string;
    accessToken?: string;
    superadminContactId?: MessageContactId;
    superKey?: PrincipalId;
    archivedBy: string;
  }): MessageControlPlaneEntry {
    const grant = input.superKey
      ? this.requireRoomControl(input.chatId, input.superKey)
      : this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    const channel = this.db.archiveChannel(
      input.chatId,
      input.archivedBy,
      grant.participantId
        ? this.getFocusedChatIdsForContact(grant.participantId as MessageContactId).has(input.chatId)
        : false,
    );
    for (const focused of this.focusedChatIdsByContact.values()) {
      focused.delete(input.chatId);
    }
    const revisions = this.db.bumpRoomRevision(input.chatId, {
      updatedAt: channel.updatedAt,
    });
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "archived",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      ...revisions,
      contactId: grant.participantId as MessageContactId | undefined,
    });
    return this.withProjection(
      {
        ...channel,
        metadata: this.withAdminState(channel.chatId, channel.metadata),
      },
      this.createProjection({
        chatId: input.chatId,
        accessRole: grant.role,
        accessToken: grant.accessToken ?? input.accessToken ?? "",
        participantId: grant.participantId as MessageContactId | undefined,
      }),
    );
  }

  unarchiveChannelAuthorized(input: {
    chatId: string;
    accessToken?: string;
    superadminContactId?: MessageContactId;
    superKey?: PrincipalId;
  }): MessageControlPlaneEntry {
    const grant = input.superKey
      ? this.requireRoomControl(input.chatId, input.superKey)
      : this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    const channel = this.db.unarchiveChannel(
      input.chatId,
      grant.participantId
        ? this.getFocusedChatIdsForContact(grant.participantId as MessageContactId).has(input.chatId)
        : false,
    );
    const revisions = this.db.bumpRoomRevision(input.chatId, {
      updatedAt: channel.updatedAt,
    });
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "updated",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      ...revisions,
      contactId: grant.participantId as MessageContactId | undefined,
    });
    return this.withProjection(
      {
        ...channel,
        metadata: this.withAdminState(channel.chatId, channel.metadata),
      },
      this.createProjection({
        chatId: input.chatId,
        accessRole: grant.role,
        accessToken: grant.accessToken ?? input.accessToken ?? "",
        participantId: grant.participantId as MessageContactId | undefined,
      }),
    );
  }

  deleteChannelAuthorized(input: {
    chatId: string;
    accessToken?: string;
    superadminContactId?: MessageContactId;
    superKey?: PrincipalId;
  }): MessageControlPlaneEntry {
    const grant = input.superKey
      ? this.requireRoomControl(input.chatId, input.superKey)
      : this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    const affectedContactIds = this.db
      .listActiveGrants(input.chatId)
      .flatMap((activeGrant) =>
        activeGrant.participantId && isCanonicalContactId(activeGrant.participantId)
          ? [activeGrant.participantId as MessageContactId]
          : [],
      );
    const channel = this.db.deleteChannel(
      input.chatId,
      grant.participantId
        ? this.getFocusedChatIdsForContact(grant.participantId as MessageContactId).has(input.chatId)
        : false,
    );
    for (const focused of this.focusedChatIdsByContact.values()) {
      focused.delete(input.chatId);
    }
    this.bumpVersion();
    this.bumpUnreadVersions(affectedContactIds);
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "deleted",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      roomRevision: channel.roomRevision,
      transcriptRevision: channel.transcriptRevision,
      contactId: grant.participantId as MessageContactId | undefined,
    });
    return this.withProjection(
      {
        ...channel,
        metadata: this.withAdminState(channel.chatId, channel.metadata),
      },
      this.createProjection({
        chatId: input.chatId,
        accessRole: grant.role,
        accessToken: grant.accessToken ?? input.accessToken ?? "",
        participantId: grant.participantId as MessageContactId | undefined,
      }),
    );
  }

  listChannelGrantsAuthorized(
    input: MessageAuthorizedReadInput & { superadminContactId?: MessageContactId },
  ): MessageChannelGrantRecord[] {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    return this.db.listActiveGrants(input.chatId).filter((grant) => !this.isTrustedBootstrapGrant(grant));
  }

  issueChannelGrantAuthorized(
    input: MessageAuthorizedReadInput & MessageIssueGrantInput & { superadminContactId?: MessageContactId },
  ): MessageIssuedGrant {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    if (!input.participantId || !isCanonicalContactId(input.participantId)) {
      throw new Error("room grant participantId must be a principal id or auth:/session:/system: contact id");
    }
    const accessToken = this.resolveGrantAccessToken(input.accessTokenHint);
    this.db.revokeActiveGrantsByParticipant(input.chatId, input.participantId);
    const grant = this.db.issueGrant({
      chatId: input.chatId,
      role: input.role,
      label: input.label,
      participantId: input.participantId,
      accessToken,
      tokenHash: hashToken(accessToken),
    });
    this.db.initializeContactRoomState(input.chatId, input.participantId as MessageContactId);
    const revisions = this.db.bumpRoomRevision(input.chatId);
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "grant-issued",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      ...revisions,
      contactId: input.participantId as MessageContactId,
    });
    return {
      ...grant,
      ...this.createProjection({
        chatId: input.chatId,
        accessRole: grant.role,
        accessToken,
        participantId: grant.participantId as MessageContactId | undefined,
      }),
    };
  }

  revokeChannelGrantAuthorized(
    input: MessageAuthorizedReadInput & { grantId: string; superadminContactId?: MessageContactId },
  ): { ok: boolean } {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    const revokedGrant = this.db.getGrantById(input.chatId, input.grantId);
    const ok = this.db.revokeGrant(input.chatId, input.grantId);
    if (ok) {
      if (revokedGrant?.participantId && isCanonicalContactId(revokedGrant.participantId)) {
        const stillGranted = this.db
          .listActiveGrants(input.chatId)
          .some((grant) => grant.participantId === revokedGrant.participantId && grant.grantId !== input.grantId);
        if (!stillGranted) {
          const cleared = this.db.clearContactRoomState(input.chatId, revokedGrant.participantId as MessageContactId);
          if (cleared.changed) {
            this.bumpUnreadVersion(revokedGrant.participantId as MessageContactId);
          }
        }
      }
      const revisions = this.db.bumpRoomRevision(input.chatId);
      this.bumpVersion();
      this.emitChannelChanged({
        chatId: input.chatId,
        reason: "grant-revoked",
        builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
        ...revisions,
      });
    }
    return { ok };
  }

  inviteSeatAuthorized(input: MessageInviteSeatInput): MessageInvitationRecord {
    const inviter = this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    if (!isPrincipalId(input.participantId)) {
      throw new Error("room managed seat participantId must be a principal id");
    }
    const invitationId = createManagedInvitationId();
    const previous = this.db.findLatestInvitationForParticipant({
      chatId: input.chatId,
      inviteeContactId: input.participantId,
    });
    if (previous?.status === "pending") {
      this.db.updateInvitationStatus(input.chatId, previous.invitationId, {
        status: "revoked",
        revokedAt: Date.now(),
        supersededByInvitationId: invitationId,
      });
    }
    const payload = this.resolveManagedSeatPayload(input.seatClass, input.label);
    const token = createManagedInvitationToken();
    const invitation = this.db.upsertInvitation({
      invitationId,
      chatId: input.chatId,
      inviterContactId: this.resolveManagedSeatInviterPrincipalId(inviter.participantId, input.superadminContactId),
      inviteeContactId: input.participantId,
      nativePayload: payload,
      payloadDigest: digestManagedInvitationPayload(payload),
      acceptanceTokenHash: hashManagedInvitationToken(token),
      descriptor: buildManagedInvitationShareDescriptor({
        resourceKind: "message",
        token,
        endpoint: input.endpoint,
      }),
      expiresAt: input.expiresAt ?? Date.now() + DEFAULT_MANAGED_INVITATION_TTL_MS,
    });
    const revisions = this.db.bumpRoomRevision(input.chatId);
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "grant-issued",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      ...revisions,
      contactId: input.participantId,
    });
    return invitation;
  }

  prepareSeatAccept(input: { descriptor: string }): {
    invitation: MessageInvitationRecord;
    proofInput: {
      invitationId: string;
      resourceKind: MessageInvitationRecord["resourceKind"];
      resourceId: string;
      inviteePrincipalId: MessageInvitationRecord["inviteePrincipalId"];
      payloadDigest: string;
      expiresAt: number;
    };
  } {
    const invitation = this.requirePendingInvitationByDescriptor(input.descriptor);
    return {
      invitation,
      proofInput: {
        invitationId: invitation.invitationId,
        resourceKind: invitation.resourceKind,
        resourceId: invitation.resourceId,
        inviteePrincipalId: invitation.inviteePrincipalId,
        payloadDigest: invitation.payloadDigest,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  async acceptSeat(input: MessageAcceptSeatInput): Promise<{
    invitation: MessageInvitationRecord;
    access: MessageChannelAccessProjection;
    seat: MessageSeatStateProjection | undefined;
  }> {
    const invitation = this.requirePendingInvitationByDescriptor(input.descriptor);
    validateManagedInvitationRecipientBinding({
      expectedInviteePrincipalId: invitation.inviteePrincipalId,
      proof: input.proof,
    });
    if (!(await verifyManagedInvitationAcceptProof(input.proof))) {
      throw new Error("room invitation proof verification failed");
    }
    const expectedProofPayload = buildManagedInvitationAcceptPayload({
      invitationId: invitation.invitationId,
      resourceKind: invitation.resourceKind,
      resourceId: invitation.resourceId,
      inviteePrincipalId: invitation.inviteePrincipalId,
      payloadDigest: invitation.payloadDigest,
      expiresAt: invitation.expiresAt,
    });
    if (input.proof.payload !== expectedProofPayload) {
      throw new Error("room invitation proof payload digest mismatch");
    }
    const access = this.activateManagedSeatPayload(
      invitation.resourceId,
      invitation.inviteePrincipalId,
      invitation.payload,
    );
    const accepted = this.db.updateInvitationStatus(invitation.resourceId, invitation.invitationId, {
      status: "accepted",
      acceptedAt: Date.now(),
    });
    this.syncAdminAssignments();
    const revisions = this.db.bumpRoomRevision(invitation.resourceId);
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: invitation.resourceId,
      reason: "grant-issued",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(invitation.resourceId)?.metadata),
      ...revisions,
      contactId: invitation.inviteePrincipalId,
    });
    return {
      invitation: accepted,
      access,
      seat: this.listSeatStateProjections(invitation.resourceId).find(
        (seat) => seat.contactId === invitation.inviteePrincipalId,
      ),
    };
  }

  configSeatAuthorized(input: MessageConfigSeatInput): MessageInvitationRecord | MessageChannelAccessProjection {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    const existing = this.db
      .listActiveGrants(input.chatId)
      .find((grant) => grant.participantId === input.participantId);
    if (existing) {
      return this.activateManagedSeatPayload(
        input.chatId,
        input.participantId,
        this.resolveManagedSeatPayload(input.seatClass, input.label),
      );
    }
    return this.inviteSeatAuthorized(input);
  }

  revokeSeatAuthorized(input: MessageRevokeSeatInput): { ok: true } {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminContactId);
    this.db.revokePendingInvitationsByParticipant(input.chatId, input.participantId);
    this.db.revokeActiveGrantsByParticipant(input.chatId, input.participantId);
    const channel = this.db.getChannel(input.chatId);
    if (channel) {
      const nextMetadata = this.withAdminState(input.chatId, {
        ...(channel.metadata ?? {}),
        [ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY]: this.readAdminGroupCandidateIds(channel.metadata).filter(
          (candidate) => candidate !== input.participantId,
        ),
      });
      this.db.updateChannel(input.chatId, { metadata: nextMetadata }, false);
    }
    const cleared = this.db.clearContactRoomState(input.chatId, input.participantId);
    if (cleared.changed) {
      this.bumpUnreadVersion(input.participantId);
    }
    this.syncAdminAssignments();
    const revisions = this.db.bumpRoomRevision(input.chatId);
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "grant-revoked",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      ...revisions,
      contactId: input.participantId,
    });
    return { ok: true };
  }

  listSourceSubscriptions(ownerContactId: MessageContactId): MessageSourceSubscriptionRecord[] {
    this.assertContactId(ownerContactId);
    return this.db.listSourceSubscriptions(ownerContactId);
  }

  getSourceSubscription(ownerContactId: MessageContactId, sourceId: string): MessageSourceSubscriptionRecord | undefined {
    this.assertContactId(ownerContactId);
    return this.db.getSourceSubscription(ownerContactId, sourceId);
  }

  upsertSourceSubscription(
    input: {
      ownerContactId: MessageContactId;
    } & MessageSourceSubscriptionInput,
  ): MessageSourceSubscriptionRecord {
    this.assertContactId(input.ownerContactId);
    return this.db.upsertSourceSubscription(input.ownerContactId, input);
  }

  deleteSourceSubscription(input: { ownerContactId: MessageContactId; sourceId: string }): { ok: boolean } {
    this.assertContactId(input.ownerContactId);
    return {
      ok: this.db.deleteSourceSubscription(input.ownerContactId, input.sourceId),
    };
  }

  listContacts(ownerContactId: MessageContactId): MessageContactRecord[] {
    this.assertContactId(ownerContactId);
    return this.db.listContacts(ownerContactId);
  }

  getContact(
    ownerContactId: MessageContactId,
    sourceId: string,
    remoteContactId: MessageContactId,
  ): MessageContactRecord | undefined {
    this.assertContactId(ownerContactId);
    this.assertContactId(remoteContactId);
    return this.db.getContact(ownerContactId, sourceId, remoteContactId);
  }

  upsertContact(input: { ownerContactId: MessageContactId } & MessageContactUpsertInput): MessageContactRecord {
    this.assertContactId(input.ownerContactId);
    this.assertContactId(input.remoteContactId);
    return this.db.upsertContact(input.ownerContactId, input);
  }

  createContactRequest(
    input: {
      ownerContactId: MessageContactId;
    } & MessageContactRequestCreateInput,
  ): MessageContactRequestRecord {
    this.assertContactId(input.ownerContactId);
    this.assertContactId(input.remoteContactId);
    if (input.direction === "outbound" && !this.db.getSourceSubscription(input.ownerContactId, input.sourceId)) {
      throw new Error(`unknown message source subscription: ${input.sourceId}`);
    }
    const currentPending = this.db.findPendingContactRequests({
      ownerContactId: input.ownerContactId,
      direction: input.direction,
      sourceId: input.sourceId,
      remoteContactId: input.remoteContactId,
    });
    const created = this.db.createContactRequest(input.ownerContactId, input);
    for (const pending of currentPending) {
      if (pending.requestId === created.requestId) {
        continue;
      }
      this.db.updateContactRequestState({
        ownerContactId: input.ownerContactId,
        requestId: pending.requestId,
        state: "superseded",
        respondedAt: Date.now(),
        supersededByRequestId: created.requestId,
      });
    }
    return created;
  }

  listContactRequests(
    ownerContactId: MessageContactId,
    input: {
      direction?: MessageContactRequestDirection;
      state?: MessageContactRequestState;
    } = {},
  ): MessageContactRequestRecord[] {
    this.assertContactId(ownerContactId);
    return this.db
      .listContactRequests(ownerContactId, input)
      .map((request) => this.expireContactRequestIfNeeded(request));
  }

  getContactRequest(ownerContactId: MessageContactId, requestId: string): MessageContactRequestRecord | undefined {
    this.assertContactId(ownerContactId);
    const current = this.db.getContactRequest(ownerContactId, requestId);
    return current ? this.expireContactRequestIfNeeded(current) : undefined;
  }

  acceptContactRequest(input: {
    ownerContactId: MessageContactId;
    requestId: string;
    label?: string;
    subtitle?: string;
    iconUrl?: string;
    localDirectChatId?: string;
    remoteDirectChatId?: string;
    metadata?: Record<string, unknown>;
  }): { request: MessageContactRequestRecord; contact: MessageContactRecord } {
    this.assertContactId(input.ownerContactId);
    const request = this.requirePendingContactRequest(input.ownerContactId, input.requestId);
    const accepted = this.db.updateContactRequestState({
      ownerContactId: input.ownerContactId,
      requestId: input.requestId,
      state: "accepted",
      respondedAt: Date.now(),
    });
    const contact = this.db.upsertContact(input.ownerContactId, {
      sourceId: request.sourceId,
      remoteContactId: request.remoteContactId,
      label: input.label?.trim() || request.remoteLabel || request.remoteContactId,
      subtitle: input.subtitle ?? request.remoteSubtitle,
      iconUrl: input.iconUrl ?? request.remoteIconUrl,
      localDirectChatId: input.localDirectChatId,
      remoteDirectChatId: input.remoteDirectChatId,
      metadata: input.metadata,
    });
    return { request: accepted, contact };
  }

  rejectContactRequest(input: { ownerContactId: MessageContactId; requestId: string }): MessageContactRequestRecord {
    this.assertContactId(input.ownerContactId);
    this.requirePendingContactRequest(input.ownerContactId, input.requestId);
    return this.db.updateContactRequestState({
      ownerContactId: input.ownerContactId,
      requestId: input.requestId,
      state: "rejected",
      respondedAt: Date.now(),
    });
  }

  revokeContactRequest(input: { ownerContactId: MessageContactId; requestId: string }): MessageContactRequestRecord {
    this.assertContactId(input.ownerContactId);
    this.requirePendingContactRequest(input.ownerContactId, input.requestId);
    return this.db.updateContactRequestState({
      ownerContactId: input.ownerContactId,
      requestId: input.requestId,
      state: "revoked",
      respondedAt: Date.now(),
    });
  }

  getHeadVersion(): string {
    return String(this.headVersion);
  }

  getContactUnreadState(contactId: MessageContactId): MessageContactStateRecord {
    this.assertContactId(contactId);
    return this.db.getContactState(contactId) ?? this.db.touchContactState(contactId);
  }

  listUnreadRoomSummaries(contactId: MessageContactId, input: { limit?: number } = {}): MessageUnreadRoomSummary[] {
    this.assertContactId(contactId);
    return this.db.listUnreadRoomSummaries(contactId, input.limit);
  }

  getUnreadVersion(contactId: MessageContactId): string {
    return String(this.unreadVersionByContact.get(contactId) ?? 0);
  }

  waitUnreadCommitted(input: {
    contactId: MessageContactId;
    fromVersion?: string | null;
  }): CommitWaitHandle<{ contactId: MessageContactId; version: string }> {
    this.assertContactId(input.contactId);
    const afterVersion = parseVersion(input.fromVersion);
    const currentVersion = this.unreadVersionByContact.get(input.contactId) ?? 0;
    if (currentVersion > afterVersion) {
      return {
        promise: Promise.resolve({
          contactId: input.contactId,
          version: this.getUnreadVersion(input.contactId),
        }),
        reject: () => {},
      };
    }

    let resolveRef: ((value: { contactId: MessageContactId; version: string }) => void) | null = null;
    let rejectRef: ((reason: unknown) => void) | null = null;
    const waiter: UnreadWaiter = {
      contactId: input.contactId,
      afterVersion,
      resolve: (value) => resolveRef?.(value),
      reject: (reason) => rejectRef?.(reason),
      active: true,
    };
    const promise = new Promise<{ contactId: MessageContactId; version: string }>((resolve, reject) => {
      resolveRef = resolve;
      rejectRef = reject;
    }).finally(() => {
      waiter.active = false;
      this.unreadWaiters.delete(waiter);
    });
    this.unreadWaiters.add(waiter);
    return {
      promise,
      reject: (reason) => {
        if (!waiter.active) {
          return;
        }
        waiter.active = false;
        this.unreadWaiters.delete(waiter);
        rejectRef?.(reason);
      },
    };
  }

  waitCommitted(input: { fromVersion?: string | null } = {}): CommitWaitHandle<{ version: string }> {
    const afterVersion = parseVersion(input.fromVersion);
    if (this.headVersion > afterVersion) {
      return {
        promise: Promise.resolve({ version: this.getHeadVersion() }),
        reject: () => {},
      };
    }

    let resolveRef: ((value: { version: string }) => void) | null = null;
    let rejectRef: ((reason: unknown) => void) | null = null;
    const waiter: Waiter = {
      afterVersion,
      resolve: (value) => resolveRef?.(value),
      reject: (reason) => rejectRef?.(reason),
      active: true,
    };
    const promise = new Promise<{ version: string }>((resolve, reject) => {
      resolveRef = resolve;
      rejectRef = reject;
    }).finally(() => {
      waiter.active = false;
      this.waiters.delete(waiter);
    });
    this.waiters.add(waiter);
    return {
      promise,
      reject: (reason) => {
        if (!waiter.active) {
          return;
        }
        waiter.active = false;
        this.waiters.delete(waiter);
        rejectRef?.(reason);
      },
    };
  }

  getConfig(): MessageControlPlaneConfig {
    return {
      defaultOwner: this.config.defaultOwner,
      transport: cloneTransport(this.config.transport),
    };
  }

  setConfig(patch: MessageControlPlaneConfigPatch): MessageControlPlaneConfig {
    this.config = {
      defaultOwner: patch.defaultOwner ?? this.config.defaultOwner,
      transport: {
        ...cloneTransport(this.config.transport),
        ...patch.transport,
      },
    };
    return this.getConfig();
  }

  getTransportEndpoint(chatId: string, accessToken?: string): MessageTransportEndpoint | null {
    const transport = this.config.transport;
    const livePort = this.transportServer ? Number.parseInt(this.transportServer.url.port, 10) : Number.NaN;
    const port = Number.isFinite(livePort) && livePort > 0 ? livePort : transport?.port;
    if (!port) {
      return null;
    }
    const host = transport?.host ?? this.transportServer?.url.hostname ?? "127.0.0.1";
    const path = `${(transport?.pathPrefix ?? "/room").replace(/\/$/, "")}/${encodeURIComponent(chatId)}`;
    const url = new URL(`ws://${host}:${port}${path}`);
    if (accessToken) {
      url.searchParams.set("token", accessToken);
    }
    return {
      host,
      port,
      path,
      url: url.toString(),
    };
  }

  async startTransport(
    input: { host?: string; port?: number; pathPrefix?: string } = {},
  ): Promise<MessageTransportConfig> {
    if (this.transportServer) {
      return cloneTransport(this.config.transport);
    }

    const host = input.host ?? this.config.transport?.host ?? "127.0.0.1";
    const pathPrefix = input.pathPrefix ?? this.config.transport?.pathPrefix ?? "/room";
    const requestedPort = input.port ?? this.config.transport?.port ?? 0;
    const normalizedPrefix = pathPrefix.replace(/\/$/, "");

    this.transportServer = Bun.serve<MessageSocketData>({
      hostname: host,
      port: requestedPort,
      fetch: (request, server) => {
        const url = new URL(request.url);
        if (!url.pathname.startsWith(`${normalizedPrefix}/`)) {
          return new Response("not found", { status: 404 });
        }
        const chatId = decodeURIComponent(url.pathname.slice(normalizedPrefix.length + 1));
        const accessToken = url.searchParams.get("token");
        if (!accessToken) {
          return new Response("missing token", { status: 401 });
        }
        let grant: MessageChannelGrantRecord;
        try {
          grant = this.requireAccess(chatId, accessToken, "readonly");
        } catch {
          return new Response("credential-invalid", { status: 401 });
        }
        const upgraded = server.upgrade(request, {
          data: {
            chatId,
            contactId: grant.participantId ?? null,
            accessRole: grant.role,
            accessToken,
            cleanup: [],
          },
        });
        return upgraded ? undefined : new Response("upgrade failed", { status: 500 });
      },
      websocket: {
        open: (socket) => {
          const { chatId, accessRole, accessToken, contactId } = socket.data;
          let snapshot: MessageSnapshot;
          try {
            snapshot = this.snapshotAuthorized({ chatId, accessToken });
          } catch {
            socket.close(4401, "unauthorized");
            return;
          }
          const cleanup: Array<() => void> = [];
          cleanup.push(
            this.onMessage(({ chatId: changedChatId, message }) => {
              if (changedChatId !== chatId) {
                return;
              }
              const revisions = this.db.getRoomRevisionVector(chatId);
              socket.send(
                JSON.stringify({
                  type: "messages",
                  chatId,
                  items: [message],
                  ...revisions,
                  headVersion: this.getHeadVersion(),
                } satisfies MessageTransportServerMessage),
              );
            }),
          );
          cleanup.push(
            this.onFocus(({ contactId: changedContactId, chatIds }) => {
              if (contactId && changedContactId !== contactId) {
                return;
              }
              socket.send(
                JSON.stringify({
                  type: "focus",
                  chatId,
                  focused: chatIds.includes(chatId),
                } satisfies MessageTransportServerMessage),
              );
            }),
          );
          socket.data.cleanup = cleanup;
          socket.data.accessRole = accessRole;
          socket.send(JSON.stringify({ type: "snapshot", chatId, snapshot } satisfies MessageTransportServerMessage));
        },
        message: (socket, raw) => {
          const { chatId, accessToken } = socket.data;
          const message = parseClientMessage(typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8"));
          if (!message) {
            socket.send(
              JSON.stringify({
                type: "error",
                chatId,
                message: "invalid transport message",
              } satisfies MessageTransportServerMessage),
            );
            return;
          }
          try {
            if (message.type === "send") {
              this.sendAuthorized({ chatId, accessToken, ...message.message });
              return;
            }
            if (message.type === "edit") {
              this.editAuthorized({ chatId, accessToken, ...message.message });
              return;
            }
            if (message.type === "recall") {
              this.recallAuthorized({ chatId, accessToken, ...message.message });
              return;
            }
            if (message.type === "page") {
              socket.send(
                JSON.stringify({
                  type: "page",
                  chatId,
                  page: this.queryMessagesAuthorized({
                    chatId,
                    accessToken,
                    before: message.before ?? undefined,
                    limit: message.limit,
                  }),
                } satisfies MessageTransportServerMessage),
              );
              return;
            }
            this.focusAuthorized(message.focused ? "add" : "remove", [{ chatId, accessToken }]);
          } catch (error) {
            socket.send(
              JSON.stringify({
                type: "error",
                chatId,
                message: error instanceof Error ? error.message : "message channel access denied",
              } satisfies MessageTransportServerMessage),
            );
          }
        },
        close: (socket) => {
          for (const cleanup of socket.data.cleanup) {
            cleanup();
          }
          socket.data.cleanup = [];
        },
      },
    });

    const livePort = Number.parseInt(this.transportServer.url.port, 10);
    this.config.transport = {
      host,
      pathPrefix,
      port: Number.isFinite(livePort) && livePort > 0 ? livePort : (this.transportServer.port ?? requestedPort ?? null),
    };
    return cloneTransport(this.config.transport);
  }

  stopTransport(): void {
    this.transportServer?.stop(true);
    this.transportServer = null;
    this.config.transport = {
      ...cloneTransport(this.config.transport),
      port: null,
    };
  }

  private issueTrustedBootstrapAccess(chatId: string, preferredToken?: string): MessageChannelAccessProjection {
    const descriptor = this.createTrustedBootstrapDescriptor(chatId);
    const cachedAccessToken = this.trustedBootstrapTokens.get(chatId);
    const preferred = this.normalizeOptionalAccessToken(preferredToken);
    if (cachedAccessToken) {
      const grant = this.db.findActiveGrantByToken(chatId, cachedAccessToken, hashToken(cachedAccessToken));
      if (grant && this.isTrustedBootstrapGrant(grant)) {
        if (!preferred || preferred === cachedAccessToken) {
          return this.createProjection({
            chatId,
            accessRole: grant.role,
            accessToken: cachedAccessToken,
            participantId: grant.participantId as MessageContactId | undefined,
          });
        }
      }
      this.trustedBootstrapTokens.delete(chatId);
    }
    this.db.revokeActiveGrantsByDescriptor(descriptor);
    const accessToken = preferred ?? createOpaqueToken();
    const grant = this.db.issueGrant({
      ...descriptor,
      accessToken,
      tokenHash: hashToken(accessToken),
    });
    this.trustedBootstrapTokens.set(chatId, accessToken);
    return this.createProjection({
      chatId,
      accessRole: grant.role,
      accessToken,
      participantId: grant.participantId as MessageContactId | undefined,
    });
  }

  private createTrustedBootstrapDescriptor(chatId: string): {
    chatId: string;
    role: "admin";
    label: string;
    participantId: string;
  } {
    return {
      chatId,
      role: "admin",
      label: TRUSTED_BOOTSTRAP_LABEL,
      participantId: TRUSTED_BOOTSTRAP_PARTICIPANT_ID,
    };
  }

  private isTrustedBootstrapContact(contactId: MessageContactId): boolean {
    return contactId === TRUSTED_BOOTSTRAP_PARTICIPANT_ID;
  }

  private isTrustedBootstrapGrant(grant: Pick<MessageChannelGrantRecord, "role" | "label" | "participantId">): boolean {
    return (
      grant.role === "admin" &&
      grant.label === TRUSTED_BOOTSTRAP_LABEL &&
      grant.participantId === TRUSTED_BOOTSTRAP_PARTICIPANT_ID
    );
  }

  private createProjection(input: {
    chatId: string;
    accessRole: MessageChannelAccessRole;
    accessToken: string;
    participantId?: MessageContactId;
  }): MessageChannelAccessProjection {
    return {
      accessRole: input.accessRole,
      accessToken: input.accessToken,
      participantId: input.participantId,
      currentAdmin: input.participantId ? this.resolveCurrentAdminContactId(input.chatId) === input.participantId : false,
      transportUrl: this.getTransportEndpoint(input.chatId, input.accessToken)?.url,
    };
  }

  private withProjection(
    channel: Omit<MessageControlPlaneEntry, keyof MessageChannelAccessProjection | "seatStates">,
    projection: MessageChannelAccessProjection,
  ): MessageControlPlaneEntry {
    return {
      ...channel,
      ...projection,
      seatStates: this.listSeatStateProjections(channel.chatId),
    };
  }

  private listSeatStateProjections(chatId: string): MessageSeatStateProjection[] {
    const currentAdminId = this.resolveCurrentAdminContactId(chatId);
    const focusedByContact = new Map<string, boolean>();
    for (const [contactId, focusedIds] of this.focusedChatIdsByContact.entries()) {
      if (focusedIds.has(chatId)) {
        focusedByContact.set(contactId, true);
      }
    }
    const entries = this.db
      .listActiveGrants(chatId)
      .filter((grant): grant is MessageChannelGrantRecord & { participantId: MessageContactId } => {
        return Boolean(grant.participantId) && !this.isTrustedBootstrapGrant(grant);
      })
      .map((grant) => {
        const presence = this.contactPresence.get(grant.participantId);
        return {
          contactId: grant.participantId,
          role: grant.role,
          label: grant.label,
          currentAdmin: currentAdminId === grant.participantId,
          online: presence?.online ?? false,
          focused: focusedByContact.get(grant.participantId) ?? false,
          invalidCredential: presence?.invalidCredential ?? false,
        } satisfies MessageSeatStateProjection;
      });
    return entries.sort((left, right) => {
      if (left.currentAdmin !== right.currentAdmin) {
        return left.currentAdmin ? -1 : 1;
      }
      const roleDiff = roleRank(right.role) - roleRank(left.role);
      if (roleDiff !== 0) {
        return roleDiff;
      }
      return left.contactId.localeCompare(right.contactId);
    });
  }

  private createInitialReadMembership(
    chatId: string,
    senderContactId?: MessageContactId,
  ): { readContactIds: MessageContactId[]; unreadContactIds: MessageContactId[] } {
    const participantContactIds = this.db
      .listActiveGrants(chatId)
      .filter((grant): grant is MessageChannelGrantRecord & { participantId: MessageContactId } => {
        return Boolean(grant.participantId) && !this.isTrustedBootstrapGrant(grant);
      })
      .map((grant) => grant.participantId);
    const readContactIds = senderContactId && participantContactIds.includes(senderContactId) ? [senderContactId] : [];
    return {
      readContactIds,
      unreadContactIds: participantContactIds.filter((contactId) => !readContactIds.includes(contactId)),
    };
  }

  private repairChannelParticipants(
    participants: MessageParticipant[],
    contactIdMap: ReadonlyMap<MessageContactId, MessageContactId>,
  ): MessageParticipant[] {
    return (
      normalizeChannelParticipants(
        participants.map((participant) => ({
          ...participant,
          id:
            remapContactId(
              isCanonicalContactId(participant.id) ? (participant.id as MessageContactId) : undefined,
              contactIdMap,
            ) ?? participant.id,
        })),
      ) ?? []
    );
  }

  private repairChannelMetadata(
    metadata: Record<string, unknown> | undefined,
    contactIdMap: ReadonlyMap<MessageContactId, MessageContactId>,
  ): Record<string, unknown> {
    const candidateIds = remapContactIds(this.readAdminGroupCandidateIds(metadata), contactIdMap);
    const pendingAdminWork = this.readPendingAdminWork(metadata).map((item) => ({
      ...item,
      requestedBy: remapContactId(item.requestedBy, contactIdMap) ?? item.requestedBy,
      assignedAdminId: remapContactId(item.assignedAdminId, contactIdMap),
    }));
    return {
      ...(metadata ?? {}),
      [ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY]: candidateIds,
      [ROOM_PENDING_ADMIN_WORK_KEY]: pendingAdminWork,
    };
  }

  private repairActiveGrantsForContactAliases(
    chatId: string,
    contactIdMap: ReadonlyMap<MessageContactId, MessageContactId>,
  ): boolean {
    if (contactIdMap.size === 0) {
      return false;
    }
    const activeGrants = this.db.listActiveGrants(chatId);
    const sourceContactIds = new Set<MessageContactId>(
      [...contactIdMap.keys()].filter((contactId) =>
        activeGrants.some((grant) => grant.participantId === contactId && !this.isTrustedBootstrapGrant(grant)),
      ),
    );
    if (sourceContactIds.size === 0) {
      return false;
    }
    const targetContactIds = new Set<MessageContactId>(
      [...sourceContactIds].map((contactId) => contactIdMap.get(contactId)!).filter(Boolean),
    );
    const grouped = new Map<MessageContactId, MessageChannelGrantRecord[]>();
    for (const grant of activeGrants) {
      if (!grant.participantId || this.isTrustedBootstrapGrant(grant)) {
        continue;
      }
      if (!sourceContactIds.has(grant.participantId) && !targetContactIds.has(grant.participantId)) {
        continue;
      }
      const participantId = contactIdMap.get(grant.participantId) ?? grant.participantId;
      const current = grouped.get(participantId);
      if (current) {
        current.push(grant);
      } else {
        grouped.set(participantId, [grant]);
      }
    }

    let changed = false;
    for (const [participantId, grants] of grouped) {
      const preferred = grants.reduce(
        (best, current) => {
          if (!best) {
            return current;
          }
          const roleDiff = roleRank(current.role) - roleRank(best.role);
          if (roleDiff !== 0) {
            return roleDiff > 0 ? current : best;
          }
          return current.createdAt >= best.createdAt ? current : best;
        },
        null as MessageChannelGrantRecord | null,
      );
      if (!preferred) {
        continue;
      }
      const preferredLabel = preferred.label ?? grants.find((grant) => grant.label)?.label;
      const redundantGrantIds = grants
        .filter((grant) => grant.grantId !== preferred.grantId)
        .map((grant) => grant.grantId);
      for (const grantId of redundantGrantIds) {
        this.db.revokeGrant(chatId, grantId);
      }
      const needsPreferredUpdate =
        preferred.participantId !== participantId || (preferred.label ?? undefined) !== preferredLabel;
      if (redundantGrantIds.length === 0 && !needsPreferredUpdate) {
        continue;
      }
      this.db.updateGrant(chatId, preferred.grantId, {
        participantId,
        role: preferred.role,
        label: preferredLabel,
      });
      changed = true;
    }

    return changed;
  }

  private requireAccess(
    chatId: string,
    accessToken: string,
    minimumRole: MessageChannelAccessRole,
    input: { includeArchived?: boolean } = {},
  ): MessageChannelGrantRecord {
    const channel = this.db.getChannel(chatId, input.includeArchived ?? true);
    if (!channel) {
      throw new Error("message channel access denied");
    }
    if (!ACCESS_TOKEN_PATTERN.test(accessToken)) {
      throw new Error("message room credential-invalid");
    }
    const grant = this.db.findActiveGrantByToken(chatId, accessToken, hashToken(accessToken));
    if (!grant) {
      throw new Error("message room credential-invalid");
    }
    if (grant.participantId && isCanonicalContactId(grant.participantId)) {
      this.touchContactPresence(grant.participantId as MessageContactId);
    }
    if (roleRank(grant.role) < roleRank(minimumRole)) {
      throw new Error(
        minimumRole === "admin"
          ? "message channel admin access required"
          : minimumRole === "member"
            ? "message channel member access required"
            : "message channel access denied",
      );
    }
    return grant;
  }

  private resolveAuthorizedSender(
    chatId: string,
    grant: MessageChannelGrantRecord,
    input: Pick<MessageAppendInput, "senderContactId" | "from">,
  ): { senderContactId?: MessageContactId; from: string } {
    const senderContactId =
      input.senderContactId ??
      (grant.participantId && isCanonicalContactId(grant.participantId) ? grant.participantId : undefined);
    const channel = this.db.getChannel(chatId);
    const participantLabel = senderContactId
      ? channel?.participants.find((participant) => participant.id === senderContactId)?.label?.trim()
      : undefined;
    const from =
      participantLabel ||
      grant.label?.trim() ||
      input.from?.trim() ||
      (senderContactId ? fallbackContactLabel(senderContactId) : "User");
    return { senderContactId, from };
  }

  private requireAdministrativeGrant(
    chatId: string,
    accessToken?: string,
    superadminContactId?: MessageContactId,
  ): MessageChannelGrantRecord {
    if (superadminContactId) {
      this.assertContactId(superadminContactId);
      this.touchContactPresence(superadminContactId);
      return {
        grantId: `superadmin:${superadminContactId}`,
        chatId,
        role: "admin",
        participantId: superadminContactId,
        accessToken: "",
        createdAt: Date.now(),
      };
    }
    if (!accessToken) {
      throw new Error("message channel admin access required");
    }
    const grant = this.requireAccess(chatId, accessToken, "admin", { includeArchived: true });
    const currentAdminId = this.resolveCurrentAdminContactId(chatId);
    if (currentAdminId && grant.participantId !== currentAdminId) {
      throw new Error("message room current-admin required");
    }
    return grant;
  }

  private requireRoomControl(
    chatId: string,
    superKey: PrincipalId,
    role: MessageChannelAccessRole = "admin",
  ): MessageChannelGrantRecord {
    const normalizedSuperKey = normalizePrincipalId(superKey);
    const channel = this.db.getChannel(chatId, true);
    if (!channel || channel.superKey !== normalizedSuperKey) {
      throw new Error("message room superKey control required");
    }
    return {
      grantId: `room-super-key:${chatId}:${normalizedSuperKey}`,
      chatId,
      role,
      accessToken: "",
      createdAt: Date.now(),
    };
  }

  private resolveGrantAccessToken(input: string | undefined): string {
    const value = input?.trim();
    if (!value) {
      return createOpaqueToken();
    }
    if (!ACCESS_TOKEN_PATTERN.test(value)) {
      throw new Error("invalid access token format");
    }
    return value;
  }

  private normalizeOptionalAccessToken(input: string | undefined): string | undefined {
    const value = input?.trim();
    if (!value) {
      return undefined;
    }
    if (!ACCESS_TOKEN_PATTERN.test(value)) {
      throw new Error("invalid access token format");
    }
    return value;
  }

  private assertContactId(contactId: string): void {
    if (!isCanonicalContactId(contactId)) {
      throw new Error(`invalid contact id: ${contactId}`);
    }
  }

  private expireContactRequestIfNeeded(request: MessageContactRequestRecord): MessageContactRequestRecord {
    if (request.state !== "pending" || !request.expiresAt || request.expiresAt > Date.now()) {
      return request;
    }
    return this.db.updateContactRequestState({
      ownerContactId: request.ownerContactId,
      requestId: request.requestId,
      state: "expired",
      respondedAt: request.expiresAt,
    });
  }

  private requirePendingContactRequest(ownerContactId: MessageContactId, requestId: string): MessageContactRequestRecord {
    const current = this.db.getContactRequest(ownerContactId, requestId);
    if (!current) {
      throw new Error(`unknown contact request: ${requestId}`);
    }
    const next = this.expireContactRequestIfNeeded(current);
    if (next.state !== "pending") {
      throw new Error(`contact request is not pending: ${requestId}`);
    }
    return next;
  }

  private getFocusedChatIdsForContact(contactId: string): Set<string> {
    let focused = this.focusedChatIdsByContact.get(contactId);
    if (!focused) {
      focused = new Set<string>();
      this.focusedChatIdsByContact.set(contactId, focused);
    }
    return focused;
  }

  private touchContactPresence(contactId: MessageContactId): void {
    const now = Date.now();
    const current = this.contactPresence.get(contactId);
    this.contactPresence.set(contactId, {
      online: true,
      expiresAt: contactId.startsWith("auth:") ? now + TRANSIENT_CONTACT_PRESENCE_TTL_MS : (current?.expiresAt ?? null),
      invalidCredential: current?.invalidCredential ?? false,
    });
    this.db.touchContactState(contactId, {
      lastActiveAt: now,
      lastLoginAt: current?.online ? undefined : now,
      online: true,
    });
    this.syncAdminAssignments();
    if (!current?.online) {
      this.emitPresenceChanged(contactId);
    }
  }

  private ensureContactAccess(
    chatId: string,
    contactId: MessageContactId,
    role: MessageChannelAccessRole,
    preferredToken?: string,
    label?: string,
  ): MessageChannelAccessProjection {
    this.assertContactId(contactId);
    if (!this.isTrustedBootstrapContact(contactId)) {
      this.db.initializeContactRoomState(chatId, contactId);
    }
    const existing = this.db.findReusableGrant({ chatId, role, participantId: contactId });
    if (existing?.accessToken) {
      if ((existing.label ?? undefined) !== label) {
        this.db.updateGrant(chatId, existing.grantId, {
          role: existing.role,
          participantId: contactId,
          label,
        });
      }
      return this.createProjection({
        chatId,
        accessRole: existing.role,
        accessToken: existing.accessToken,
        participantId: contactId,
      });
    }
    const accessToken = this.resolveGrantAccessToken(preferredToken);
    this.db.revokeActiveGrantsByParticipant(chatId, contactId);
    const grant = this.db.issueGrant({
      chatId,
      role,
      label,
      participantId: contactId,
      accessToken,
      tokenHash: hashToken(accessToken),
    });
    return this.createProjection({
      chatId,
      accessRole: grant.role,
      accessToken,
      participantId: contactId,
    });
  }

  private resolveManagedSeatPayload(seatClass: MessageManagedSeatClass, label?: string): MessageManagedSeatPayload {
    return {
      seatClass,
      role: seatClass,
      label,
    };
  }

  private requirePendingInvitationByDescriptor(descriptor: string): MessageInvitationRecord {
    this.db.expirePendingInvitations();
    const { token } = parseManagedInvitationDescriptorInput(descriptor);
    const invitation = this.db.findInvitationByTokenHash(hashManagedInvitationToken(token));
    if (!invitation) {
      throw new Error("unknown room invitation");
    }
    if (invitation.status !== "pending") {
      throw new Error(`room invitation is not pending: ${invitation.status}`);
    }
    if (isManagedInvitationExpired({ expiresAt: invitation.expiresAt })) {
      this.db.updateInvitationStatus(invitation.resourceId, invitation.invitationId, {
        status: "expired",
      });
      throw new Error("room invitation expired");
    }
    return invitation;
  }

  private activateManagedSeatPayload(
    chatId: string,
    contactId: MessageContactId,
    payload: MessageManagedSeatPayload,
  ): MessageChannelAccessProjection {
    const access = this.ensureContactAccess(chatId, contactId, payload.role, undefined, payload.label);
    const channel = this.db.getChannel(chatId);
    if (channel && payload.role === "admin") {
      const currentCandidates = this.readAdminGroupCandidateIds(channel.metadata);
      if (!currentCandidates.includes(contactId)) {
        this.db.updateChannel(
          chatId,
          {
            metadata: this.withAdminState(chatId, {
              ...(channel.metadata ?? {}),
              [ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY]: [...currentCandidates, contactId],
            }),
          },
          false,
        );
      }
    }
    return access;
  }

  private resolveManagedSeatInviterPrincipalId(
    contactId: string | undefined,
    superadminContactId?: MessageContactId,
  ): MessageInvitationRecord["inviterPrincipalId"] {
    const candidate = (contactId ?? superadminContactId)?.trim();
    if (!candidate || !isPrincipalId(candidate)) {
      throw new Error("room managed invitation inviter must resolve to a principal id");
    }
    return candidate;
  }

  private issueContactAccessToken(chatId: string, contactId: MessageContactId, role: MessageChannelAccessRole): string {
    return this.ensureContactAccess(chatId, contactId, role).accessToken;
  }

  private normalizeChannelPatch(patch: MessageChannelPatchInput, chatId: string): MessageChannelPatchInput {
    const current = this.db.getChannel(chatId);
    const currentMetadata = current?.metadata ?? {};
    const nextMetadata = {
      ...currentMetadata,
      ...(patch.metadata ?? {}),
      ...(patch.adminGroupCandidateIds
        ? { [ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY]: [...patch.adminGroupCandidateIds] }
        : {}),
    };
    const synced = this.withAdminState(chatId, nextMetadata);
    const participants = normalizeChannelParticipants(patch.participants) ?? current?.participants;
    this.assertRoomModeParticipants(participants, synced);
    return {
      title: patch.title,
      participants,
      metadata: synced,
    };
  }

  private assertRoomModeParticipants(
    participants: MessageParticipant[] | undefined,
    metadata: Record<string, unknown> | undefined,
  ): void {
    const roomMode = metadata?.roomMode;
    if (roomMode === undefined) {
      return;
    }
    if (roomMode !== "direct" && roomMode !== "public") {
      throw new Error(`invalid roomMode: ${String(roomMode)}`);
    }
    if (roomMode === "direct" && (participants?.length ?? 0) > 2) {
      throw new Error("direct room cannot have more than two participants");
    }
  }

  private withAdminState(chatId: string, metadata: Record<string, unknown> | undefined): Record<string, unknown> {
    const currentAdminId = this.resolveCurrentAdminContactId(chatId, metadata);
    const pendingAdminWork = this.reassignPendingAdminWork(chatId, metadata, currentAdminId);
    return {
      ...(metadata ?? {}),
      [ROOM_CURRENT_ADMIN_ID_KEY]: currentAdminId,
      [ROOM_PENDING_ADMIN_WORK_KEY]: pendingAdminWork,
    };
  }

  private resolveCurrentAdminContactId(chatId: string, metadata?: Record<string, unknown>): MessageContactId | null {
    const channel = metadata ? { metadata } : this.db.getChannel(chatId);
    const candidateIds = this.readAdminGroupCandidateIds(channel?.metadata);
    if (candidateIds.length === 0) {
      return null;
    }
    this.pruneExpiredPresence();
    for (const contactId of candidateIds) {
      const presence = this.contactPresence.get(contactId);
      if (presence?.online) {
        return contactId;
      }
    }
    return null;
  }

  private readAdminGroupCandidateIds(metadata: Record<string, unknown> | undefined): MessageContactId[] {
    const candidates = metadata?.[ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY];
    if (!Array.isArray(candidates)) {
      return [];
    }
    return candidates
      .filter((value): value is string => typeof value === "string" && isCanonicalContactId(value))
      .map((value) => value as MessageContactId);
  }

  private readPendingAdminWork(metadata: Record<string, unknown> | undefined): MessageAdminWorkItem[] {
    const raw = metadata?.[ROOM_PENDING_ADMIN_WORK_KEY];
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(
      (value): value is MessageAdminWorkItem => Boolean(value) && typeof value === "object" && "workId" in value,
    );
  }

  private reassignPendingAdminWork(
    chatId: string,
    metadata: Record<string, unknown> | undefined,
    currentAdminId: MessageContactId | null,
  ): MessageAdminWorkItem[] {
    return this.readPendingAdminWork(metadata).map((item) => ({
      ...item,
      assignedAdminId: currentAdminId ?? undefined,
    }));
  }

  queueAdminWork(input: {
    chatId: string;
    requestedBy: MessageContactId;
    kind: MessageAdminWorkItem["kind"];
    payload?: Record<string, unknown>;
  }): MessageAdminWorkItem {
    const channel = this.db.getChannel(input.chatId);
    if (!channel) {
      throw new Error(`unknown room: ${input.chatId}`);
    }
    const metadata = channel.metadata ?? {};
    const currentAdminId = this.resolveCurrentAdminContactId(input.chatId, metadata);
    const item: MessageAdminWorkItem = {
      workId: `room-work-${randomUUID()}`,
      kind: input.kind,
      createdAt: Date.now(),
      requestedBy: input.requestedBy,
      assignedAdminId: currentAdminId ?? undefined,
      payload: input.payload,
    };
    const nextMetadata = this.withAdminState(input.chatId, {
      ...metadata,
      [ROOM_PENDING_ADMIN_WORK_KEY]: [...this.readPendingAdminWork(metadata), item],
    });
    this.db.updateChannel(input.chatId, { metadata: nextMetadata }, false);
    const revisions = this.db.bumpRoomRevision(input.chatId);
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "updated",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      ...revisions,
      contactId: input.requestedBy,
    });
    return item;
  }

  listPendingAdminWork(chatId: string): MessageAdminWorkItem[] {
    const channel = this.db.getChannel(chatId);
    return this.readPendingAdminWork(channel?.metadata);
  }

  private pruneExpiredPresence(): void {
    const now = Date.now();
    for (const [contactId, presence] of [...this.contactPresence.entries()]) {
      if (presence.expiresAt !== null && presence.expiresAt <= now) {
        this.contactPresence.delete(contactId);
      }
    }
  }

  private syncAdminAssignments(): void {
    this.pruneExpiredPresence();
    const changedChannels: Array<{ chatId: string; builtIn: boolean }> = [];
    for (const channel of this.db.listChannels(new Set<string>(), true)) {
      const nextMetadata = this.withAdminState(channel.chatId, channel.metadata);
      if (JSON.stringify(nextMetadata) === JSON.stringify(channel.metadata ?? {})) {
        continue;
      }
      this.db.updateChannel(channel.chatId, { metadata: nextMetadata }, false);
      changedChannels.push({
        chatId: channel.chatId,
        builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      });
    }
    if (changedChannels.length > 0) {
      this.bumpVersion();
      for (const channel of changedChannels) {
        const revisions = this.db.bumpRoomRevision(channel.chatId);
        this.emitChannelChanged({
          chatId: channel.chatId,
          reason: "presence",
          builtIn: channel.builtIn,
          ...revisions,
        });
      }
    }
  }

  private bumpUnreadVersions(...contactGroups: ReadonlyArray<readonly MessageContactId[]>): void {
    const uniqueContactIds = new Set<MessageContactId>();
    for (const contactIds of contactGroups) {
      for (const contactId of contactIds) {
        if (isCanonicalContactId(contactId) && !this.isTrustedBootstrapContact(contactId)) {
          uniqueContactIds.add(contactId);
        }
      }
    }
    for (const contactId of uniqueContactIds) {
      this.bumpUnreadVersion(contactId);
    }
  }

  private bumpUnreadVersion(contactId: MessageContactId): void {
    const nextVersion = (this.unreadVersionByContact.get(contactId) ?? 0) + 1;
    this.unreadVersionByContact.set(contactId, nextVersion);
    for (const waiter of [...this.unreadWaiters]) {
      if (!waiter.active || waiter.contactId !== contactId || nextVersion <= waiter.afterVersion) {
        continue;
      }
      waiter.active = false;
      this.unreadWaiters.delete(waiter);
      waiter.resolve({
        contactId,
        version: String(nextVersion),
      });
    }
  }

  private bumpVersion(): void {
    this.headVersion += 1;
    for (const waiter of [...this.waiters]) {
      if (!waiter.active || this.headVersion <= waiter.afterVersion) {
        continue;
      }
      waiter.active = false;
      this.waiters.delete(waiter);
      waiter.resolve({ version: this.getHeadVersion() });
    }
  }
}
