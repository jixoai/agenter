import type {
  MessageControlPlaneEntry,
  MessageRecord,
  MessageTransportServerMessage,
  ReverseTimeCursor,
} from "@agenter/message-system/types";

export type WebChatChannel = MessageControlPlaneEntry;
export type WebChatMessage = MessageRecord;
export type WebChatTransportMessage = MessageTransportServerMessage;
export type WebChatCursor = ReverseTimeCursor;
export type WebChatConnectionState = "idle" | "connecting" | "connected" | "closed" | "error";

export interface WebChatComposerSubmitPayload {
  text: string;
  assets: File[];
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

export interface WebChatComposerHelpItem {
  label: string;
  value: string;
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
  resolveMentionSuggestions?: (
    query: string,
  ) =>
    | readonly WebChatComposerMentionSuggestion[]
    | Promise<readonly WebChatComposerMentionSuggestion[]>;
}

export interface WebChatComposerRenderProps {
  channel: WebChatChannel;
  disabled: boolean;
  sending: boolean;
  connectionState: WebChatConnectionState;
  hintText: string;
  capabilities: WebChatComposerCapabilities;
  onSubmit: (payload: WebChatComposerSubmitPayload) => Promise<void>;
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
  initialMessages?: WebChatMessage[];
  initialSnapshotResolved?: boolean;
  disabled?: boolean;
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
  composerCapabilities?: WebChatComposerCapabilities;
  socketFactory?: WebChatSocketFactory;
}

export interface WebChatRootProps extends WebChatViewBaseProps {
  submitMessage?: (payload: WebChatComposerSubmitPayload) => Promise<void>;
  latestVisibleAssistantMessageIdHandler?: (messageId: string | null) => void;
  latestVisibleMessageIdHandler?: (messageId: string | null) => void;
}

export interface WebChatViewHostProps extends WebChatViewBaseProps {
  onSendMessage?: (payload: WebChatComposerSubmitPayload) => Promise<void>;
  onLatestVisibleAssistantMessageIdChange?: (messageId: string | null) => void;
  onLatestVisibleMessageIdChange?: (messageId: string | null) => void;
}
