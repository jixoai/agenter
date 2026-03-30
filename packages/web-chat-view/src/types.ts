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

export interface WebChatChannelState {
  connectionState: WebChatConnectionState;
  messages: WebChatMessage[];
  pendingMessages: WebChatMessage[];
  transcriptMessages: WebChatMessage[];
  focused: boolean;
  hasMoreBefore: boolean;
  loadingInitial: boolean;
  loadingMore: boolean;
  errorMessage: string | null;
  loadOlder: () => void;
  sendText: (text: string) => Promise<void>;
  editMessage: (messageId: string, text: string) => Promise<void>;
}
