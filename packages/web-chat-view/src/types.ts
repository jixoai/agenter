import type {
  MessageAttachmentKind,
  MessageContactId,
  MessageControlPlaneEntry,
  MessageRecord,
  MessageTransportServerMessage,
  ReverseTimeCursor,
} from "@agenter/message-system/types";
import type { ScrollController } from "@agenter/svelte-components";

export type WebChatChannel = MessageControlPlaneEntry;
export interface WebChatMessageReference {
  messageId?: number;
  senderContactId?: MessageContactId;
  from: string;
  kind: MessageRecord["kind"];
  content: string;
  createdAt: number;
  updatedAt: number;
  recalledAt?: number;
}
export interface WebChatMessage extends Omit<MessageRecord, "messageId"> {
  viewKey: string;
  messageId?: number;
}
export type WebChatMessageInput = WebChatMessage | MessageRecord;
export type WebChatTransportMessage = MessageTransportServerMessage;
export type WebChatCursor = ReverseTimeCursor;
export type WebChatConnectionState = "idle" | "connecting" | "connected" | "closed" | "error";

export interface WebChatComposerSubmitPayload {
  text: string;
  assets: File[];
  commentResources?: readonly WebChatCommentResourcePayload[];
}

export type WebChatResourceReferenceKind = MessageAttachmentKind | "comment";

export interface WebChatCommentResourceAnchor {
  sourceMessageId?: number;
  sourceViewKey: string;
  sourceLineNumber: number;
  sourceLineEndNumber?: number;
  selectedText: string;
  sourceActorId?: string | null;
  sourceActorLabel?: string;
  sourceUri?: string;
}

export interface WebChatCommentResourcePayload extends WebChatCommentResourceAnchor {
  id: string;
  label: string;
  tokenText: string;
  commentText: string;
}

export interface WebChatResourceReference {
  id: string;
  label: string;
  tokenText: string;
  kind: WebChatResourceReferenceKind;
  detailText?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  url?: string;
  previewUrl?: string;
  extension?: string;
  assetId?: string;
  aliases?: readonly string[];
  iconUrl?: string | null;
  commentText?: string;
  commentAnchor?: WebChatCommentResourceAnchor;
}

export interface WebChatComposerCommandSuggestion {
  label: `/${string}`;
  detail: string;
}

export interface WebChatComposerMentionSuggestion {
  id: string;
  label: string;
  detail?: string;
  apply?: string;
  iconUrl?: string | null;
}

export type WebChatComposerCompletionTrigger = "@" | "^" | "/" | "?" | "？";
export type WebChatComposerCompletionDetection = "boundary" | "embedded";

export interface WebChatComposerCompletionItem {
  id: string;
  label: string;
  insertText: string;
  detail?: string;
  aliases?: readonly string[];
  fileName?: string;
  iconUrl?: string | null;
  resource?: WebChatResourceReference;
}

export interface WebChatComposerCompletionContext {
  trigger: WebChatComposerCompletionTrigger;
}

export interface WebChatComposerCompletionProvider {
  id: string;
  trigger: WebChatComposerCompletionTrigger;
  detection?: WebChatComposerCompletionDetection;
  suggestions?: readonly WebChatComposerCompletionItem[];
  resolveSuggestions?: (
    query: string,
    context: WebChatComposerCompletionContext,
  ) =>
    | readonly WebChatComposerCompletionItem[]
    | Promise<readonly WebChatComposerCompletionItem[]>;
}

export interface WebChatComposerHelpItem {
  label: string;
  value: string;
  insertText?: string;
  aliases?: readonly string[];
}

export interface WebChatComposerCapabilities {
  placeholder?: string;
  submitLabel?: string;
  submitTitle?: string;
  attachmentEnabled?: boolean;
  imageEnabled?: boolean;
  screenshotEnabled?: boolean;
  helpItems?: readonly WebChatComposerHelpItem[];
  commandSuggestions?: readonly WebChatComposerCommandSuggestion[];
  mentionSuggestions?: readonly WebChatComposerMentionSuggestion[];
  resourceReferences?: readonly WebChatResourceReference[];
  completionProviders?: readonly WebChatComposerCompletionProvider[];
  resolveMentionSuggestions?: (
    query: string,
  ) => readonly WebChatComposerMentionSuggestion[] | Promise<readonly WebChatComposerMentionSuggestion[]>;
}

export interface WebChatComposerRenderProps {
  channel: WebChatChannel;
  disabled: boolean;
  sending: boolean;
  connectionState: WebChatConnectionState;
  hintText: string;
  capabilities: WebChatComposerCapabilities;
  liveResourceReferences?: readonly WebChatResourceReference[];
  draftInsertions?: readonly WebChatComposerTextInsertion[];
  commentResourceInsertions?: readonly WebChatCommentResourcePayload[];
  onDraftInsertionApplied?: (id: string) => void;
  onCommentResourceInsertionApplied?: (id: string) => void;
  onSubmit: (payload: WebChatComposerSubmitPayload) => Promise<void>;
}

