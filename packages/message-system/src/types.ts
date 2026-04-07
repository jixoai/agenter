import type { PrincipalId } from "@agenter/principal-crypto";

export interface MessageTransportConfig {
  host?: string;
  port: number | null;
  pathPrefix?: string;
}

export interface MessageControlPlaneConfig {
  defaultOwner?: string;
  transport?: MessageTransportConfig;
}

export interface MessageControlPlaneConfigPatch {
  defaultOwner?: string;
  transport?: Partial<MessageTransportConfig>;
}

/**
 * message-system keeps "channel" as the generic product surface.
 * Today the only concrete channel kind is "room", which is the shared space
 * that carries user-facing conversation.
 */
export type MessageChannelKind = "room";
export type MessageFocusOp = "add" | "remove" | "replace" | "clear";
export type MessageChannelAccessRole = "admin" | "member" | "readonly";
export type MessageActorId = PrincipalId | `auth:${string}` | `session:${string}` | `system:${string}`;
export type MessageAdminWorkKind = "grant_issue" | "grant_revoke" | "metadata_update";

export interface MessageParticipant {
  /**
   * Room participants only describe seat membership.
   * Identity provenance stays in the actor id itself (`0x...` / `auth:` / `session:` / `system:`),
   * while room permission stays in grants/admin state.
   */
  id: string;
  label?: string;
}

export interface MessageAdminWorkItem {
  workId: string;
  kind: MessageAdminWorkKind;
  createdAt: number;
  requestedBy: MessageActorId;
  assignedAdminId?: MessageActorId;
  payload?: Record<string, unknown>;
}

export type MessageKind = "text" | "error" | "interactive";
/**
 * `queued` means the message still owes AI-side attention or automation work.
 * It does not mean the room transcript should hide the message from humans.
 */
export type MessageAttentionState = "queued" | "loaded";

export type MessageAttachmentKind = "image" | "video" | "file";

