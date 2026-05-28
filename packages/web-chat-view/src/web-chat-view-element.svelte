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
    resolveMessageResources,
    onCreateCommentDraft,
    composerCapabilities,
    submitMessage,
    latestVisibleAssistantViewKeyHandler,
    latestVisibleMessageIdHandler,
    scrollControllerRef = $bindable(null),
    historyStartActionRef = $bindable(null),
    socketFactory,
  }: WebChatRootProps = $props();
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
  {resolveMessageResources}
  {onCreateCommentDraft}
  {composerCapabilities}
  {submitMessage}
  {latestVisibleAssistantViewKeyHandler}
  {latestVisibleMessageIdHandler}
  bind:scrollControllerRef
  bind:historyStartActionRef
  {socketFactory}
/>