export interface WebChatComposerTextInsertion {
  id: string;
  text: string;
}

export interface WebChatMessageRenderInput {
  channel: WebChatChannel;
  message: WebChatMessage;
  viewerActorId: string | null;
  isAssistant: boolean;
  onSubmitInteractive: (text: string) => Promise<void>;
}

export interface WebChatMessageReadProgress {
  readCount: number;
  totalCount: number;
  title?: string;
  readActors?: readonly WebChatMessageReadActor[];
  unreadActors?: readonly WebChatMessageReadActor[];
}

export interface WebChatMessageReadActor {
  actorId: string;
  label: string;
  subtitle?: string;
  iconUrl?: string | null;
}

export interface WebChatVisibleMessageFact {
  viewKey: string;
  messageId?: number;
  rowId: number;
}

export interface WebChatActorPresentation {
  actorId?: string | null;
  label: string;
  subtitle?: string;
  iconUrl?: string | null;
  kind?: "assistant" | "auth" | "participant" | "room" | "session" | "system" | "viewer";
}

export interface WebChatActorResolveInput {
  channel: WebChatChannel;
  message?: WebChatMessage;
  viewerActorId: string | null;
  role: "assistant" | "channel" | "participant" | "viewer";
  actorId?: string | null;
  fallbackLabel: string;
}

export interface WebChatMessageAction {
  id: string;
  label: string;
  detail?: string;
  tone?: "default" | "destructive";
  disabled?: boolean;
  onSelect?: (input: WebChatMessageRenderInput) => void | Promise<void>;
}

export interface WebChatCommentDraftRequest extends WebChatCommentResourceAnchor {
  sourceMessage: WebChatMessage;
  commentText: string;
}

export interface WebChatNotice {
  tone: "info" | "warning" | "destructive";
  message: string;
}

export interface WebChatSocketLike {
  readyState: number;
  addEventListener: (type: string, listener: (event: Event | MessageEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: Event | MessageEvent) => void) => void;
  send: (data: string) => void;
  close: () => void;
}

export type WebChatSocketFactory = (url: string) => WebChatSocketLike;

export interface WebChatViewBaseProps {
  channel: WebChatChannel | null;
  viewerActorId?: string | null;
  initialMessages?: WebChatMessageInput[];
  initialSnapshotResolved?: boolean;
  disabled?: boolean;
  showComposerWhenDisabled?: boolean;
  class?: string;
  showHeader?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyTranscriptTitle?: string;
  emptyTranscriptMessage?: string;
  routeNotice?: WebChatNotice | null;
  channelPresentation?: WebChatActorPresentation | null;
  resolveActorPresentation?: (input: WebChatActorResolveInput) => WebChatActorPresentation | null;
  resolveMessageActions?: (input: WebChatMessageRenderInput) => readonly WebChatMessageAction[];
  resolveMessageReadProgress?: (input: WebChatMessageRenderInput) => WebChatMessageReadProgress | null;
  resolveMessageResources?: (input: WebChatMessageRenderInput) => readonly WebChatResourceReference[];
  onCreateCommentDraft?: (input: WebChatCommentDraftRequest) => void | Promise<void>;
  composerCapabilities?: WebChatComposerCapabilities;
  resolveComposerMentionSuggestions?: (
    input: Pick<WebChatComposerRenderProps, "channel"> & {
      viewerActorId: string | null;
      query: string;
    },
  ) => readonly WebChatComposerMentionSuggestion[] | Promise<readonly WebChatComposerMentionSuggestion[]>;
  socketFactory?: WebChatSocketFactory;
}

export interface WebChatRootProps extends WebChatViewBaseProps {
  submitMessage?: (payload: WebChatComposerSubmitPayload) => Promise<void>;
  latestVisibleAssistantViewKeyHandler?: (viewKey: string | null) => void;
  latestVisibleMessageIdHandler?: (message: WebChatVisibleMessageFact | null) => void;
  scrollControllerRef?: ScrollController | null;
  historyStartActionRef?: HTMLButtonElement | null;
}

export interface WebChatViewHostProps extends WebChatViewBaseProps {
  onSendMessage?: (payload: WebChatComposerSubmitPayload) => Promise<void>;
  onLatestVisibleAssistantViewKeyChange?: (viewKey: string | null) => void;
  onLatestVisibleMessageIdChange?: (message: WebChatVisibleMessageFact | null) => void;
  scrollControllerRef?: ScrollController | null;
  historyStartActionRef?: HTMLButtonElement | null;
}
