<script lang="ts">
  import { MessagebarAttachment } from "../framework7-components";
  import Framework7MessagebarAttachments from "../ui/framework7-messagebar-attachments.svelte";
  import {
    commentResourceToReference,
    pendingAssetToResourceReference,
  } from "../resource-contract";
  import ResourceCard from "../resource-card.svelte";
  import ResourcePreviewLayer from "../resource-preview-layer.svelte";
  import type { WebChatCommentResourcePayload } from "../types";
  import type { PendingAsset } from "./pending-assets";

  let {
    assets,
    commentResources = [],
    onRemove,
    onRemoveComment,
    onUpdateComment,
  }: {
    assets: PendingAsset[];
    commentResources?: readonly WebChatCommentResourcePayload[];
    onRemove: (assetId: string) => void;
    onRemoveComment?: (resourceId: string) => void;
    onUpdateComment?: (resourceId: string, commentText: string) => void;
  } = $props();

  const assetResources = $derived(
    assets.map((asset, index) => ({
      id: asset.id,
      removeId: asset.id,
      removeKind: "asset" as const,
      resource: pendingAssetToResourceReference(asset, index),
    })),
  );
  const commentResourceEntries = $derived(
    commentResources.map((resource) => ({
      id: resource.id,
      removeId: resource.id,
      removeKind: "comment" as const,
      resource: commentResourceToReference(resource),
    })),
  );
  const resources = $derived([...assetResources, ...commentResourceEntries]);
  let previewingResourceId = $state<string | null>(null);
  let commentDetailMode = $state<"view" | "edit">("view");
  let commentDraftValue = $state("");
  const previewingResource = $derived(
    resources.find((item) => item.resource.id === previewingResourceId)?.resource ?? null,
  );

  const openResource = (resourceId: string): void => {
    const resource = resources.find((item) => item.resource.id === resourceId)?.resource ?? null;
    previewingResourceId = resourceId;
    if (resource?.kind === "comment") {
      commentDetailMode = "view";
      commentDraftValue = resource.commentText ?? resource.detailText ?? "";
    }
  };

  const finalizePendingCommentEdit = (): void => {
    if (!previewingResource || previewingResource.kind !== "comment" || commentDraftValue.trim().length > 0) {
      return;
    }
    onRemoveComment?.(previewingResource.id);
    previewingResourceId = null;
  };
</script>

{#if resources.length > 0}
  <Framework7MessagebarAttachments class="pending-resource-shelf" part="composer-assets">
    {#each resources as item (item.id)}
      <MessagebarAttachment class="pending-resource-attachment" deletable={false} part="composer-asset">
        <ResourceCard
          resource={item.resource}
          mode="pending"
          onOpen={() => {
            openResource(item.resource.id);
          }}
          onRemove={() => {
            if (item.removeKind === "asset") {
              onRemove(item.removeId);
            } else {
              onRemoveComment?.(item.removeId);
            }
            if (previewingResourceId === item.resource.id) {
              previewingResourceId = null;
            }
          }}
        />
      </MessagebarAttachment>
    {/each}
  </Framework7MessagebarAttachments>

  <ResourcePreviewLayer
    resource={previewingResource}
    open={Boolean(previewingResource)}
    commentMode={commentDetailMode}
    commentEditable
    bind:commentDraftValue={commentDraftValue}
    onCommentModeChange={(next) => {
      commentDetailMode = next;
    }}
    onCommentSave={() => {
      if (previewingResource) {
        const trimmedDraft = commentDraftValue.trim();
        if (trimmedDraft.length === 0) {
          finalizePendingCommentEdit();
          return;
        }
        onUpdateComment?.(previewingResource.id, trimmedDraft);
        commentDraftValue = trimmedDraft;
        commentDetailMode = "view";
      }
    }}
    onCommentClose={finalizePendingCommentEdit}
    onOpenChange={(next) => {
      if (!next) {
        finalizePendingCommentEdit();
      }
      previewingResourceId = next ? previewingResourceId : null;
    }}
  />
{/if}

<style>
  :global(.pending-resource-shelf) {
    --f7-messagebar-attachment-height: 2.46rem;
    --f7-messagebar-attachment-landscape-height: 2.46rem;
    --f7-messagebar-attachment-border-radius: 12px;
    display: block;
    min-width: 0;
  }

  :global(.pending-resource-shelf.messagebar-attachments) {
    gap: 0.5rem;
    overflow-x: auto;
    overflow-y: visible;
    box-sizing: border-box;
    padding-block: 0.08rem 0.04rem;
    padding-inline: 0.45rem;
    scrollbar-width: thin;
  }

  :global(.pending-resource-shelf.messagebar-attachments .pending-resource-attachment) {
    display: inline-flex;
    align-items: stretch;
    justify-content: center;
    flex: 0 0 auto;
    width: 2.46rem;
    height: 2.46rem;
    margin-right: 0;
    background: transparent;
    overflow: visible;
    vertical-align: top;
    padding: 0;
  }

  :global(.pending-resource-shelf.messagebar-attachments .pending-resource-attachment > .resource-card) {
    width: 2.46rem;
    height: 2.46rem;
  }
</style>
