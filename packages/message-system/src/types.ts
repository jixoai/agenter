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

export type MessageChannelKind = "direct" | "room";
export type MessageFocusOp = "add" | "remove" | "replace" | "clear";
export type MessageChannelAccessRole = "admin" | "member" | "readonly";

export interface MessageParticipant {
  id: string;
  label?: string;
  role?: "avatar" | "user" | "system";
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
  chatId: string;
  kind: MessageChannelKind;
  title: string;
  owner: string;
  contextId?: string;
  participants: MessageParticipant[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  focused: boolean;
}

export interface MessageChannelAccessProjection {
  accessRole: MessageChannelAccessRole;
  accessToken: string;
  transportUrl?: string;
}

export interface MessageChannelGrantRecord {
  grantId: string;
  chatId: string;
  role: MessageChannelAccessRole;
  label?: string;
  participantId?: string;
  createdAt: number;
  revokedAt?: number;
}

export interface MessageRecord {
  rowId: number;
  messageId: string;
  chatId: string;
  rootId?: string;
  from: string;
  to?: string;
  kind: MessageKind;
  content: string;
  createdAt: number;
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

export interface MessageControlPlaneEntry extends MessageChannelRecord, MessageChannelAccessProjection {}

export interface MessageIssuedGrant extends MessageChannelGrantRecord, MessageChannelAccessProjection {}

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
  metadata?: Record<string, unknown>;
}

export interface MessageAppendInput {
  chatId: string;
  messageId?: string;
  rootId?: string;
  from: string;
  to?: string;
  kind?: MessageKind;
  content: string;
  createdAt?: number;
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

export interface MessageAuthorizedPageInput extends MessageAuthorizedReadInput {
  before?: ReverseTimeCursor | null;
  limit?: number;
}

export interface MessageChannelPatchInput {
  title?: string;
  participants?: MessageParticipant[];
  metadata?: Record<string, unknown>;
}

export interface MessageIssueGrantInput {
  role: MessageChannelAccessRole;
  label?: string;
  participantId?: string;
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
