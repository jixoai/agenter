import { createHash, randomUUID } from "node:crypto";

import { isPrincipalId } from "@agenter/principal-crypto";
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
import { MessageDb } from "./message-db";
import { resolveDefaultMessageControlDbPath } from "./message-paths";
import type { MessageAuthorizedQueryInput, MessageQueryResult } from "./message-query-types";
import type {
  CommitWaitHandle,
  MessageActorId,
  MessageActorStateRecord,
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
  MessageIssueGrantInput,
  MessageIssuedGrant,
  MessageInvitationRecord,
  MessageInviteSeatInput,
  MessageManagedSeatClass,
  MessageManagedSeatPayload,
  MessageConfigSeatInput,
  MessageAcceptSeatInput,
  MessageRevokeSeatInput,
  MessageParticipant,
  MessageRecallInput,
  MessageRecord,
  MessageSeatStateProjection,
  MessageSourceSubscriptionInput,
  MessageSourceSubscriptionRecord,
  MessageSnapshot,
  MessageTransportClientMessage,
  MessageTransportConfig,
  MessageTransportEndpoint,
  MessageTransportServerMessage,
  MessageUnreadRoomSummary,
  ReversePage,
  ReverseTimeCursor,
} from "./types";

interface Waiter {
  afterVersion: number;
  resolve: (value: { version: string }) => void;
  reject: (reason: unknown) => void;
  active: boolean;
}

interface UnreadWaiter {
  actorId: MessageActorId;
  afterVersion: number;
  resolve: (value: { actorId: MessageActorId; version: string }) => void;
  reject: (reason: unknown) => void;
  active: boolean;
}

interface MessageSocketData {
  chatId: string;
  actorId: string | null;
  accessRole: MessageChannelAccessRole;
  accessToken: string;
  cleanup: Array<() => void>;
}

interface ActorPresence {
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
  actorId?: MessageActorId;
}

const TRUSTED_BOOTSTRAP_LABEL = "Trusted bootstrap";
const TRUSTED_BOOTSTRAP_PARTICIPANT_ID: MessageActorId = "system:trusted-bootstrap";
const ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY = "roomAdminGroupCandidateIds";
const ROOM_CURRENT_ADMIN_ID_KEY = "currentRoomAdminId";
const ROOM_PENDING_ADMIN_WORK_KEY = "pendingAdminWork";
const TRANSIENT_ACTOR_PRESENCE_TTL_MS = 90_000;
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
const LEGACY_ACTOR_ID_PATTERN = /^(auth|session|system):.+$/;
const fallbackActorLabel = (actorId: string): string => actorId.split(":").at(-1) ?? actorId;

const isCanonicalActorId = (value: string): value is MessageActorId =>
  isPrincipalId(value) ||
  (LEGACY_ACTOR_ID_PATTERN.test(value) &&
    (value.startsWith("auth:") || value.startsWith("session:") || value.startsWith("system:")));

