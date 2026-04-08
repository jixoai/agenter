export const WEB_CHAT_VIEW_TAG = "agenter-web-chat-view";

export const defineWebChatView = async (): Promise<void> => {
  if (typeof customElements === "undefined" || customElements.get(WEB_CHAT_VIEW_TAG)) {
    return;
  }
  const { default: WebChatViewElementComponent } = await import("./web-chat-view-element.svelte");
  customElements.define(WEB_CHAT_VIEW_TAG, WebChatViewElementComponent.element as CustomElementConstructor);
};

export type WebChatViewElement = HTMLElement & {
  channel: import("./types").WebChatChannel | null;
  viewerActorId?: string | null;
  initialMessages: import("./types").WebChatMessage[];
  initialSnapshotResolved: boolean;
  disabled: boolean;
  showHeader: boolean;
  emptyTitle: string;
  emptyMessage: string;
  emptyTranscriptTitle: string;
  emptyTranscriptMessage: string;
  routeNotice: import("./types").WebChatNotice | null;
  channelPresentation?: import("./types").WebChatActorPresentation | null;
  resolveActorPresentation?: (
    input: import("./types").WebChatActorResolveInput,
  ) => import("./types").WebChatActorPresentation | null;
  resolveMessageActions?: (
    input: import("./types").WebChatMessageRenderInput,
  ) => readonly import("./types").WebChatMessageAction[];
  composerCapabilities?: import("./types").WebChatComposerCapabilities;
  submitMessage?: (payload: import("./types").WebChatComposerSubmitPayload) => Promise<void>;
  latestVisibleAssistantMessageIdHandler?: (messageId: string | null) => void;
  latestVisibleMessageIdHandler?: (message: import("./types").WebChatVisibleMessageFact | null) => void;
  socketFactory?: import("./types").WebChatSocketFactory;
};
