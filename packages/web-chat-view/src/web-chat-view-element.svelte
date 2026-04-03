<svelte:options customElement={{ shadow: "open" }} />

<script lang="ts">
  import WebChatViewRoot from "./web-chat-view-root.svelte";
  import type { WebChatRootProps } from "./types";

  let {
    channel = null,
    viewerActorId = null,
    initialMessages = [],
    initialSnapshotResolved = false,
    disabled = false,
    class: className = "",
    showHeader = true,
    emptyTitle = "No messages yet",
    emptyMessage = "Send a message to start this chat channel.",
    emptyTranscriptTitle = emptyTitle,
    emptyTranscriptMessage = emptyMessage,
    routeNotice = null,
    submitMessage,
    latestVisibleAssistantMessageIdHandler,
    latestVisibleMessageIdHandler,
    socketFactory,
  }: WebChatRootProps = $props();
</script>

<WebChatViewRoot
  {channel}
  {viewerActorId}
  {initialMessages}
  {initialSnapshotResolved}
  {disabled}
  class={className}
  {showHeader}
  {emptyTitle}
  {emptyMessage}
  {emptyTranscriptTitle}
  {emptyTranscriptMessage}
  {routeNotice}
  {submitMessage}
  {latestVisibleAssistantMessageIdHandler}
  {latestVisibleMessageIdHandler}
  {socketFactory}
/>