export interface MessageAttachment {
  assetId: string;
  kind: MessageAttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface MessageErrorPayload {
  title?: string;
  code?: string;
  detail?: string;
}

export interface MessageInteractiveField {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  initialValue?: string;
}

export interface MessageInteractivePayload {
  version: "v1";
  kind: "form";
  title: string;
  description?: string;
  submitLabel?: string;
  fields: MessageInteractiveField[];
}

export interface MessagePayload {
  error?: MessageErrorPayload;
  interactive?: MessageInteractivePayload;
}

export interface MessageChannelRecord {
  /**
   * Stable channel id inside message-system. Room channels use principal-backed
   * `0x...` ids even though the generic field stays `chatId`, because it
   * addresses the channel layer rather than a room-specific field name.
   */
  chatId: string;
  kind: MessageChannelKind;
  title: string;
  owner: string;
  contextId?: string;
  participants: MessageParticipant[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  archivedBy?: string;
  focused: boolean;
}

export interface MessageChannelAccessProjection {
  accessRole: MessageChannelAccessRole;
  accessToken: string;
  participantId?: MessageActorId;
  currentAdmin?: boolean;
  transportUrl?: string;
}

export interface MessageReadStateProjection {
  actorId: MessageActorId;
  role: MessageChannelAccessRole;
  label?: string;
  currentAdmin: boolean;
  online: boolean;
  focused: boolean;
  invalidCredential: boolean;
  trackedByLatestVisible: boolean;
  hasReadLatestVisible: boolean;
}

export interface MessageReadProgressProjection {
  latestVisibleMessageId?: string;
  latestVisibleMessageRowId?: number;
  latestVisibleAt?: number;
  totalSeatCount: number;
  readSeatCount: number;
  unreadSeatCount: number;
  invalidCredentialSeatCount: number;
}

export interface MessageChannelGrantRecord {
  grantId: string;
  chatId: string;
  role: MessageChannelAccessRole;
  label?: string;
  participantId?: MessageActorId;
  accessToken?: string;
  createdAt: number;
  revokedAt?: number;
}

export interface MessageRecord {
  rowId: number;
  messageId: string;
  chatId: string;
  rootId?: string;
  senderActorId?: MessageActorId;
  from: string;
  to?: string;
  kind: MessageKind;
  content: string;
  createdAt: number;
  updatedAt: number;
  visibleAt?: number;
  attentionState: MessageAttentionState;
  attentionLoadedAt?: number;
  editable: boolean;
  readActorIds: MessageActorId[];
  unreadActorIds: MessageActorId[];
  metadata?: Record<string, unknown>;
  attachments?: MessageAttachment[];
  payload?: MessagePayload;
}

export interface ReverseTimeCursor {
  beforeTimeMs: number;
  beforeId: number;
}

export interface ReversePage<T> {
  items: T[];
  nextBefore: ReverseTimeCursor | null;
  hasMoreBefore: boolean;
}

export interface MessageControlPlaneEntry extends MessageChannelRecord, MessageChannelAccessProjection {
  readProgress?: MessageReadProgressProjection;
  readStates?: MessageReadStateProjection[];
}

export interface MessageIssuedGrant extends Omit<MessageChannelGrantRecord, "accessToken">, MessageChannelAccessProjection {}

export interface MessageSnapshot {
  channel: MessageControlPlaneEntry;
  items: MessageRecord[];
  nextBefore: ReverseTimeCursor | null;
  hasMoreBefore: boolean;
  headVersion: string;
}

export interface MessageTransportEndpoint {
  host: string;
  port: number;
  path: string;
  url: string;
}

export interface MessageCreateInput {
  chatId: string;
  kind: MessageChannelKind;
  title?: string;
  owner?: string;
  contextId?: string;
  participants?: MessageParticipant[];
  initialUsers?: MessageCreateInitialUserInput[];
  metadata?: Record<string, unknown>;
  adminToken?: string;
  bootstrapActorId?: MessageActorId;
}

export interface MessageCreateInitialUserInput {
  actorId: MessageActorId;
  label?: string;
  role: MessageChannelAccessRole;
  focused?: boolean;
}

export interface MessageAppendInput {
  chatId: string;
  messageId?: string;
  rootId?: string;
  senderActorId?: MessageActorId;
  from?: string;
  to?: string;
  kind?: MessageKind;
  content: string;
  createdAt?: number;
  updatedAt?: number;
  visibleAt?: number;
  attentionState?: MessageAttentionState;
  attentionLoadedAt?: number;
  readActorIds?: MessageActorId[];
  unreadActorIds?: MessageActorId[];
  metadata?: Record<string, unknown>;
  attachments?: MessageAttachment[];
  payload?: MessagePayload;
}

export interface MessageEditInput {
  chatId: string;
  messageId: string;
  content: string;
  metadata?: Record<string, unknown>;
  attachments?: MessageAttachment[];
  payload?: MessagePayload;
}

export interface MessageAuthorizedReadInput {
  chatId: string;
  accessToken: string;
}

export interface MessageAuthorizedWriteInput extends MessageAppendInput {
  accessToken: string;
}

export interface MessageAuthorizedEditInput extends MessageEditInput {
  accessToken: string;
}

export interface MessageAuthorizedPageInput extends MessageAuthorizedReadInput {
  before?: ReverseTimeCursor | null;
  limit?: number;
}

export interface MessageAuthorizedMarkReadInput extends MessageAuthorizedReadInput {
  messageId?: string;
}

export interface MessageChannelPatchInput {
  title?: string;
  participants?: MessageParticipant[];
  metadata?: Record<string, unknown>;
  adminGroupCandidateIds?: MessageActorId[];
}

export interface MessageIssueGrantInput {
  role: MessageChannelAccessRole;
  label?: string;
  participantId?: string;
  accessTokenHint?: string;
}

export interface CommitWaitHandle<T = unknown> {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
}

export type MessageTransportClientMessage =
  | {
      type: "send";
      message: Omit<MessageAppendInput, "chatId">;
    }
  | {
      type: "edit";
      messageId: string;
      content: string;
    }
  | {
      type: "page";
      before?: ReverseTimeCursor | null;
      limit?: number;
    }
  | {
      type: "focus";
      focused: boolean;
    };

export type MessageTransportServerMessage =
  | {
      type: "snapshot";
      chatId: string;
      snapshot: MessageSnapshot;
    }
  | {
      type: "messages";
      chatId: string;
      items: MessageRecord[];
      headVersion: string;
    }
  | {
      type: "page";
      chatId: string;
      page: ReversePage<MessageRecord>;
    }
  | {
      type: "focus";
      chatId: string;
      focused: boolean;
    }
  | {
      type: "error";
      chatId: string;
      message: string;
    };
