import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import { MessageDb } from "./message-db";
import type {
  CommitWaitHandle,
  MessageActorId,
  MessageAdminWorkItem,
  MessageAppendInput,
  MessageAuthorizedMarkReadInput,
  MessageAuthorizedEditInput,
  MessageAuthorizedPageInput,
  MessageAuthorizedReadInput,
  MessageAuthorizedWriteInput,
  MessageChannelAccessProjection,
  MessageChannelAccessRole,
  MessageChannelGrantRecord,
  MessageChannelPatchInput,
  MessageControlPlaneConfig,
  MessageControlPlaneConfigPatch,
  MessageControlPlaneEntry,
  MessageCreateInput,
  MessageParticipant,
  MessageFocusOp,
  MessageIssueGrantInput,
  MessageIssuedGrant,
  MessageReadProgressProjection,
  MessageReadStateProjection,
  MessageRecord,
  MessageSnapshot,
  MessageTransportClientMessage,
  MessageTransportConfig,
  MessageTransportEndpoint,
  MessageTransportServerMessage,
  ReversePage,
  ReverseTimeCursor,
} from "./types";

interface Waiter {
  afterVersion: number;
  resolve: (value: { version: string }) => void;
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

const TRUSTED_BOOTSTRAP_LABEL = "Trusted bootstrap";
const TRUSTED_BOOTSTRAP_PARTICIPANT_ID: MessageActorId = "system:trusted-bootstrap";
const ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY = "roomAdminGroupCandidateIds";
const ROOM_CURRENT_ADMIN_ID_KEY = "currentRoomAdminId";
const ROOM_PENDING_ADMIN_WORK_KEY = "pendingAdminWork";
const TRANSIENT_ACTOR_PRESENCE_TTL_MS = 90_000;

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
const ACTOR_ID_PATTERN = /^(auth|session|system):.+$/;

const isCanonicalActorId = (value: string): value is MessageActorId =>
  ACTOR_ID_PATTERN.test(value) &&
  (value.startsWith("auth:") || value.startsWith("session:") || value.startsWith("system:"));

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
  private readonly focusListeners = new Set<(payload: { actorId: string; chatIds: string[] }) => void>();
  private readonly waiters = new Set<Waiter>();
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
    this.db = new MessageDb(options.dbPath ?? join(homedir(), ".agenter", ".message", "message.db"));
  }

  close(): void {
    this.stopTransport();
    this.trustedBootstrapTokens.clear();
    this.db.close();
  }

  onMessage(listener: (payload: { chatId: string; message: MessageRecord }) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onFocus(listener: (payload: { actorId: string; chatIds: string[] }) => void): () => void {
    this.focusListeners.add(listener);
    return () => this.focusListeners.delete(listener);
  }

  setActorPresence(actorId: MessageActorId, input: { online: boolean; ttlMs?: number } | boolean): void {
    this.assertActorId(actorId);
    const online = typeof input === "boolean" ? input : input.online;
    if (!online) {
      this.actorPresence.delete(actorId);
      this.syncAdminAssignments();
      return;
    }
    const ttlMs = typeof input === "boolean" ? undefined : input.ttlMs;
    const current = this.actorPresence.get(actorId);
    this.actorPresence.set(actorId, {
      online: true,
      expiresAt: typeof ttlMs === "number" && ttlMs > 0 ? Date.now() + ttlMs : null,
      invalidCredential: current?.invalidCredential ?? false,
    });
    this.syncAdminAssignments();
  }

  setCredentialState(actorId: MessageActorId, input: { invalidCredential: boolean }): void {
    this.assertActorId(actorId);
    const current = this.actorPresence.get(actorId);
    this.actorPresence.set(actorId, {
      online: current?.online ?? false,
      expiresAt: current?.expiresAt ?? null,
      invalidCredential: input.invalidCredential,
    });
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
    const channel = this.db.getChannel(chatId, this.getFocusedChatIdsForActor(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(chatId));
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

  getMessage(chatId: string, messageId: string): MessageRecord | undefined {
    return this.db.getMessage(chatId, messageId);
  }

  createChannel(input: MessageCreateInput): MessageControlPlaneEntry {
    if (!input.chatId.startsWith("room-")) {
      throw new Error(`invalid room id prefix: ${input.chatId}`);
    }
    const participants = normalizeChannelParticipants(input.participants);
    const channel = this.db.createChannel(
      {
        ...input,
        kind: "room",
        owner: input.owner ?? this.config.defaultOwner,
        participants,
      },
      this.getFocusedChatIdsForActor(input.bootstrapActorId ?? TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(input.chatId),
    );
    if (input.bootstrapActorId) {
      const projection = this.ensureActorAccess(input.chatId, input.bootstrapActorId, "admin", input.adminToken);
      this.focusForActor(input.bootstrapActorId, "add", [input.chatId]);
      return this.withProjection(
        {
          ...channel,
          focused: true,
          metadata: this.withAdminState(channel.chatId, channel.metadata),
        },
        projection,
      );
    }
    return this.withProjection(
      {
        ...channel,
        metadata: this.withAdminState(channel.chatId, channel.metadata),
      },
      this.issueTrustedBootstrapAccess(input.chatId, input.adminToken),
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
    const current = new Set(this.getFocusedChatIdsForActor(actorId));
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
    const payload = { actorId, chatIds: [...current] };
    for (const listener of this.focusListeners) {
      listener(payload);
    }
    return payload.chatIds;
  }

  focusAuthorized(op: MessageFocusOp, access: Array<{ chatId: string; accessToken: string }>): string[] {
    const grants = access.map(({ chatId, accessToken }) => this.requireAccess(chatId, accessToken, "member"));
    const actorId = grants[0]?.participantId;
    if (!actorId || !ACTOR_ID_PATTERN.test(actorId)) {
      return this.focus(op, grants.map((grant) => grant.chatId));
    }
    const allowedChatIds = grants.map((grant) => grant.chatId).filter((chatId, index, items) => items.indexOf(chatId) === index);
    return this.focusForActor(actorId as MessageActorId, op, allowedChatIds);
  }

  getFocusedChatIds(actorId: MessageActorId = TRUSTED_BOOTSTRAP_PARTICIPANT_ID): string[] {
    return [...this.getFocusedChatIdsForActor(actorId)];
  }

  send(input: MessageAppendInput): MessageRecord {
    const createdAt = input.createdAt ?? Date.now();
    const attentionState = input.attentionState ?? "loaded";
    const visibleAt = input.visibleAt ?? createdAt;
    const message = this.db.appendMessage({
      ...input,
      createdAt,
      attentionState,
      visibleAt,
      attentionLoadedAt: input.attentionLoadedAt ?? (attentionState === "loaded" ? visibleAt : undefined),
    });
    this.bumpVersion();
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
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
    this.requireAccess(input.chatId, input.accessToken, "member");
    const createdAt = input.createdAt ?? Date.now();
    const attentionState = input.attentionState ?? (input.kind && input.kind !== "text" ? "loaded" : "queued");
    const visibleAt = input.visibleAt ?? createdAt;
    return this.send({
      chatId: input.chatId,
      messageId: input.messageId,
      rootId: input.rootId,
      from: input.from,
      to: input.to,
      kind: input.kind,
      content: input.content,
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
      attentionState,
      visibleAt,
      attentionLoadedAt: input.attentionLoadedAt ?? (attentionState === "loaded" ? visibleAt : undefined),
      metadata: input.metadata,
      attachments: input.attachments,
      payload: input.payload,
    });
  }

  editAuthorized(input: MessageAuthorizedEditInput): MessageRecord {
    this.requireAccess(input.chatId, input.accessToken, "member");
    const message = this.db.editQueuedMessage(input);
    this.bumpVersion();
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    return message;
  }

  markMessageAttentionLoaded(input: { chatId: string; messageId: string; loadedAt?: number }): MessageRecord {
    const message = this.db.markMessageAttentionLoaded(input);
    this.bumpVersion();
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    return message;
  }

  sendErrorAuthorized(
    input: MessageAuthorizedWriteInput & {
      payload: NonNullable<MessageAuthorizedWriteInput["payload"]> & {
        error: NonNullable<NonNullable<MessageAuthorizedWriteInput["payload"]>["error"]>;
      };
    },
  ): MessageRecord {
    this.requireAccess(input.chatId, input.accessToken, "admin");
    return this.send({
      chatId: input.chatId,
      messageId: input.messageId,
      rootId: input.rootId,
      from: input.from,
      to: input.to,
      kind: "error",
      content: input.content,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      attentionState: "loaded",
      visibleAt: input.visibleAt ?? input.createdAt ?? Date.now(),
      attentionLoadedAt: input.attentionLoadedAt ?? input.createdAt ?? Date.now(),
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
    this.requireAccess(input.chatId, input.accessToken, "member");
    return this.send({
      chatId: input.chatId,
      messageId: input.messageId,
      rootId: input.rootId,
      from: input.from,
      to: input.to,
      kind: "interactive",
      content: input.content,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      attentionState: "loaded",
      visibleAt: input.visibleAt ?? input.createdAt ?? Date.now(),
      attentionLoadedAt: input.attentionLoadedAt ?? input.createdAt ?? Date.now(),
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

  queryMessages(input: { chatId: string; before?: ReverseTimeCursor | null; limit?: number }): ReversePage<MessageRecord> {
    return this.db.pageMessages(input.chatId, { before: input.before, limit: input.limit });
  }

  queryMessagesAuthorized(input: MessageAuthorizedPageInput): ReversePage<MessageRecord> {
    this.requireAccess(input.chatId, input.accessToken, "readonly");
    return this.queryMessages({ chatId: input.chatId, before: input.before, limit: input.limit });
  }

  markChannelReadAuthorized(input: MessageAuthorizedMarkReadInput): MessageControlPlaneEntry {
    const grant = this.requireAccess(input.chatId, input.accessToken, "readonly");
    const channel = this.db.getChannel(
      input.chatId,
      grant.participantId ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId) : false,
    );
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }

    if (!grant.participantId || !ACTOR_ID_PATTERN.test(grant.participantId) || this.isTrustedBootstrapGrant(grant)) {
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

    const target = input.messageId ? this.db.getMessage(input.chatId, input.messageId) : this.db.resolveLatestVisibleMessage(input.chatId);
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
    const result = this.db.markReadState({
      chatId: input.chatId,
      actorId: grant.participantId as MessageActorId,
      readMessageId: target.messageId,
      readMessageRowId: target.rowId,
      readAt: input.readAt ?? Date.now(),
    });
    if (result.changed) {
      this.bumpVersion();
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
    const snapshot = this.db.snapshot(chatId, this.getFocusedChatIdsForActor(TRUSTED_BOOTSTRAP_PARTICIPANT_ID).has(chatId), limit);
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
      grant.participantId ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId) : false,
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
      grant.participantId ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId) : false,
    );
    this.bumpVersion();
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
      grant.participantId ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId) : false,
    );
    for (const focused of this.focusedChatIdsByActor.values()) {
      focused.delete(input.chatId);
    }
    this.bumpVersion();
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
    const channel = this.db.deleteChannel(
      input.chatId,
      grant.participantId ? this.getFocusedChatIdsForActor(grant.participantId as MessageActorId).has(input.chatId) : false,
    );
    for (const focused of this.focusedChatIdsByActor.values()) {
      focused.delete(input.chatId);
    }
    this.bumpVersion();
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

  listChannelGrantsAuthorized(input: MessageAuthorizedReadInput & { superadminActorId?: MessageActorId }): MessageChannelGrantRecord[] {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    return this.db.listActiveGrants(input.chatId).filter((grant) => !this.isTrustedBootstrapGrant(grant));
  }

  issueChannelGrantAuthorized(input: MessageAuthorizedReadInput & MessageIssueGrantInput & { superadminActorId?: MessageActorId }): MessageIssuedGrant {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    if (!input.participantId || !ACTOR_ID_PATTERN.test(input.participantId)) {
      throw new Error("room grant participantId must be an auth:/session:/system: actor id");
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
    this.bumpVersion();
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

  revokeChannelGrantAuthorized(input: MessageAuthorizedReadInput & { grantId: string; superadminActorId?: MessageActorId }): { ok: boolean } {
    this.requireAdministrativeGrant(input.chatId, input.accessToken, input.superadminActorId);
    const ok = this.db.revokeGrant(input.chatId, input.grantId);
    if (ok) {
      this.bumpVersion();
    }
    return { ok };
  }

  getHeadVersion(): string {
    return String(this.headVersion);
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
    if (!transport?.port) {
      return null;
    }
    const host = transport.host ?? "127.0.0.1";
    const path = `${(transport.pathPrefix ?? "/room").replace(/\/$/, "")}/${encodeURIComponent(chatId)}`;
    const url = new URL(`ws://${host}:${transport.port}${path}`);
    if (accessToken) {
      url.searchParams.set("token", accessToken);
    }
    return {
      host,
      port: transport.port,
      path,
      url: url.toString(),
    };
  }

  async startTransport(input: { host?: string; port?: number; pathPrefix?: string } = {}): Promise<MessageTransportConfig> {
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
            socket.send(JSON.stringify({ type: "error", chatId, message: "invalid transport message" } satisfies MessageTransportServerMessage));
            return;
          }
          try {
            if (message.type === "send") {
              this.sendAuthorized({ chatId, accessToken, ...message.message });
              return;
            }
            if (message.type === "edit") {
              this.editAuthorized({
                chatId,
                accessToken,
                messageId: message.messageId,
                content: message.content,
              });
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

    this.config.transport = {
      host,
      pathPrefix,
      port: this.transportServer.port ?? requestedPort ?? null,
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
    channel: Omit<MessageControlPlaneEntry, keyof MessageChannelAccessProjection | "readProgress" | "readStates">,
    projection: MessageChannelAccessProjection,
  ): MessageControlPlaneEntry {
    const latestVisibleMessage = this.db.resolveLatestVisibleMessage(channel.chatId);
    const readStates = this.listReadStateProjections(channel.chatId, latestVisibleMessage);
    return {
      ...channel,
      ...projection,
      readProgress: this.createReadProgress(channel.chatId, latestVisibleMessage, readStates),
      readStates,
    };
  }

  private listReadStateProjections(chatId: string, latestVisibleMessage?: MessageRecord): MessageReadStateProjection[] {
    const readStateByActorId = new Map(this.db.listReadStates(chatId).map((state) => [state.actorId, state]));
    const currentAdminId = this.resolveCurrentAdminActorId(chatId);
    const focusedByActor = new Map<string, boolean>();
    for (const [actorId, focusedIds] of this.focusedChatIdsByActor.entries()) {
      if (focusedIds.has(chatId)) {
        focusedByActor.set(actorId, true);
      }
    }
    const latestVisibleRowId = latestVisibleMessage?.rowId ?? null;
    const entries = this.db
      .listActiveGrants(chatId)
      .filter((grant): grant is MessageChannelGrantRecord & { participantId: MessageActorId } => {
        return Boolean(grant.participantId) && !this.isTrustedBootstrapGrant(grant);
      })
      .map((grant) => {
        const presence = this.actorPresence.get(grant.participantId);
        const readState = readStateByActorId.get(grant.participantId);
        return {
          actorId: grant.participantId,
          role: grant.role,
          label: grant.label,
          currentAdmin: currentAdminId === grant.participantId,
          online: presence?.online ?? false,
          focused: focusedByActor.get(grant.participantId) ?? false,
          invalidCredential: presence?.invalidCredential ?? false,
          readMessageId: readState?.readMessageId,
          readMessageRowId: readState?.readMessageRowId,
          readAt: readState?.readAt,
          hasReadLatestVisible: latestVisibleRowId !== null && (readState?.readMessageRowId ?? -1) >= latestVisibleRowId,
        } satisfies MessageReadStateProjection;
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

  private createReadProgress(
    chatId: string,
    latestVisibleMessage: MessageRecord | undefined,
    readStates: MessageReadStateProjection[],
  ): MessageReadProgressProjection {
    void chatId;
    if (!latestVisibleMessage) {
      return {
        totalSeatCount: readStates.length,
        readSeatCount: 0,
        unreadSeatCount: 0,
        invalidCredentialSeatCount: readStates.filter((state) => state.invalidCredential).length,
      };
    }
    const readSeatCount = readStates.filter((state) => state.hasReadLatestVisible).length;
    return {
      latestVisibleMessageId: latestVisibleMessage.messageId,
      latestVisibleMessageRowId: latestVisibleMessage.rowId,
      latestVisibleAt: latestVisibleMessage.visibleAt ?? latestVisibleMessage.createdAt,
      totalSeatCount: readStates.length,
      readSeatCount,
      unreadSeatCount: Math.max(0, readStates.length - readSeatCount),
      invalidCredentialSeatCount: readStates.filter((state) => state.invalidCredential).length,
    };
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
    if (grant.participantId && ACTOR_ID_PATTERN.test(grant.participantId)) {
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
    if (!ACTOR_ID_PATTERN.test(actorId)) {
      throw new Error(`invalid actor id: ${actorId}`);
    }
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
    const current = this.actorPresence.get(actorId);
    this.actorPresence.set(actorId, {
      online: true,
      expiresAt: actorId.startsWith("auth:") ? Date.now() + TRANSIENT_ACTOR_PRESENCE_TTL_MS : current?.expiresAt ?? null,
      invalidCredential: current?.invalidCredential ?? false,
    });
    this.syncAdminAssignments();
  }

  private ensureActorAccess(
    chatId: string,
    actorId: MessageActorId,
    role: MessageChannelAccessRole,
    preferredToken?: string,
  ): MessageChannelAccessProjection {
    this.assertActorId(actorId);
    const existing = this.db.findReusableGrant({ chatId, role, participantId: actorId });
    if (existing?.accessToken) {
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

  private issueActorAccessToken(chatId: string, actorId: MessageActorId, role: MessageChannelAccessRole): string {
    return this.ensureActorAccess(chatId, actorId, role).accessToken;
  }

  private normalizeChannelPatch(patch: MessageChannelPatchInput, chatId: string): MessageChannelPatchInput {
    const current = this.db.getChannel(chatId);
    const currentMetadata = current?.metadata ?? {};
    const nextMetadata = {
      ...currentMetadata,
      ...(patch.metadata ?? {}),
      ...(patch.adminGroupCandidateIds ? { [ROOM_ADMIN_GROUP_CANDIDATE_IDS_KEY]: [...patch.adminGroupCandidateIds] } : {}),
    };
    const synced = this.withAdminState(chatId, nextMetadata);
    return {
      title: patch.title,
      participants: normalizeChannelParticipants(patch.participants),
      metadata: synced,
    };
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
      .filter((value): value is string => typeof value === "string" && ACTOR_ID_PATTERN.test(value))
      .map((value) => value as MessageActorId);
  }

  private readPendingAdminWork(metadata: Record<string, unknown> | undefined): MessageAdminWorkItem[] {
    const raw = metadata?.[ROOM_PENDING_ADMIN_WORK_KEY];
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter((value): value is MessageAdminWorkItem => Boolean(value) && typeof value === "object" && "workId" in value);
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
    for (const channel of this.db.listChannels(new Set<string>(), true)) {
      const nextMetadata = this.withAdminState(channel.chatId, channel.metadata);
      if (JSON.stringify(nextMetadata) === JSON.stringify(channel.metadata ?? {})) {
        continue;
      }
      this.db.updateChannel(channel.chatId, { metadata: nextMetadata }, false);
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
