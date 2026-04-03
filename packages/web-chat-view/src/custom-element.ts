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
  initialMessages: import("./types").WebChatMessage[];
  disabled: boolean;
  showHeader: boolean;
  emptyTitle: string;
  emptyMessage: string;
  routeNotice: import("./types").WebChatNotice | null;
  submitMessage?: (payload: import("./types").WebChatComposerSubmitPayload) => Promise<void>;
  latestVisibleAssistantMessageIdHandler?: (messageId: string | null) => void;
  latestVisibleMessageIdHandler?: (messageId: string | null) => void;
  socketFactory?: import("./types").WebChatSocketFactory;
};
