<script lang="ts">
  import type { Snippet } from "svelte";

  import { MessagebarSheet } from "../framework7-components";

  let {
    ariaLabel = "Message tools",
    children,
  }: {
    ariaLabel?: string;
    children?: Snippet;
  } = $props();
</script>

<MessagebarSheet class="web-chat-f7-composer-tool-sheet composer-tool-sheet" aria-label={ariaLabel}>
  {@render children?.()}
</MessagebarSheet>

<style>
  :global(.web-chat-f7-composer-tool-sheet.messagebar-sheet) {
    --f7-messagebar-sheet-height: 5.35rem;
    --f7-messagebar-sheet-landscape-height: 5.35rem;
  }
</style>
