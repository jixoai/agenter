<script lang="ts">
  import WebChatViewRoot from "./web-chat-view-root.svelte";
  import type { WebChatViewHostProps } from "./types";

  let {
    channel,
    initialMessages = [],
    disabled = false,
    class: className = "",
    showHeader = true,
    emptyTitle = "No messages yet",
    emptyMessage = "Send a message to start this chat channel.",
    routeNotice = null,
    onSendMessage,
    onLatestVisibleAssistantMessageIdChange,
    onLatestVisibleMessageIdChange,
    socketFactory,
  }: WebChatViewHostProps = $props();
</script>

<WebChatViewRoot
  {channel}
  {initialMessages}
  {disabled}
  class={className}
  {showHeader}
  {emptyTitle}
  {emptyMessage}
  {routeNotice}
  submitMessage={onSendMessage}
  latestVisibleAssistantMessageIdHandler={onLatestVisibleAssistantMessageIdChange}
  latestVisibleMessageIdHandler={onLatestVisibleMessageIdChange}
  {socketFactory}
/>
