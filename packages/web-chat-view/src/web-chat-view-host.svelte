<script lang="ts">
  import WebChatViewRoot from "./web-chat-view-root.svelte";
  import type { WebChatViewHostProps } from "./types";

  let {
    channel,
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
    channelPresentation = null,
    resolveActorPresentation,
    resolveMessageActions,
    resolveMessageReadProgress,
    composerCapabilities,
    onSendMessage,
    onLatestVisibleAssistantMessageIdChange,
    onLatestVisibleMessageIdChange,
    socketFactory,
  }: WebChatViewHostProps = $props();
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
  {channelPresentation}
  {resolveActorPresentation}
  {resolveMessageActions}
  {resolveMessageReadProgress}
  {composerCapabilities}
  submitMessage={onSendMessage}
  latestVisibleAssistantMessageIdHandler={onLatestVisibleAssistantMessageIdChange}
  latestVisibleMessageIdHandler={onLatestVisibleMessageIdChange}
  {socketFactory}
/>
