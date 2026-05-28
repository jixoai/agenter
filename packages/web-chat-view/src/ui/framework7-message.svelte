<script lang="ts">
  import type { Snippet } from "svelte";

  import { Message as F7Message } from "../framework7-components";
  import { cn } from "./utils";

  let {
    class: className,
    type = "received",
    tail = false,
    first = undefined,
    last = undefined,
    avatar,
    name,
    header,
    footer,
    contentEnd,
    children,
  }: {
    class?: string;
    type?: "sent" | "received";
    tail?: boolean;
    first?: boolean;
    last?: boolean;
    avatar?: Snippet;
    name?: Snippet;
    header?: Snippet;
    footer?: Snippet;
    contentEnd?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<div class={cn("web-chat-f7-message-host", className)}>
  <F7Message {type} {tail} {first} {last} {avatar} {name} {header} {footer} {contentEnd}>
    <div class="web-chat-f7-message-content">
      {@render children?.()}
    </div>
  </F7Message>
</div>

<style>
  .web-chat-f7-message-host {
    display: flex;
    min-width: 0;
    max-width: 100%;
  }

  .web-chat-f7-message-host :global(.message) {
    min-width: 0;
    max-width: min(32rem, 64%);
    margin-top: 0;
    margin-bottom: 0;
  }

  .web-chat-f7-message-host :global(.message-content) {
    min-width: 0;
    max-width: 100%;
    flex: 0 1 auto;
  }

  .web-chat-f7-message-host :global(.message-header),
  .web-chat-f7-message-host :global(.message-footer),
  .web-chat-f7-message-host :global(.message-name) {
    line-height: normal;
  }

  .web-chat-f7-message-content {
    min-width: 0;
    max-width: 100%;
  }
</style>
