<script lang="ts">
  import { untrack } from "svelte";
  import WebChatViewHost from "../src/web-chat-view-host.svelte";
  import type { WebChatChannel, WebChatSocketFactory } from "../src";

  let {
    initialChannel,
    socketFactory,
    onLatestVisibleMessageIdChange,
  }: {
    initialChannel: WebChatChannel;
    socketFactory: WebChatSocketFactory;
    onLatestVisibleMessageIdChange?: (messageId: string | null) => void;
  } = $props();

  let channel = $state<WebChatChannel>(untrack(() => initialChannel));

  export const setChannel = (next: WebChatChannel): void => {
    channel = next;
  };
</script>

<WebChatViewHost {channel} {socketFactory} {onLatestVisibleMessageIdChange} />