const normalizeChannelParticipants = (participants?: MessageParticipant[]): MessageParticipant[] | undefined => {
  if (!participants) {
    return undefined;
  }
  const seen = new Set<string>();
  const normalized: MessageParticipant[] = [];
  for (const participant of participants) {
    const id = participant.id.trim();
    if (!isCanonicalActorId(id) || seen.has(id)) {
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
  const normalized = new Map<MessageActorId, MessageCreateInitialUserInput>();
  for (const user of initialUsers) {
    const actorId = user.actorId.trim();
    if (!isCanonicalActorId(actorId)) {
      throw new Error("room initial user actorId must be a principal id or auth:/session:/system: actor id");
    }
    const current = normalized.get(actorId);
    const currentRank = current ? roleRank(current.role) : -1;
    const nextRank = roleRank(user.role);
    const label = user.label?.trim() || current?.label;
    normalized.set(actorId, {
      actorId,
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
    merged.set(user.actorId, user.label ? { id: user.actorId, label: user.label } : { id: user.actorId });
  }
  return [...merged.values()];
};
const remapActorId = (
  actorId: MessageActorId | undefined,
  actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
): MessageActorId | undefined => (actorId ? (actorIdMap.get(actorId) ?? actorId) : undefined);
const remapActorIds = (
  actorIds: readonly MessageActorId[],
  actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
): MessageActorId[] =>
  [...new Set(actorIds.map((actorId) => actorIdMap.get(actorId) ?? actorId))].sort((left, right) =>
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
  private readonly focusedChatIdsByActor = new Map<string, Set<string>>();
  private readonly actorPresence = new Map<string, ActorPresence>();
  private readonly trustedBootstrapTokens = new Map<string, string>();
  private readonly messageListeners = new Set<(payload: { chatId: string; message: MessageRecord }) => void>();
  private readonly channelChangeListeners = new Set<(payload: MessageChannelChangePayload) => void>();
  private readonly focusListeners = new Set<
    (payload: { actorId: string; chatIds: string[]; changedChatIds: string[] }) => void
  >();
  private readonly waiters = new Set<Waiter>();
  private readonly unreadWaiters = new Set<UnreadWaiter>();
  private readonly unreadVersionByActor = new Map<MessageActorId, number>();
  private config: MessageControlPlaneConfig;
  private transportServer: Bun.Server<MessageSocketData> | null = null;
  private headVersion = 0;

  constructor(
    private readonly options: {
      dbPath?: string;
      initialConfig?: MessageControlPlaneConfig;
    } = {},
  ) {
    this.config = {
      defaultOwner: options.initialConfig?.defaultOwner ?? "agenter",
      transport: cloneTransport(options.initialConfig?.transport),
    };
    this.db = new MessageDb(options.dbPath ?? resolveDefaultMessageControlDbPath());
  }

  close(): void {
    this.stopTransport();
    this.trustedBootstrapTokens.clear();
    this.unreadVersionByActor.clear();
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

  onFocus(listener: (payload: { actorId: string; chatIds: string[]; changedChatIds: string[] }) => void): () => void {
    this.focusListeners.add(listener);
    return () => this.focusListeners.delete(listener);
  }

  setActorPresence(actorId: MessageActorId, input: { online: boolean; ttlMs?: number } | boolean): void {
    this.assertActorId(actorId);
    const online = typeof input === "boolean" ? input : input.online;
    const now = Date.now();
    const current = this.actorPresence.get(actorId);
    if (!online) {
      this.actorPresence.delete(actorId);
      this.db.touchActorState(actorId, {
        lastActiveAt: now,
        online: false,
      });
      this.syncAdminAssignments();
      if (current) {
        this.emitPresenceChanged(actorId);
      }
      return;
    }
    const ttlMs = typeof input === "boolean" ? undefined : input.ttlMs;
    this.actorPresence.set(actorId, {
      online: true,
      expiresAt: typeof ttlMs === "number" && ttlMs > 0 ? now + ttlMs : null,
      invalidCredential: current?.invalidCredential ?? false,
    });
    this.db.touchActorState(actorId, {
      lastActiveAt: now,
      lastLoginAt: current?.online ? undefined : now,
      online: true,
    });
    this.syncAdminAssignments();
    if (!current?.online) {
      this.emitPresenceChanged(actorId);
    }
  }

  setCredentialState(actorId: MessageActorId, input: { invalidCredential: boolean }): void {
    this.assertActorId(actorId);
    const current = this.actorPresence.get(actorId);
    this.actorPresence.set(actorId, {
      online: current?.online ?? false,
      expiresAt: current?.expiresAt ?? null,
      invalidCredential: input.invalidCredential,
    });
    if ((current?.invalidCredential ?? false) !== input.invalidCredential) {
      this.emitPresenceChanged(actorId);
    }
  }

  listChannelsForActor(
    actorId: MessageActorId,
    input: { includeArchived?: boolean; touchPresence?: boolean } = {},
  ): MessageControlPlaneEntry[] {
    this.assertActorId(actorId);
    if (input.touchPresence ?? true) {
      this.touchActorPresence(actorId);
    }
    const focusedIds = this.getFocusedChatIdsForActor(actorId);
    return this.db.listActorChannelAccess(actorId, input.includeArchived ?? false).map(({ channel, grant }) =>
      this.withProjection(
        {
          ...channel,
          focused: focusedIds.has(channel.chatId),
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        this.createProjection({
          chatId: channel.chatId,
          accessRole: grant.role,
          accessToken: grant.accessToken ?? this.issueActorAccessToken(channel.chatId, actorId, grant.role),
          participantId: grant.participantId as MessageActorId,
        }),
      ),
    );
  }

  getChannelForActor(
    chatId: string,
    actorId: MessageActorId,
    input: { includeArchived?: boolean; touchPresence?: boolean } = {},
  ): MessageControlPlaneEntry | undefined {
    return this.listChannelsForActor(actorId, input).find((channel) => channel.chatId === chatId);
  }

  listChannels(input: { includeArchived?: boolean } = {}): MessageControlPlaneEntry[] {
    return this.db
      .listChannels(this.getFocusedChatIdsForActor(TRUSTED_BOOTSTRAP_PARTICIPANT_ID), input.includeArchived ?? false)
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
      this.getFocusedChatIdsForActor(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(chatId),
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
        participants,
      },
      this.getFocusedChatIdsForActor(input.bootstrapActorId ?? TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(input.chatId),
    );
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: channel.chatId,
      reason: "created",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      actorId: input.bootstrapActorId,
    });
    const adminProjection = input.bootstrapActorId
      ? this.ensureActorAccess(input.chatId, input.bootstrapActorId, "admin", input.adminToken)
      : this.issueTrustedBootstrapAccess(input.chatId, input.adminToken);
    if (input.bootstrapActorId) {
      this.focusForActor(input.bootstrapActorId, "add", [input.chatId]);
    }

    for (const user of initialUsers ?? []) {
      if (input.bootstrapActorId && user.actorId === input.bootstrapActorId) {
        if (user.focused) {
          this.focusForActor(user.actorId, "add", [input.chatId]);
        }
        continue;
      }
      const issued = this.issueChannelGrantAuthorized({
        chatId: input.chatId,
        accessToken: adminProjection.accessToken,
        role: user.role,
        label: user.label,
        participantId: user.actorId,
      });
      if (user.focused) {
        this.focusAuthorized("add", [{ chatId: input.chatId, accessToken: issued.accessToken }]);
      }
    }

    if (input.bootstrapActorId) {
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
    return this.focusForActor(TRUSTED_BOOTSTRAP_PARTICIPANT_ID, op, chatIds);
  }

  focusForActor(actorId: MessageActorId, op: MessageFocusOp = "replace", chatIds: string[] = []): string[] {
    this.assertActorId(actorId);
    const validIds = chatIds.filter((chatId) => {
      const channel = this.db.getChannel(chatId);
      return Boolean(channel) && !channel?.archivedAt;
    });
    const previous = new Set(this.getFocusedChatIdsForActor(actorId));
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
    this.focusedChatIdsByActor.set(actorId, current);
    const changedChatIds = [
      ...new Set([...previous, ...current].filter((chatId) => previous.has(chatId) !== current.has(chatId))),
    ];
    if (changedChatIds.length > 0) {
      this.bumpVersion();
      for (const chatId of changedChatIds) {
        this.emitChannelChanged({
          chatId,
          reason: "focus",
          builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(chatId)?.metadata),
          actorId,
        });
      }
    }
    const payload = { actorId, chatIds: [...current], changedChatIds };
    for (const listener of this.focusListeners) {
      listener(payload);
    }
    return payload.chatIds;
  }

  focusAuthorized(op: MessageFocusOp, access: Array<{ chatId: string; accessToken: string }>): string[] {
    const grants = access.map(({ chatId, accessToken }) => this.requireAccess(chatId, accessToken, "readonly"));
    const actorId = grants[0]?.participantId;
    if (!actorId || !isCanonicalActorId(actorId)) {
      return this.focus(
        op,
        grants.map((grant) => grant.chatId),
      );
    }
    const allowedChatIds = grants
      .map((grant) => grant.chatId)
      .filter((chatId, index, items) => items.indexOf(chatId) === index);
    return this.focusForActor(actorId as MessageActorId, op, allowedChatIds);
  }

  getFocusedChatIds(actorId: MessageActorId = TRUSTED_BOOTSTRAP_PARTICIPANT_ID): string[] {
    return [...this.getFocusedChatIdsForActor(actorId)];
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
      if (input.actorId && !input.superadminActorId) {
        const room = this.getChannelForActor(requested, input.actorId, {
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

    if (input.actorId && !input.superadminActorId) {
      const allowed = this.listChannelsForActor(input.actorId, {
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

  private emitPresenceChanged(actorId: MessageActorId): void {
    const seen = new Set<string>();
    for (const { channel } of this.db.listActorChannelAccess(actorId, true)) {
      if (seen.has(channel.chatId)) {
        continue;
      }
      seen.add(channel.chatId);
      this.emitChannelChanged({
        chatId: channel.chatId,
        reason: "presence",
        builtIn: this.isBuiltInChannelMetadata(channel.metadata),
        actorId,
      });
    }
  }

  send(input: MessageAppendInput): MessageRecord {
    const createdAt = input.createdAt ?? Date.now();
    const visibleAt = input.visibleAt ?? createdAt;
    const from = input.from?.trim() || (input.senderActorId ? fallbackActorLabel(input.senderActorId) : "User");
    const readMembership =
      input.readActorIds || input.unreadActorIds
        ? {
            readActorIds: input.readActorIds ?? [],
            unreadActorIds: input.unreadActorIds ?? [],
          }
        : this.createInitialReadMembership(input.chatId, input.senderActorId);
    const result = this.db.appendMessageDetailed({
      ...input,
      from,
      createdAt,
      visibleAt,
      readActorIds: readMembership.readActorIds,
      unreadActorIds: readMembership.unreadActorIds,
    });
    if (!result.inserted) {
      return result.message;
    }
    const message = result.message;
    this.bumpVersion();
    this.bumpUnreadVersions(result.readActorIds, result.unreadActorIds);
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "message",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
    });
    return message;
  }

  edit(input: MessageEditInput): MessageRecord {
    const message = this.db.editMessage(input);
    this.bumpVersion();
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "message",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
    });
    return message;
  }

  recall(input: MessageRecallInput): MessageRecord {
    // Recall preserves the transcript row as durable history, but it also
    // changes active unread projections; both version streams must be bumped.
    const { message, unreadChangedActorIds } = this.db.recallMessage(input);
    this.bumpVersion();
    this.bumpUnreadVersions(unreadChangedActorIds);
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "message",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
    });
    return message;
  }

  sendAuthorized(input: MessageAuthorizedWriteInput): MessageRecord {
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
    const readMembership = this.createInitialReadMembership(input.chatId, sender.senderActorId);
    const createdAt = input.createdAt ?? Date.now();
    const visibleAt = input.visibleAt ?? createdAt;
    return this.send({
      chatId: input.chatId,
      ref: input.ref,
      clientMessageId: input.clientMessageId,
      senderActorId: sender.senderActorId,
      from: sender.from,
      kind: input.kind,
      content: input.content,
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
      visibleAt,
      readActorIds: readMembership.readActorIds,
      unreadActorIds: readMembership.unreadActorIds,
      metadata: input.metadata,
      attachments: input.attachments,
      payload: input.payload,
    });
  }

  editAuthorized(input: MessageAuthorizedEditInput): MessageRecord {
    const grant = this.requireAccess(input.chatId, input.accessToken, "member");
    const target = this.db.getMessage(input.chatId, input.messageId);
    if (!target) {
      throw new Error(`unknown message: ${input.messageId}`);
    }
    const editorActorId =
      grant.participantId && isCanonicalActorId(grant.participantId)
        ? (grant.participantId as MessageActorId)
        : undefined;
    if (editorActorId && !this.isTrustedBootstrapGrant(grant) && target.senderActorId !== editorActorId) {
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
    const recallActorId =
      grant.participantId && isCanonicalActorId(grant.participantId)
        ? (grant.participantId as MessageActorId)
        : undefined;
    if (recallActorId && !this.isTrustedBootstrapGrant(grant) && target.senderActorId !== recallActorId) {
      throw new Error("message recall requires original sender");
    }
    return this.recall({
      ...input,
      recalledByActorId: input.recalledByActorId ?? recallActorId,
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
    const readMembership = this.createInitialReadMembership(input.chatId, sender.senderActorId);
    return this.send({
      chatId: input.chatId,
      ref: input.ref,
      clientMessageId: input.clientMessageId,
      senderActorId: sender.senderActorId,
      from: sender.from,
      kind: "error",
      content: input.content,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      visibleAt: input.visibleAt ?? input.createdAt ?? Date.now(),
      readActorIds: readMembership.readActorIds,
      unreadActorIds: readMembership.unreadActorIds,
      metadata: input.metadata,
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
    const readMembership = this.createInitialReadMembership(input.chatId, sender.senderActorId);
    return this.send({
      chatId: input.chatId,
      ref: input.ref,
      clientMessageId: input.clientMessageId,
      senderActorId: sender.senderActorId,
      from: sender.from,
      kind: "interactive",
      content: input.content,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      visibleAt: input.visibleAt ?? input.createdAt ?? Date.now(),
      readActorIds: readMembership.readActorIds,
      unreadActorIds: readMembership.unreadActorIds,
      metadata: input.metadata,
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

  queryMessages(input: {
    chatId: string;
    before?: ReverseTimeCursor | null;
    limit?: number;
  }): ReversePage<MessageRecord> {
    return this.db.pageMessages(input.chatId, { before: input.before, limit: input.limit });
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

  queryMessagesAuthorized(input: MessageAuthorizedPageInput): ReversePage<MessageRecord> {
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

  resolveLatestVisibleMessage(
    chatId: string,
    input: { includeRecalled?: boolean } = {},
  ): MessageRecord | undefined {
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
        ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId)
        : false,
    );
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }

    if (!grant.participantId || !isCanonicalActorId(grant.participantId) || this.isTrustedBootstrapGrant(grant)) {
      return this.withProjection(
        {
          ...channel,
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        this.createProjection({
          chatId: input.chatId,
          accessRole: grant.role,
          accessToken: input.accessToken,
          participantId: grant.participantId as MessageActorId | undefined,
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
          participantId: grant.participantId as MessageActorId,
        }),
      );
    }
    const result = this.db.markMessagesReadUpTo({
      chatId: input.chatId,
      actorId: grant.participantId as MessageActorId,
      targetRowId: target.rowId,
    });
    if (result.changed) {
      this.bumpVersion();
      this.bumpUnreadVersion(grant.participantId as MessageActorId);
      this.emitChannelChanged({
        chatId: input.chatId,
        reason: "read",
        builtIn: this.isBuiltInChannelMetadata(channel.metadata),
        actorId: grant.participantId as MessageActorId,
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
        participantId: grant.participantId as MessageActorId,
      }),
    );
  }

  snapshot(chatId: string, limit = 50): MessageSnapshot {
    const snapshot = this.db.snapshot(
      chatId,
      this.getFocusedChatIdsForActor(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(chatId),
      limit,
    );
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
      headVersion: this.getHeadVersion(),
    };
  }

  snapshotAuthorized(input: MessageAuthorizedReadInput & { limit?: number }): MessageSnapshot {
    const grant = this.requireAccess(input.chatId, input.accessToken, "readonly");
    const page = this.db.pageMessages(input.chatId, { limit: input.limit });
    const snapshot = this.db.snapshot(
      input.chatId,
      grant.participantId
        ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId)
        : false,
      input.limit ?? 50,
    );
    return {
      channel: this.withProjection(
        {
          ...snapshot.channel,
          metadata: this.withAdminState(snapshot.channel.chatId, snapshot.channel.metadata),
        },
        this.createProjection({
          chatId: input.chatId,
          accessRole: grant.role,
          accessToken: input.accessToken,
          participantId: grant.participantId as MessageActorId | undefined,
        }),
      ),
      items: page.items,
      nextBefore: page.nextBefore,
      hasMoreBefore: page.hasMoreBefore,
      headVersion: this.getHeadVersion(),
    };
  }

  updateChannelAuthorized(input: {
    chatId: string;
    accessToken?: string;
    superadminActorId?: MessageActorId;
    patch: MessageChannelPatchInput;
  }): MessageControlPlaneEntry {
    const grant = this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    const patch = this.normalizeChannelPatch(input.patch, input.chatId);
    const channel = this.db.updateChannel(
      input.chatId,
      patch,
      grant.participantId
        ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId)
        : false,
    );
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "updated",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      actorId: grant.participantId as MessageActorId | undefined,
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
        participantId: grant.participantId as MessageActorId | undefined,
      }),
    );
  }

  repairChannelActorAliases(input: {
    chatId: string;
    aliases: Array<{
      fromActorId: MessageActorId;
      toActorId: MessageActorId;
    }>;
  }): MessageControlPlaneEntry | undefined {
    const actorIdMap = new Map<MessageActorId, MessageActorId>();
    for (const alias of input.aliases) {
      this.assertActorId(alias.fromActorId);
      this.assertActorId(alias.toActorId);
      if (alias.fromActorId !== alias.toActorId) {
        actorIdMap.set(alias.fromActorId, alias.toActorId);
      }
    }
    const focused = this.getFocusedChatIdsForActor(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(input.chatId);
    const channel = this.db.getChannel(input.chatId, focused);
    if (!channel) {
      return undefined;
    }
    if (actorIdMap.size === 0) {
      return this.withProjection(
        {
          ...channel,
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        this.issueTrustedBootstrapAccess(input.chatId),
      );
    }

    const grantsChanged = this.repairActiveGrantsForActorAliases(input.chatId, actorIdMap);
    const messagesChanged = this.db.repairMessageActorIds(input.chatId, actorIdMap).changed;
    const roomStateChanged = this.db.repairActorRoomStateAliases(input.chatId, actorIdMap).changed;
    const nextParticipants = this.repairChannelParticipants(channel.participants, actorIdMap);
    const nextMetadata = this.withAdminState(input.chatId, this.repairChannelMetadata(channel.metadata, actorIdMap));
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
      this.bumpVersion();
      this.emitChannelChanged({
        chatId: input.chatId,
        reason: "updated",
        builtIn: this.isBuiltInChannelMetadata(nextMetadata),
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
    superadminActorId?: MessageActorId;
    archivedBy: string;
  }): MessageControlPlaneEntry {
    const grant = this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    const channel = this.db.archiveChannel(
      input.chatId,
      input.archivedBy,
      grant.participantId
        ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId)
        : false,
    );
    for (const focused of this.focusedChatIdsByActor.values()) {
      focused.delete(input.chatId);
    }
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "archived",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      actorId: grant.participantId as MessageActorId | undefined,
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
        participantId: grant.participantId as MessageActorId | undefined,
      }),
    );
  }

  deleteChannelAuthorized(input: {
    chatId: string;
    accessToken?: string;
    superadminActorId?: MessageActorId;
  }): MessageControlPlaneEntry {
    const grant = this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    const affectedActorIds = this.db
      .listActiveGrants(input.chatId)
      .flatMap((activeGrant) =>
        activeGrant.participantId && isCanonicalActorId(activeGrant.participantId)
          ? [activeGrant.participantId as MessageActorId]
          : [],
      );
    const channel = this.db.deleteChannel(
      input.chatId,
      grant.participantId
        ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId)
        : false,
    );
    for (const focused of this.focusedChatIdsByActor.values()) {
      focused.delete(input.chatId);
    }
    this.bumpVersion();
    this.bumpUnreadVersions(affectedActorIds);
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "deleted",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      actorId: grant.participantId as MessageActorId | undefined,
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
        participantId: grant.participantId as MessageActorId | undefined,
      }),
    );
  }

  listChannelGrantsAuthorized(
    input: MessageAuthorizedReadInput & { superadminActorId?: MessageActorId },
  ): MessageChannelGrantRecord[] {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    return this.db.listActiveGrants(input.chatId).filter((grant) => !this.isTrustedBootstrapGrant(grant));
  }

  issueChannelGrantAuthorized(
    input: MessageAuthorizedReadInput & MessageIssueGrantInput & { superadminActorId?: MessageActorId },
  ): MessageIssuedGrant {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    if (!input.participantId || !isCanonicalActorId(input.participantId)) {
      throw new Error("room grant participantId must be a principal id or auth:/session:/system: actor id");
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
    this.db.initializeActorRoomState(input.chatId, input.participantId as MessageActorId);
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "grant-issued",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      actorId: input.participantId as MessageActorId,
    });
    return {
      ...grant,
      ...this.createProjection({
        chatId: input.chatId,
        accessRole: grant.role,
        accessToken,
        participantId: grant.participantId as MessageActorId | undefined,
      }),
    };
  }

  revokeChannelGrantAuthorized(
    input: MessageAuthorizedReadInput & { grantId: string; superadminActorId?: MessageActorId },
  ): { ok: boolean } {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    const revokedGrant = this.db.getGrantById(input.chatId, input.grantId);
    const ok = this.db.revokeGrant(input.chatId, input.grantId);
    if (ok) {
      if (revokedGrant?.participantId && isCanonicalActorId(revokedGrant.participantId)) {
        const stillGranted = this.db
          .listActiveGrants(input.chatId)
          .some((grant) => grant.participantId === revokedGrant.participantId && grant.grantId !== input.grantId);
        if (!stillGranted) {
          const cleared = this.db.clearActorRoomState(input.chatId, revokedGrant.participantId as MessageActorId);
          if (cleared.changed) {
            this.bumpUnreadVersion(revokedGrant.participantId as MessageActorId);
          }
        }
      }
      this.bumpVersion();
      this.emitChannelChanged({
        chatId: input.chatId,
        reason: "grant-revoked",
        builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      });
    }
    return { ok };
  }

  inviteSeatAuthorized(input: MessageInviteSeatInput): MessageInvitationRecord {
    const inviter = this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    if (!isPrincipalId(input.participantId)) {
      throw new Error("room managed seat participantId must be a principal id");
    }
    const invitationId = createManagedInvitationId();
    const previous = this.db.findLatestInvitationForParticipant({
      chatId: input.chatId,
      inviteeActorId: input.participantId,
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
      inviterActorId: this.resolveManagedSeatInviterPrincipalId(inviter.participantId, input.superadminActorId),
      inviteeActorId: input.participantId,
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
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "grant-issued",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      actorId: input.participantId,
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
    const access = this.activateManagedSeatPayload(invitation.resourceId, invitation.inviteePrincipalId, invitation.payload);
    const accepted = this.db.updateInvitationStatus(invitation.resourceId, invitation.invitationId, {
      status: "accepted",
      acceptedAt: Date.now(),
    });
    this.syncAdminAssignments();
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: invitation.resourceId,
      reason: "grant-issued",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(invitation.resourceId)?.metadata),
      actorId: invitation.inviteePrincipalId,
    });
    return {
      invitation: accepted,
      access,
      seat: this.listSeatStateProjections(invitation.resourceId).find((seat) => seat.actorId === invitation.inviteePrincipalId),
    };
  }

  configSeatAuthorized(input: MessageConfigSeatInput): MessageInvitationRecord | MessageChannelAccessProjection {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    const existing = this.db.listActiveGrants(input.chatId).find((grant) => grant.participantId === input.participantId);
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
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
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
    const cleared = this.db.clearActorRoomState(input.chatId, input.participantId);
    if (cleared.changed) {
      this.bumpUnreadVersion(input.participantId);
    }
    this.syncAdminAssignments();
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "grant-revoked",
      builtIn: this.isBuiltInChannelMetadata(this.db.getChannel(input.chatId)?.metadata),
      actorId: input.participantId,
    });
    return { ok: true };
  }

  listSourceSubscriptions(ownerActorId: MessageActorId): MessageSourceSubscriptionRecord[] {
    this.assertActorId(ownerActorId);
    return this.db.listSourceSubscriptions(ownerActorId);
  }

  getSourceSubscription(ownerActorId: MessageActorId, sourceId: string): MessageSourceSubscriptionRecord | undefined {
    this.assertActorId(ownerActorId);
    return this.db.getSourceSubscription(ownerActorId, sourceId);
  }

  upsertSourceSubscription(input: {
    ownerActorId: MessageActorId;
  } & MessageSourceSubscriptionInput): MessageSourceSubscriptionRecord {
    this.assertActorId(input.ownerActorId);
    return this.db.upsertSourceSubscription(input.ownerActorId, input);
  }

  deleteSourceSubscription(input: { ownerActorId: MessageActorId; sourceId: string }): { ok: boolean } {
    this.assertActorId(input.ownerActorId);
    return {
      ok: this.db.deleteSourceSubscription(input.ownerActorId, input.sourceId),
    };
  }

  listContacts(ownerActorId: MessageActorId): MessageContactRecord[] {
    this.assertActorId(ownerActorId);
    return this.db.listContacts(ownerActorId);
  }

  getContact(
    ownerActorId: MessageActorId,
    sourceId: string,
    remoteActorId: MessageActorId,
  ): MessageContactRecord | undefined {
    this.assertActorId(ownerActorId);
    this.assertActorId(remoteActorId);
    return this.db.getContact(ownerActorId, sourceId, remoteActorId);
  }

  upsertContact(input: { ownerActorId: MessageActorId } & MessageContactUpsertInput): MessageContactRecord {
    this.assertActorId(input.ownerActorId);
    this.assertActorId(input.remoteActorId);
    return this.db.upsertContact(input.ownerActorId, input);
  }

  createContactRequest(input: {
    ownerActorId: MessageActorId;
  } & MessageContactRequestCreateInput): MessageContactRequestRecord {
    this.assertActorId(input.ownerActorId);
    this.assertActorId(input.remoteActorId);
    if (input.direction === "outbound" && !this.db.getSourceSubscription(input.ownerActorId, input.sourceId)) {
      throw new Error(`unknown message source subscription: ${input.sourceId}`);
    }
    const currentPending = this.db.findPendingContactRequests({
      ownerActorId: input.ownerActorId,
      direction: input.direction,
      sourceId: input.sourceId,
      remoteActorId: input.remoteActorId,
    });
    const created = this.db.createContactRequest(input.ownerActorId, input);
    for (const pending of currentPending) {
      if (pending.requestId === created.requestId) {
        continue;
      }
      this.db.updateContactRequestState({
        ownerActorId: input.ownerActorId,
        requestId: pending.requestId,
        state: "superseded",
        respondedAt: Date.now(),
        supersededByRequestId: created.requestId,
      });
    }
    return created;
  }

  listContactRequests(
    ownerActorId: MessageActorId,
    input: {
      direction?: MessageContactRequestDirection;
      state?: MessageContactRequestState;
    } = {},
  ): MessageContactRequestRecord[] {
    this.assertActorId(ownerActorId);
    return this.db.listContactRequests(ownerActorId, input).map((request) => this.expireContactRequestIfNeeded(request));
  }

  getContactRequest(ownerActorId: MessageActorId, requestId: string): MessageContactRequestRecord | undefined {
    this.assertActorId(ownerActorId);
    const current = this.db.getContactRequest(ownerActorId, requestId);
    return current ? this.expireContactRequestIfNeeded(current) : undefined;
  }

  acceptContactRequest(input: {
    ownerActorId: MessageActorId;
    requestId: string;
    label?: string;
    subtitle?: string;
    iconUrl?: string;
    localDirectChatId?: string;
    remoteDirectChatId?: string;
    metadata?: Record<string, unknown>;
  }): { request: MessageContactRequestRecord; contact: MessageContactRecord } {
    this.assertActorId(input.ownerActorId);
    const request = this.requirePendingContactRequest(input.ownerActorId, input.requestId);
    const accepted = this.db.updateContactRequestState({
      ownerActorId: input.ownerActorId,
      requestId: input.requestId,
      state: "accepted",
      respondedAt: Date.now(),
    });
    const contact = this.db.upsertContact(input.ownerActorId, {
      sourceId: request.sourceId,
      remoteActorId: request.remoteActorId,
      label: input.label?.trim() || request.remoteLabel || request.remoteActorId,
      subtitle: input.subtitle ?? request.remoteSubtitle,
      iconUrl: input.iconUrl ?? request.remoteIconUrl,
      localDirectChatId: input.localDirectChatId,
      remoteDirectChatId: input.remoteDirectChatId,
      metadata: input.metadata,
    });
    return { request: accepted, contact };
  }

  rejectContactRequest(input: { ownerActorId: MessageActorId; requestId: string }): MessageContactRequestRecord {
    this.assertActorId(input.ownerActorId);
    this.requirePendingContactRequest(input.ownerActorId, input.requestId);
    return this.db.updateContactRequestState({
      ownerActorId: input.ownerActorId,
      requestId: input.requestId,
      state: "rejected",
      respondedAt: Date.now(),
    });
  }

  revokeContactRequest(input: { ownerActorId: MessageActorId; requestId: string }): MessageContactRequestRecord {
    this.assertActorId(input.ownerActorId);
    this.requirePendingContactRequest(input.ownerActorId, input.requestId);
    return this.db.updateContactRequestState({
      ownerActorId: input.ownerActorId,
      requestId: input.requestId,
      state: "revoked",
      respondedAt: Date.now(),
    });
  }

  getHeadVersion(): string {
    return String(this.headVersion);
  }

  getActorUnreadState(actorId: MessageActorId): MessageActorStateRecord {
    this.assertActorId(actorId);
    return this.db.getActorState(actorId) ?? this.db.touchActorState(actorId);
  }

  listUnreadRoomSummaries(actorId: MessageActorId, input: { limit?: number } = {}): MessageUnreadRoomSummary[] {
    this.assertActorId(actorId);
    return this.db.listUnreadRoomSummaries(actorId, input.limit);
  }

  getUnreadVersion(actorId: MessageActorId): string {
    return String(this.unreadVersionByActor.get(actorId) ?? 0);
  }

  waitUnreadCommitted(input: {
    actorId: MessageActorId;
    fromVersion?: string | null;
  }): CommitWaitHandle<{ actorId: MessageActorId; version: string }> {
    this.assertActorId(input.actorId);
    const afterVersion = parseVersion(input.fromVersion);
    const currentVersion = this.unreadVersionByActor.get(input.actorId) ?? 0;
    if (currentVersion > afterVersion) {
      return {
        promise: Promise.resolve({
          actorId: input.actorId,
          version: this.getUnreadVersion(input.actorId),
        }),
        reject: () => {},
      };
    }

    let resolveRef: ((value: { actorId: MessageActorId; version: string }) => void) | null = null;
    let rejectRef: ((reason: unknown) => void) | null = null;
    const waiter: UnreadWaiter = {
      actorId: input.actorId,
      afterVersion,
      resolve: (value) => resolveRef?.(value),
      reject: (reason) => rejectRef?.(reason),
      active: true,
    };
    const promise = new Promise<{ actorId: MessageActorId; version: string }>((resolve, reject) => {
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
            actorId: grant.participantId ?? null,
            accessRole: grant.role,
            accessToken,
            cleanup: [],
          },
        });
        return upgraded ? undefined : new Response("upgrade failed", { status: 500 });
      },
      websocket: {
        open: (socket) => {
          const { chatId, accessRole, accessToken, actorId } = socket.data;
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
              socket.send(
                JSON.stringify({
                  type: "messages",
                  chatId,
                  items: [message],
                  headVersion: this.getHeadVersion(),
                } satisfies MessageTransportServerMessage),
              );
            }),
          );
          cleanup.push(
            this.onFocus(({ actorId: changedActorId, chatIds }) => {
              if (actorId && changedActorId !== actorId) {
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
            participantId: grant.participantId as MessageActorId | undefined,
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
      participantId: grant.participantId as MessageActorId | undefined,
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

  private isTrustedBootstrapActor(actorId: MessageActorId): boolean {
    return actorId === TRUSTED_BOOTSTRAP_PARTICIPANT_ID;
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
    participantId?: MessageActorId;
  }): MessageChannelAccessProjection {
    return {
      accessRole: input.accessRole,
      accessToken: input.accessToken,
      participantId: input.participantId,
      currentAdmin: input.participantId ? this.resolveCurrentAdminActorId(input.chatId) === input.participantId : false,
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
    const currentAdminId = this.resolveCurrentAdminActorId(chatId);
    const focusedByActor = new Map<string, boolean>();
    for (const [actorId, focusedIds] of this.focusedChatIdsByActor.entries()) {
      if (focusedIds.has(chatId)) {
        focusedByActor.set(actorId, true);
      }
    }
    const entries = this.db
      .listActiveGrants(chatId)
      .filter((grant): grant is MessageChannelGrantRecord & { participantId: MessageActorId } => {
        return Boolean(grant.participantId) && !this.isTrustedBootstrapGrant(grant);
      })
      .map((grant) => {
        const presence = this.actorPresence.get(grant.participantId);
        return {
          actorId: grant.participantId,
          role: grant.role,
          label: grant.label,
          currentAdmin: currentAdminId === grant.participantId,
          online: presence?.online ?? false,
          focused: focusedByActor.get(grant.participantId) ?? false,
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
      return left.actorId.localeCompare(right.actorId);
    });
  }

  private createInitialReadMembership(
    chatId: string,
    senderActorId?: MessageActorId,
  ): { readActorIds: MessageActorId[]; unreadActorIds: MessageActorId[] } {
    const participantActorIds = this.db
      .listActiveGrants(chatId)
      .filter((grant): grant is MessageChannelGrantRecord & { participantId: MessageActorId } => {
        return Boolean(grant.participantId) && !this.isTrustedBootstrapGrant(grant);
      })
      .map((grant) => grant.participantId);
    const readActorIds = senderActorId && participantActorIds.includes(senderActorId) ? [senderActorId] : [];
    return {
      readActorIds,
      unreadActorIds: participantActorIds.filter((actorId) => !readActorIds.includes(actorId)),
    };
  }

  private repairChannelParticipants(
    participants: MessageParticipant[],
    actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
  ): MessageParticipant[] {
    return (
      normalizeChannelParticipants(
        participants.map((participant) => ({
          ...participant,
          id:
            remapActorId(
              isCanonicalActorId(participant.id) ? (participant.id as MessageActorId) : undefined,
              actorIdMap,
            ) ?? participant.id,
        })),
      ) ?? []
    );
  }

  private repairChannelMetadata(
    metadata: Record<string, unknown> | undefined,
    actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
  ): Record<string, unknown> {
    const candidateIds = remapActorIds(this.readAdminGroupCandidateIds(metadata), actorIdMap);
    const pendingAdminWork = this.readPendingAdminWork(metadata).map((item) => ({
      ...item,
      requestedBy: remapActorId(item.requestedBy, actorIdMap) ?? item.requestedBy,
      assignedAdminId: remapActorId(item.assignedAdminId, actorIdMap),
    }));
    return {
      ...(metadata ?? {}),
      [ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY]: candidateIds,
      [ROOM_PENDING_ADMIN_WORK_KEY]: pendingAdminWork,
    };
  }

  private repairActiveGrantsForActorAliases(
    chatId: string,
    actorIdMap: ReadonlyMap<MessageActorId, MessageActorId>,
  ): boolean {
    if (actorIdMap.size === 0) {
      return false;
    }
    const activeGrants = this.db.listActiveGrants(chatId);
    const sourceActorIds = new Set<MessageActorId>(
      [...actorIdMap.keys()].filter((actorId) =>
        activeGrants.some((grant) => grant.participantId === actorId && !this.isTrustedBootstrapGrant(grant)),
      ),
    );
    if (sourceActorIds.size === 0) {
      return false;
    }
    const targetActorIds = new Set<MessageActorId>(
      [...sourceActorIds].map((actorId) => actorIdMap.get(actorId)!).filter(Boolean),
    );
    const grouped = new Map<MessageActorId, MessageChannelGrantRecord[]>();
    for (const grant of activeGrants) {
      if (!grant.participantId || this.isTrustedBootstrapGrant(grant)) {
        continue;
      }
      if (!sourceActorIds.has(grant.participantId) && !targetActorIds.has(grant.participantId)) {
        continue;
      }
      const participantId = actorIdMap.get(grant.participantId) ?? grant.participantId;
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
  ): MessageChannelGrantRecord {
    const channel = this.db.getChannel(chatId);
    if (!channel || channel.archivedAt) {
      throw new Error("message channel access denied");
    }
    if (!ACCESS_TOKEN_PATTERN.test(accessToken)) {
      throw new Error("message room credential-invalid");
    }
    const grant = this.db.findActiveGrantByToken(chatId, accessToken, hashToken(accessToken));
    if (!grant) {
      throw new Error("message room credential-invalid");
    }
    if (grant.participantId && isCanonicalActorId(grant.participantId)) {
      this.touchActorPresence(grant.participantId as MessageActorId);
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
    input: Pick<MessageAppendInput, "senderActorId" | "from">,
  ): { senderActorId?: MessageActorId; from: string } {
    const senderActorId =
      input.senderActorId ??
      (grant.participantId && isCanonicalActorId(grant.participantId) ? grant.participantId : undefined);
    const channel = this.db.getChannel(chatId);
    const participantLabel = senderActorId
      ? channel?.participants.find((participant) => participant.id === senderActorId)?.label?.trim()
      : undefined;
    const from =
      participantLabel ||
      grant.label?.trim() ||
      input.from?.trim() ||
      (senderActorId ? fallbackActorLabel(senderActorId) : "User");
    return { senderActorId, from };
  }

  private requireAdministrativeGrant(
    chatId: string,
    accessToken?: string,
    superadminActorId?: MessageActorId,
  ): MessageChannelGrantRecord {
    if (superadminActorId) {
      this.assertActorId(superadminActorId);
      this.touchActorPresence(superadminActorId);
      return {
        grantId: `superadmin:${superadminActorId}`,
        chatId,
        role: "admin",
        participantId: superadminActorId,
        accessToken: "",
        createdAt: Date.now(),
      };
    }
    if (!accessToken) {
      throw new Error("message channel admin access required");
    }
    const grant = this.requireAccess(chatId, accessToken, "admin");
    const currentAdminId = this.resolveCurrentAdminActorId(chatId);
    if (currentAdminId && grant.participantId !== currentAdminId) {
      throw new Error("message room current-admin required");
    }
    return grant;
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

  private assertActorId(actorId: string): void {
    if (!isCanonicalActorId(actorId)) {
      throw new Error(`invalid actor id: ${actorId}`);
    }
  }

  private expireContactRequestIfNeeded(request: MessageContactRequestRecord): MessageContactRequestRecord {
    if (request.state !== "pending" || !request.expiresAt || request.expiresAt > Date.now()) {
      return request;
    }
    return this.db.updateContactRequestState({
      ownerActorId: request.ownerActorId,
      requestId: request.requestId,
      state: "expired",
      respondedAt: request.expiresAt,
    });
  }

  private requirePendingContactRequest(
    ownerActorId: MessageActorId,
    requestId: string,
  ): MessageContactRequestRecord {
    const current = this.db.getContactRequest(ownerActorId, requestId);
    if (!current) {
      throw new Error(`unknown contact request: ${requestId}`);
    }
    const next = this.expireContactRequestIfNeeded(current);
    if (next.state !== "pending") {
      throw new Error(`contact request is not pending: ${requestId}`);
    }
    return next;
  }

  private getFocusedChatIdsForActor(actorId: string): Set<string> {
    let focused = this.focusedChatIdsByActor.get(actorId);
    if (!focused) {
      focused = new Set<string>();
      this.focusedChatIdsByActor.set(actorId, focused);
    }
    return focused;
  }

  private touchActorPresence(actorId: MessageActorId): void {
    const now = Date.now();
    const current = this.actorPresence.get(actorId);
    this.actorPresence.set(actorId, {
      online: true,
      expiresAt: actorId.startsWith("auth:") ? now + TRANSIENT_ACTOR_PRESENCE_TTL_MS : (current?.expiresAt ?? null),
      invalidCredential: current?.invalidCredential ?? false,
    });
    this.db.touchActorState(actorId, {
      lastActiveAt: now,
      lastLoginAt: current?.online ? undefined : now,
      online: true,
    });
    this.syncAdminAssignments();
    if (!current?.online) {
      this.emitPresenceChanged(actorId);
    }
  }

  private ensureActorAccess(
    chatId: string,
    actorId: MessageActorId,
    role: MessageChannelAccessRole,
    preferredToken?: string,
    label?: string,
  ): MessageChannelAccessProjection {
    this.assertActorId(actorId);
    if (!this.isTrustedBootstrapActor(actorId)) {
      this.db.initializeActorRoomState(chatId, actorId);
    }
    const existing = this.db.findReusableGrant({ chatId, role, participantId: actorId });
    if (existing?.accessToken) {
      if ((existing.label ?? undefined) !== label) {
        this.db.updateGrant(chatId, existing.grantId, {
          role: existing.role,
          participantId: actorId,
          label,
        });
      }
      return this.createProjection({
        chatId,
        accessRole: existing.role,
        accessToken: existing.accessToken,
        participantId: actorId,
      });
    }
    const accessToken = this.resolveGrantAccessToken(preferredToken);
    this.db.revokeActiveGrantsByParticipant(chatId, actorId);
    const grant = this.db.issueGrant({
      chatId,
      role,
      label,
      participantId: actorId,
      accessToken,
      tokenHash: hashToken(accessToken),
    });
    return this.createProjection({
      chatId,
      accessRole: grant.role,
      accessToken,
      participantId: actorId,
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
    actorId: MessageActorId,
    payload: MessageManagedSeatPayload,
  ): MessageChannelAccessProjection {
    const access = this.ensureActorAccess(chatId, actorId, payload.role, undefined, payload.label);
    const channel = this.db.getChannel(chatId);
    if (channel && payload.role === "admin") {
      const currentCandidates = this.readAdminGroupCandidateIds(channel.metadata);
      if (!currentCandidates.includes(actorId)) {
        this.db.updateChannel(
          chatId,
          {
            metadata: this.withAdminState(chatId, {
              ...(channel.metadata ?? {}),
              [ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY]: [...currentCandidates, actorId],
            }),
          },
          false,
        );
      }
    }
    return access;
  }

  private resolveManagedSeatInviterPrincipalId(
    actorId: string | undefined,
    superadminActorId?: MessageActorId,
  ): MessageInvitationRecord["inviterPrincipalId"] {
    const candidate = (actorId ?? superadminActorId)?.trim();
    if (!candidate || !isPrincipalId(candidate)) {
      throw new Error("room managed invitation inviter must resolve to a principal id");
    }
    return candidate;
  }

  private issueActorAccessToken(chatId: string, actorId: MessageActorId, role: MessageChannelAccessRole): string {
    return this.ensureActorAccess(chatId, actorId, role).accessToken;
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
    const currentAdminId = this.resolveCurrentAdminActorId(chatId, metadata);
    const pendingAdminWork = this.reassignPendingAdminWork(chatId, metadata, currentAdminId);
    return {
      ...(metadata ?? {}),
      [ROOM_CURRENT_ADMIN_ID_KEY]: currentAdminId,
      [ROOM_PENDING_ADMIN_WORK_KEY]: pendingAdminWork,
    };
  }

  private resolveCurrentAdminActorId(chatId: string, metadata?: Record<string, unknown>): MessageActorId | null {
    const channel = metadata ? { metadata } : this.db.getChannel(chatId);
    const candidateIds = this.readAdminGroupCandidateIds(channel?.metadata);
    if (candidateIds.length === 0) {
      return null;
    }
    this.pruneExpiredPresence();
    for (const actorId of candidateIds) {
      const presence = this.actorPresence.get(actorId);
      if (presence?.online) {
        return actorId;
      }
    }
    return null;
  }

  private readAdminGroupCandidateIds(metadata: Record<string, unknown> | undefined): MessageActorId[] {
    const candidates = metadata?.[ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY];
    if (!Array.isArray(candidates)) {
      return [];
    }
    return candidates
      .filter((value): value is string => typeof value === "string" && isCanonicalActorId(value))
      .map((value) => value as MessageActorId);
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
    currentAdminId: MessageActorId | null,
  ): MessageAdminWorkItem[] {
    return this.readPendingAdminWork(metadata).map((item) => ({
      ...item,
      assignedAdminId: currentAdminId ?? undefined,
    }));
  }

  queueAdminWork(input: {
    chatId: string;
    requestedBy: MessageActorId;
    kind: MessageAdminWorkItem["kind"];
    payload?: Record<string, unknown>;
  }): MessageAdminWorkItem {
    const channel = this.db.getChannel(input.chatId);
    if (!channel) {
      throw new Error(`unknown room: ${input.chatId}`);
    }
    const metadata = channel.metadata ?? {};
    const currentAdminId = this.resolveCurrentAdminActorId(input.chatId, metadata);
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
    this.bumpVersion();
    this.emitChannelChanged({
      chatId: input.chatId,
      reason: "updated",
      builtIn: this.isBuiltInChannelMetadata(channel.metadata),
      actorId: input.requestedBy,
    });
    return item;
  }

  listPendingAdminWork(chatId: string): MessageAdminWorkItem[] {
    const channel = this.db.getChannel(chatId);
    return this.readPendingAdminWork(channel?.metadata);
  }

  private pruneExpiredPresence(): void {
    const now = Date.now();
    for (const [actorId, presence] of [...this.actorPresence.entries()]) {
      if (presence.expiresAt !== null && presence.expiresAt <= now) {
        this.actorPresence.delete(actorId);
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
        this.emitChannelChanged({
          chatId: channel.chatId,
          reason: "presence",
          builtIn: channel.builtIn,
        });
      }
    }
  }

  private bumpUnreadVersions(...actorGroups: ReadonlyArray<readonly MessageActorId[]>): void {
    const uniqueActorIds = new Set<MessageActorId>();
    for (const actorIds of actorGroups) {
      for (const actorId of actorIds) {
        if (isCanonicalActorId(actorId) && !this.isTrustedBootstrapActor(actorId)) {
          uniqueActorIds.add(actorId);
        }
      }
    }
    for (const actorId of uniqueActorIds) {
      this.bumpUnreadVersion(actorId);
    }
  }

  private bumpUnreadVersion(actorId: MessageActorId): void {
    const nextVersion = (this.unreadVersionByActor.get(actorId) ?? 0) + 1;
    this.unreadVersionByActor.set(actorId, nextVersion);
    for (const waiter of [...this.unreadWaiters]) {
      if (!waiter.active || waiter.actorId !== actorId || nextVersion <= waiter.afterVersion) {
        continue;
      }
      waiter.active = false;
      this.unreadWaiters.delete(waiter);
      waiter.resolve({
        actorId,
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
