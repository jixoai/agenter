<script lang="ts">
  import { attachmentToResourceReference } from "./resource-contract";
  import ResourceCard from "./resource-card.svelte";
  import ResourcePreviewLayer from "./resource-preview-layer.svelte";
  import type { WebChatResourceReference } from "./types";
  import type { MessageAttachment } from "@agenter/message-system/types";

  let {
    attachments,
    resources = [],
    tone = "participant",
  }: {
    attachments: MessageAttachment[];
    resources?: readonly WebChatResourceReference[];
    tone?: "assistant" | "participant" | "viewer";
  } = $props();

  const fallbackResources = $derived(attachments.map((attachment, index) => attachmentToResourceReference(attachment, index)));
  const effectiveResources = $derived(resources.length > 0 ? resources : fallbackResources);
  let previewingResourceId = $state<string | null>(null);
  const previewingResource = $derived(effectiveResources.find((resource) => resource.id === previewingResourceId) ?? null);
  let commentDetailMode = $state<"view" | "edit">("view");

  const openResource = (resource: WebChatResourceReference): void => {
    previewingResourceId = resource.id;
    commentDetailMode = resource.kind === "comment" ? "view" : commentDetailMode;
  };
</script>

{#if effectiveResources.length > 0}
  <div class="resource-shelf" part="message-attachments" data-tone={tone}>
    {#each effectiveResources as resource (resource.id)}
      <div part="message-attachment">
        <ResourceCard
          {resource}
          mode="sent"
          {tone}
          onOpen={() => {
            openResource(resource);
          }}
        />
      </div>
    {/each}
  </div>

  <ResourcePreviewLayer
    resource={previewingResource}
    open={Boolean(previewingResource)}
    commentMode={commentDetailMode}
    onCommentModeChange={(next) => {
      commentDetailMode = next;
    }}
    onOpenChange={(next) => {
      previewingResourceId = next ? previewingResourceId : null;
    }}
  />
{/if}

<style>
  .resource-shelf {
    display: flex;
    gap: 0.24rem;
    margin-top: 0.18rem;
    overflow-x: auto;
    padding-bottom: 0.04rem;
    scrollbar-width: thin;
  }

  .resource-shelf > [part="message-attachment"] {
    flex: 0 0 auto;
    min-width: 0;
  }
</style>
