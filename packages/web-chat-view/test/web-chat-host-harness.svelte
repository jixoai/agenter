<script lang="ts">
  import { untrack } from "svelte";
  import WebChatViewHost from "../src/web-chat-view-host.svelte";
  import type { WebChatChannel, WebChatSocketFactory } from "../src";

  let {
    initialChannel,
    initialViewerActorId = null,
    socketFactory,
    onLatestVisibleMessageIdChange,
  }: {
    initialChannel: WebChatChannel;
    initialViewerActorId?: string | null;
    socketFactory: WebChatSocketFactory;
    onLatestVisibleMessageIdChange?: (messageId: string | null) => void;
  } = $props();

  let channel = $state<WebChatChannel>(untrack(() => initialChannel));
  let viewerActorId = $state<string | null>(untrack(() => initialViewerActorId));

  export const setChannel = (next: WebChatChannel): void => {
    channel = next;
  };

  export const setViewerActorId = (next: string | null): void => {
    viewerActorId = next;
  };
</script>

<WebChatViewHost {channel} {viewerActorId} {socketFactory} {onLatestVisibleMessageIdChange} />
