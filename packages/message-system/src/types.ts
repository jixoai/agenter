import type {
  ManagedInvitationAcceptProof,
  ManagedInvitationEndpointDescriptor,
  ManagedInvitationRecordBase,
  ManagedInvitationShareDescriptor,
} from "@agenter/managed-seat-invitation-handshake";
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

export interface MessageSystemIdentity {
  systemId: PrincipalId;
  superadminContactId: PrincipalId;
  defaultLocal: boolean;
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
export type MessageContactId = PrincipalId | `auth:${string}` | `session:${string}` | `system:${string}`;
export type MessageAdminWorkKind = "grant_issue" | "grant_revoke" | "metadata_update";
export type MessageContactRequestDirection = "inbound" | "outbound";
export type MessageContactRequestState = "pending" | "accepted" | "rejected" | "revoked" | "expired" | "superseded";

export interface MessageParticipant {
  /**
   * Room participants only describe seat membership.
   * Identity provenance stays in the contact id itself (`0x...` / `auth:` / `session:` / `system:`),
   * while room permission stays in grants/admin state.
   */
  id: string;
  label?: string;
}

export interface MessageAdminWorkItem {
  workId: string;
  kind: MessageAdminWorkKind;
  createdAt: number;
  requestedBy: MessageContactId;
  assignedAdminId?: MessageContactId;
  payload?: Record<string, unknown>;
}

export interface MessageSourceSubscriptionRecord {
  ownerContactId: MessageContactId;
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
  ownerContactId: MessageContactId;
  sourceId: string;
  remoteContactId: MessageContactId;
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
  remoteContactId: MessageContactId;
  label: string;
  subtitle?: string;
  iconUrl?: string;
  localDirectChatId?: string;
  remoteDirectChatId?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageContactRequestRecord {
  ownerContactId: MessageContactId;
  requestId: string;
  direction: MessageContactRequestDirection;
  sourceId: string;
  remoteContactId: MessageContactId;
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
  remoteContactId: MessageContactId;
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
  superKey: PrincipalId;
  createdBySystemId: PrincipalId;
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
  participantId?: MessageContactId;
  currentAdmin?: boolean;
  transportUrl?: string;
}

export interface MessageSeatStateProjection {
  contactId: MessageContactId;
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
  participantId?: MessageContactId;
  accessToken?: string;
  createdAt: number;
  revokedAt?: number;
}

export interface MessageContactStateRecord {
  contactId: MessageContactId;
  unreadTotal: number;
  lastActiveAt?: number;
  lastLoginAt?: number;
  online: boolean;
  metadata?: Record<string, unknown>;
}

export interface MessageContactRoomStateRecord {
  contactId: MessageContactId;
  chatId: string;
  unreadCount: number;
  lastReadRowId?: number;
  lastReadAt?: number;
  latestUnreadRowId?: number;
  latestUnreadAt?: number;
  metadata?: Record<string, unknown>;
}

export interface MessageUnreadRoomSummary extends MessageContactRoomStateRecord {}

export interface MessageRecord {
  rowId: number;
  messageId: number;
  chatId: string;
  ref?: number;
  sourceSystemId: PrincipalId;
  senderContactId?: MessageContactId;
  from: string;
  kind: MessageKind;
  content: string;
  createdAt: number;
  updatedAt: number;
  visibleAt?: number;
  recalledAt?: number;
  recalledByContactId?: MessageContactId;
  readContactIds: MessageContactId[];
  unreadContactIds: MessageContactId[];
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

export interface MessageFollowUpRequest {
  /**
   * One-shot reminder delay owned by the runtime that sent or explicitly
   * reused the room message. This is scheduler input, not room truth.
   */
  afterMs: number;
  /**
   * Follow-up delivery is session-owned rather than room-owned so the global
   * message-system can route later attention back to the correct runtime.
   */
  ownerSessionId: string;
  /**
   * Durable attention store root for this reminder's owner session.
   * This lets message-system persist reminder attention even while the runtime
   * instance is offline.
   *
   * TODO: This is an intentionally local-first bridge. Remote parity must come
   * from a future AsyncContext + RPC ownership architecture rather than adding
   * more ad-hoc transport fields here.
   */
  attentionRoot: string;
  /**
   * Stable attention context companion for the room message.
   */
  attentionContextId: string;
  /**
   * Attention owner recorded into the durable context if that context has not
   * been created yet.
   */
  attentionOwner: string;
}

export interface MessageFollowUpTaskRecord {
  taskId: string;
  chatId: string;
  messageId: number;
  ownerSessionId: string;
  attentionRoot: string;
  attentionContextId: string;
  attentionOwner: string;
  dueAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface MessageFollowUpDueInput extends MessageFollowUpTaskRecord {
  message: MessageRecord;
}

export interface MessageFollowUpDeliveryReceipt {
  reminderContextId?: string | null;
  reminderCommitId?: string | null;
}

export interface MessageFollowUpReminderPresentation {
  title: string;
  detailValue: string;
  detailFormat: string;
  detailKind: "replace";
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
  /**
   * Room control truth still persists a concrete superKey.
   * Callers may omit it and let the control plane bind the current system superadmin.
   */
  superKey?: PrincipalId;
  systemId?: PrincipalId;
  contextId?: string;
  participants?: MessageParticipant[];
  initialUsers?: MessageCreateInitialUserInput[];
  metadata?: Record<string, unknown>;
  adminToken?: string;
  bootstrapContactId?: MessageContactId;
}

export interface MessageCreateInitialUserInput {
  contactId: MessageContactId;
  label?: string;
  role: MessageChannelAccessRole;
  focused?: boolean;
}

export interface MessageAppendInput {
  chatId: string;
  ref?: number;
  sourceSystemId?: PrincipalId;
  senderContactId?: MessageContactId;
  from?: string;
  kind?: MessageKind;
  content: string;
  createdAt?: number;
  updatedAt?: number;
  visibleAt?: number;
  readContactIds?: MessageContactId[];
  unreadContactIds?: MessageContactId[];
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
  /**
   * Private reminder scheduling input. The task is stored outside the durable
   * room row so later attention can be re-opened without mutating room truth.
   */
  followUp?: MessageFollowUpRequest;
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
  recalledByContactId?: MessageContactId;
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
  adminGroupCandidateIds?: MessageContactId[];
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
  superadminContactId?: MessageContactId;
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
  superadminContactId?: MessageContactId;
}

export interface MessageRevokeSeatInput {
  chatId: string;
  participantId: PrincipalId;
  accessToken?: string;
  superadminContactId?: MessageContactId;
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
