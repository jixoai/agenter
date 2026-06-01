<script lang="ts">
  import ResourceCard from "../resource-card.svelte";
  import type { WebChatResourceReference } from "../types";

  let {
    resources,
    tone = "participant",
    onOpenResource,
  }: {
    resources: readonly WebChatResourceReference[];
    tone?: "assistant" | "participant" | "viewer";
    onOpenResource?: ((resource: WebChatResourceReference) => void) | undefined;
  } = $props();
</script>

{#if resources.length > 0}
  <div class="message-markdown-resource-bar" part="message-attachments" data-tone={tone}>
    {#each resources as resource (resource.id)}
      <div part="message-attachment">
        <ResourceCard
          {resource}
          mode="sent"
          {tone}
          onOpen={() => {
            onOpenResource?.(resource);
          }}
        />
      </div>
    {/each}
  </div>
{/if}

<style>
  .message-markdown-resource-bar {
    --message-resource-bar-tile-size: 2.28rem;
    --resource-card-size: var(--message-resource-bar-tile-size);
    display: flex;
    flex-wrap: wrap;
    gap: 0.28rem;
    align-items: center;
    box-sizing: border-box;
    inline-size: fit-content;
    max-inline-size: 100%;
    margin-top: 0.22rem;
    overflow: visible;
    padding: 0;
    line-height: 0;
    scrollbar-width: none;
  }

  .message-markdown-resource-bar::-webkit-scrollbar {
    display: none;
  }

  .message-markdown-resource-bar > [part="message-attachment"] {
    flex: 0 0 var(--message-resource-bar-tile-size);
    inline-size: var(--message-resource-bar-tile-size);
    block-size: var(--message-resource-bar-tile-size);
    min-inline-size: var(--message-resource-bar-tile-size);
    min-block-size: var(--message-resource-bar-tile-size);
    line-height: 0;
  }

  @container (max-width: 34rem) {
    .message-markdown-resource-bar {
      --message-resource-bar-tile-size: 2.16rem;
      gap: 0.24rem;
    }
  }
</style>
