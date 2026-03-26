import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import { MessageDb } from "./message-db";
import type {
  CommitWaitHandle,
  MessageAppendInput,
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
  MessageFocusOp,
  MessageIssueGrantInput,
  MessageIssuedGrant,
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
  accessRole: MessageChannelAccessRole;
  accessToken: string;
  cleanup: Array<() => void>;
}

const TRUSTED_BOOTSTRAP_LABEL = "Trusted bootstrap";
const TRUSTED_BOOTSTRAP_PARTICIPANT_ID = "system:trusted-bootstrap";

const cloneTransport = (input?: MessageTransportConfig): MessageTransportConfig => ({
  host: input?.host ?? "127.0.0.1",
  port: input?.port ?? null,
  pathPrefix: input?.pathPrefix ?? "/chat",
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
  private readonly focusedChatIds = new Set<string>();
  private readonly trustedBootstrapTokens = new Map<string, string>();
  private readonly messageListeners = new Set<(payload: { chatId: string; message: MessageRecord }) => void>();
  private readonly focusListeners = new Set<(payload: { chatIds: string[] }) => void>();
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
    this.db = new MessageDb(options.dbPath ?? join(homedir(), ".agenter", "chat.db"));
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

  onFocus(listener: (payload: { chatIds: string[] }) => void): () => void {
    this.focusListeners.add(listener);
    return () => this.focusListeners.delete(listener);
  }

  listChannels(): MessageControlPlaneEntry[] {
    return this.db.listChannels(this.focusedChatIds).map((channel) => this.withProjection(channel, this.issueTrustedBootstrapAccess(channel.chatId)));
  }

  getChannel(chatId: string): MessageControlPlaneEntry | undefined {
    const channel = this.db.getChannel(chatId, this.focusedChatIds.has(chatId));
    return channel ? this.withProjection(channel, this.issueTrustedBootstrapAccess(chatId)) : undefined;
  }

  createChannel(input: MessageCreateInput): MessageControlPlaneEntry {
    const expectedPrefix = input.kind === "room" ? "room-" : "chat-";
    if (!input.chatId.startsWith(expectedPrefix)) {
      throw new Error(`invalid chat id prefix for ${input.kind}: ${input.chatId}`);
    }
    const channel = this.db.createChannel(
      {
        ...input,
        owner: input.owner ?? this.config.defaultOwner,
      },
      this.focusedChatIds.has(input.chatId),
    );
    return this.withProjection(channel, this.issueTrustedBootstrapAccess(input.chatId));
  }

  focus(op: MessageFocusOp = "replace", chatIds: string[] = []): string[] {
    const validIds = chatIds.filter((chatId) => this.db.getChannel(chatId) !== undefined);
    switch (op) {
      case "add":
        for (const chatId of validIds) {
          this.focusedChatIds.add(chatId);
        }
        break;
      case "remove":
        for (const chatId of validIds) {
          this.focusedChatIds.delete(chatId);
        }
        break;
      case "replace":
        this.focusedChatIds.clear();
        for (const chatId of validIds) {
          this.focusedChatIds.add(chatId);
        }
        break;
      case "clear":
        this.focusedChatIds.clear();
        break;
    }
    const payload = { chatIds: [...this.focusedChatIds] };
    for (const listener of this.focusListeners) {
      listener(payload);
    }
    return payload.chatIds;
  }

  focusAuthorized(op: MessageFocusOp, access: Array<{ chatId: string; accessToken: string }>): string[] {
    const allowedChatIds = access
      .map(({ chatId, accessToken }) => this.requireAccess(chatId, accessToken, "member").chatId)
      .filter((chatId, index, items) => items.indexOf(chatId) === index);
    return this.focus(op, allowedChatIds);
  }

  getFocusedChatIds(): string[] {
    return [...this.focusedChatIds];
  }

  send(input: MessageAppendInput): MessageRecord {
    const message = this.db.appendMessage(input);
    this.bumpVersion();
    for (const listener of this.messageListeners) {
      listener({ chatId: input.chatId, message });
    }
    return message;
  }

  sendAuthorized(input: MessageAuthorizedWriteInput): MessageRecord {
    this.requireAccess(input.chatId, input.accessToken, "member");
    return this.send({
      chatId: input.chatId,
      messageId: input.messageId,
      rootId: input.rootId,
      from: input.from,
      to: input.to,
      content: input.content,
      createdAt: input.createdAt,
      metadata: input.metadata,
      attachments: input.attachments,
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

  snapshot(chatId: string, limit = 50): MessageSnapshot {
    const snapshot = this.db.snapshot(chatId, this.focusedChatIds.has(chatId), limit);
    return {
      channel: this.withProjection(snapshot.channel, this.issueTrustedBootstrapAccess(chatId)),
      items: snapshot.items,
      nextBefore: this.db.pageMessages(chatId, { limit }).nextBefore,
      hasMoreBefore: this.db.pageMessages(chatId, { limit }).hasMoreBefore,
      headVersion: this.getHeadVersion(),
    };
  }

  snapshotAuthorized(input: MessageAuthorizedReadInput & { limit?: number }): MessageSnapshot {
    const grant = this.requireAccess(input.chatId, input.accessToken, "readonly");
    const page = this.db.pageMessages(input.chatId, { limit: input.limit });
    const snapshot = this.db.snapshot(input.chatId, this.focusedChatIds.has(input.chatId), input.limit ?? 50);
    return {
      channel: this.withProjection(snapshot.channel, this.createProjection(input.chatId, grant.role, input.accessToken)),
      items: page.items,
      nextBefore: page.nextBefore,
      hasMoreBefore: page.hasMoreBefore,
      headVersion: this.getHeadVersion(),
    };
  }

  updateChannelAuthorized(input: {
    chatId: string;
    accessToken: string;
    patch: MessageChannelPatchInput;
  }): MessageControlPlaneEntry {
    const grant = this.requireAccess(input.chatId, input.accessToken, "admin");
    const channel = this.db.updateChannel(input.chatId, input.patch, this.focusedChatIds.has(input.chatId));
    this.bumpVersion();
    return this.withProjection(channel, this.createProjection(input.chatId, grant.role, input.accessToken));
  }

  listChannelGrantsAuthorized(input: MessageAuthorizedReadInput): MessageChannelGrantRecord[] {
    this.requireAccess(input.chatId, input.accessToken, "admin");
    return this.db.listActiveGrants(input.chatId).filter((grant) => !this.isTrustedBootstrapGrant(grant));
  }

  issueChannelGrantAuthorized(input: MessageAuthorizedReadInput & MessageIssueGrantInput): MessageIssuedGrant {
    this.requireAccess(input.chatId, input.accessToken, "admin");
    const accessToken = createOpaqueToken();
    const grant = this.db.issueGrant({
      chatId: input.chatId,
      role: input.role,
      label: input.label,
      participantId: input.participantId,
      tokenHash: hashToken(accessToken),
    });
    this.bumpVersion();
    return {
      ...grant,
      ...this.createProjection(input.chatId, grant.role, accessToken),
    };
  }

  revokeChannelGrantAuthorized(input: MessageAuthorizedReadInput & { grantId: string }): { ok: boolean } {
    this.requireAccess(input.chatId, input.accessToken, "admin");
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
    const path = `${(transport.pathPrefix ?? "/chat").replace(/\/$/, "")}/${encodeURIComponent(chatId)}`;
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
    const pathPrefix = input.pathPrefix ?? this.config.transport?.pathPrefix ?? "/chat";
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
          return new Response("unauthorized", { status: 401 });
        }
        const upgraded = server.upgrade(request, {
          data: {
            chatId,
            accessRole: grant.role,
            accessToken,
            cleanup: [],
          },
        });
        return upgraded ? undefined : new Response("upgrade failed", { status: 500 });
      },
      websocket: {
        open: (socket) => {
          const { chatId, accessRole, accessToken } = socket.data;
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
            this.onFocus(({ chatIds }) => {
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

  private issueTrustedBootstrapAccess(chatId: string): MessageChannelAccessProjection {
    const descriptor = this.createTrustedBootstrapDescriptor(chatId);
    const cachedAccessToken = this.trustedBootstrapTokens.get(chatId);
    if (cachedAccessToken) {
      const grant = this.db.findActiveGrantByToken(chatId, hashToken(cachedAccessToken));
      if (grant && this.isTrustedBootstrapGrant(grant)) {
        return this.createProjection(chatId, grant.role, cachedAccessToken);
      }
      this.trustedBootstrapTokens.delete(chatId);
    }
    this.db.revokeActiveGrantsByDescriptor(descriptor);
    const accessToken = createOpaqueToken();
    const grant = this.db.issueGrant({
      ...descriptor,
      tokenHash: hashToken(accessToken),
    });
    this.trustedBootstrapTokens.set(chatId, accessToken);
    return this.createProjection(chatId, grant.role, accessToken);
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

  private createProjection(
    chatId: string,
    accessRole: MessageChannelAccessRole,
    accessToken: string,
  ): MessageChannelAccessProjection {
    return {
      accessRole,
      accessToken,
      transportUrl: this.getTransportEndpoint(chatId, accessToken)?.url,
    };
  }

  private withProjection(
    channel: Omit<MessageControlPlaneEntry, keyof MessageChannelAccessProjection>,
    projection: MessageChannelAccessProjection,
  ): MessageControlPlaneEntry {
    return {
      ...channel,
      ...projection,
    };
  }

  private requireAccess(
    chatId: string,
    accessToken: string,
    minimumRole: MessageChannelAccessRole,
  ): MessageChannelGrantRecord {
    if (!this.db.getChannel(chatId)) {
      throw new Error("message channel access denied");
    }
    const grant = this.db.findActiveGrantByToken(chatId, hashToken(accessToken));
    if (!grant) {
      throw new Error("message channel access denied");
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
