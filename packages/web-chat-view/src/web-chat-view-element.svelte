<svelte:options customElement={{ shadow: "open" }} />

<script lang="ts">
  import WebChatViewRoot from "./web-chat-view-root.svelte";
  import type { WebChatRootProps } from "./types";

  let {
    channel = null,
    initialMessages = [],
    disabled = false,
    class: className = "",
    showHeader = true,
    emptyTitle = "No messages yet",
    emptyMessage = "Send a message to start this chat channel.",
    routeNotice = null,
    submitMessage,
    latestVisibleAssistantMessageIdHandler,
    latestVisibleMessageIdHandler,
    socketFactory,
  }: WebChatRootProps = $props();
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
  {submitMessage}
  {latestVisibleAssistantMessageIdHandler}
  {latestVisibleMessageIdHandler}
  {socketFactory}
/>
