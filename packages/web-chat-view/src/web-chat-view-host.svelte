<script lang="ts">
  import WebChatViewRoot from "./web-chat-view-root.svelte";
  import type { WebChatViewHostProps } from "./types";

  let {
    channel,
    viewerActorId = null,
    initialMessages = [],
    initialSnapshotResolved = false,
    disabled = false,
    showComposerWhenDisabled = true,
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
    onLatestVisibleAssistantViewKeyChange,
    onLatestVisibleMessageIdChange,
    scrollControllerRef = $bindable(null),
    historyStartActionRef = $bindable(null),
    socketFactory,
  }: WebChatViewHostProps = $props();
</script>

<WebChatViewRoot
  {channel}
  {viewerActorId}
  {initialMessages}
  {initialSnapshotResolved}
  {disabled}
  {showComposerWhenDisabled}
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
  latestVisibleAssistantViewKeyHandler={onLatestVisibleAssistantViewKeyChange}
  latestVisibleMessageIdHandler={onLatestVisibleMessageIdChange}
  bind:scrollControllerRef
  bind:historyStartActionRef
  {socketFactory}
/>
