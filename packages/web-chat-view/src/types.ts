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

export interface WebChatComposerRenderProps {
  channel: WebChatChannel;
  disabled: boolean;
  sending: boolean;
  connectionState: WebChatConnectionState;
  hintText: string;
  onSubmit: (payload: WebChatComposerSubmitPayload) => Promise<void>;
}

export interface WebChatMessageRenderInput {
  channel: WebChatChannel;
  message: WebChatMessage;
  isAssistant: boolean;
  onSubmitInteractive: (text: string) => Promise<void>;
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
  initialMessages?: WebChatMessage[];
  disabled?: boolean;
  class?: string;
  showHeader?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  routeNotice?: WebChatNotice | null;
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
