import type { PrincipalId } from "@agenter/principal-crypto";
import type {
  ManagedInvitationAcceptProof,
  ManagedInvitationEndpointDescriptor,
  ManagedInvitationRecordBase,
  ManagedInvitationShareDescriptor,
} from "@agenter/managed-seat-invitation-handshake";

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
export type MessageManagedSeatClass = MessageChannelAccessRole;
export type MessageActorId = PrincipalId | `auth:${string}` | `session:${string}` | `system:${string}`;
export type MessageAdminWorkKind = "grant_issue" | "grant_revoke" | "metadata_update";
export type MessageContactRequestDirection = "inbound" | "outbound";
export type MessageContactRequestState =
  | "pending"
  | "accepted"
  | "rejected"
  | "revoked"
  | "expired"
  | "superseded";

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

export interface MessageSourceSubscriptionRecord {
  ownerActorId: MessageActorId;
  sourceId: string;
  label: string;
  endpoint: string;
  authToken?: string;
  callbackSourceId?: string;
  callbackEndpoint?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface MessageSourceSubscriptionInput {
  sourceId: string;
  label?: string;
  endpoint: string;
  authToken?: string;
  callbackSourceId?: string;
  callbackEndpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageContactRecord {
  ownerActorId: MessageActorId;
  sourceId: string;
  remoteActorId: MessageActorId;
  label: string;
  subtitle?: string;
  iconUrl?: string;
  localDirectChatId?: string;
  remoteDirectChatId?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface MessageContactUpsertInput {
  sourceId: string;
  remoteActorId: MessageActorId;
  label: string;
  subtitle?: string;
  iconUrl?: string;
  localDirectChatId?: string;
  remoteDirectChatId?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageContactRequestRecord {
  ownerActorId: MessageActorId;
  requestId: string;
  direction: MessageContactRequestDirection;
  sourceId: string;
  remoteActorId: MessageActorId;
  remoteLabel?: string;
  remoteSubtitle?: string;
  remoteIconUrl?: string;
  message?: string;
  state: MessageContactRequestState;
  callbackSourceId?: string;
  callbackEndpoint?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  respondedAt?: number;
  supersededByRequestId?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageContactRequestCreateInput {
  requestId?: string;
  direction: MessageContactRequestDirection;
  sourceId: string;
  remoteActorId: MessageActorId;
  remoteLabel?: string;
  remoteSubtitle?: string;
  remoteIconUrl?: string;
  message?: string;
  callbackSourceId?: string;
  callbackEndpoint?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export type MessageKind = "text" | "error" | "interactive";
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
  roomRevision: string;
  transcriptRevision: string;
}

export interface MessageChannelAccessProjection {
  accessRole: MessageChannelAccessRole;
  accessToken: string;
  participantId?: MessageActorId;
  currentAdmin?: boolean;
  transportUrl?: string;
}

export interface MessageSeatStateProjection {
  actorId: MessageActorId;
  role: MessageChannelAccessRole;
  label?: string;
  currentAdmin: boolean;
  online: boolean;
  focused: boolean;
  invalidCredential: boolean;
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

export interface MessageActorStateRecord {
  actorId: MessageActorId;
  unreadTotal: number;
  lastActiveAt?: number;
  lastLoginAt?: number;
  online: boolean;
  metadata?: Record<string, unknown>;
}

export interface MessageActorRoomStateRecord {
  actorId: MessageActorId;
  chatId: string;
  unreadCount: number;
  lastReadRowId?: number;
  lastReadAt?: number;
  latestUnreadRowId?: number;
  latestUnreadAt?: number;
  metadata?: Record<string, unknown>;
}

export interface MessageUnreadRoomSummary extends MessageActorRoomStateRecord {}

export interface MessageRecord {
  rowId: number;
  messageId: number;
  chatId: string;
  ref?: number;
  senderActorId?: MessageActorId;
  from: string;
  kind: MessageKind;
  content: string;
  createdAt: number;
  updatedAt: number;
  visibleAt?: number;
  recalledAt?: number;
  recalledByActorId?: MessageActorId;
  readActorIds: MessageActorId[];
  unreadActorIds: MessageActorId[];
  /**
   * Durable client-side idempotency key for one logical send attempt.
   * Reusing it means "return the same durable room message", not "create
   * another row that happens to look similar".
   */
  clientMessageId?: string;
  /**
   * Durable shared room truth only.
   * Sender-private reminder or scheduler state must not be serialized here.
   */
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

export interface MessageRoomRevisionVector {
  roomRevision: string;
  transcriptRevision: string;
  headVersion: string;
}

export interface MessageTranscriptPage extends ReversePage<MessageRecord>, MessageRoomRevisionVector {}

export interface MessageControlPlaneEntry extends MessageChannelRecord, MessageChannelAccessProjection {
  seatStates?: MessageSeatStateProjection[];
}

export interface MessageIssuedGrant
  extends Omit<MessageChannelGrantRecord, "accessToken">, MessageChannelAccessProjection {}

export interface MessageSnapshot {
  channel: MessageControlPlaneEntry;
  items: MessageRecord[];
  nextBefore: ReverseTimeCursor | null;
  hasMoreBefore: boolean;
  roomRevision: string;
  transcriptRevision: string;
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
  ref?: number;
  senderActorId?: MessageActorId;
  from?: string;
  kind?: MessageKind;
  content: string;
  createdAt?: number;
  updatedAt?: number;
  visibleAt?: number;
  readActorIds?: MessageActorId[];
  unreadActorIds?: MessageActorId[];
  /**
   * Durable idempotency key for one logical room write. Safe retry behavior
   * belongs on this explicit contract instead of guessing from content.
   */
  clientMessageId?: string;
  /**
   * Durable shared room truth only.
   * Runtime-private follow-up reminders stay outside room message storage.
   */
  metadata?: Record<string, unknown>;
  attachments?: MessageAttachment[];
  payload?: MessagePayload;
}

export interface MessageEditInput {
  chatId: string;
  messageId: number;
  content: string;
  updatedAt?: number;
}

export interface MessageRecallInput {
  chatId: string;
  messageId: number;
  updatedAt?: number;
  recalledAt?: number;
  recalledByActorId?: MessageActorId;
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

export interface MessageAuthorizedRecallInput extends MessageRecallInput {
  accessToken: string;
}

export interface MessageAuthorizedPageInput extends MessageAuthorizedReadInput {
  before?: ReverseTimeCursor | null;
  limit?: number;
}

export interface MessageAuthorizedMarkReadInput extends MessageAuthorizedReadInput {
  messageId?: number;
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

export interface MessageManagedSeatPayload {
  seatClass: MessageManagedSeatClass;
  role: MessageChannelAccessRole;
  label?: string;
}

export interface MessageInvitationRecord extends ManagedInvitationRecordBase<MessageManagedSeatPayload> {
  resourceKind: "message";
  resourceId: string;
  descriptor: ManagedInvitationShareDescriptor & {
    resourceKind: "message";
  };
}

export interface MessageInviteSeatInput {
  chatId: string;
  participantId: PrincipalId;
  seatClass: MessageManagedSeatClass;
  label?: string;
  expiresAt?: number;
  endpoint?: ManagedInvitationEndpointDescriptor;
  accessToken?: string;
  superadminActorId?: MessageActorId;
}

export interface MessageAcceptSeatInput {
  descriptor: string;
  proof: ManagedInvitationAcceptProof;
}

export interface MessageConfigSeatInput {
  chatId: string;
  participantId: PrincipalId;
  seatClass: MessageManagedSeatClass;
  label?: string;
  expiresAt?: number;
  endpoint?: ManagedInvitationEndpointDescriptor;
  accessToken?: string;
  superadminActorId?: MessageActorId;
}

export interface MessageRevokeSeatInput {
  chatId: string;
  participantId: PrincipalId;
  accessToken?: string;
  superadminActorId?: MessageActorId;
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
      message: Omit<MessageEditInput, "chatId">;
    }
  | {
      type: "recall";
      message: Omit<MessageRecallInput, "chatId">;
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
      roomRevision: string;
      transcriptRevision: string;
      headVersion: string;
    }
  | {
      type: "page";
      chatId: string;
      page: MessageTranscriptPage;
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
