<script lang="ts">
  import { tick } from "svelte";
  import CommentInspector from "./comment-inspector.svelte";
  import type { WebChatResourceReference } from "./types";

  let {
    resource,
    open = false,
    mode = "view",
    editable = false,
    draftValue = $bindable(""),
    onOpenChange,
    onModeChange,
    onSave,
    onClose,
  }: {
    resource: WebChatResourceReference | null;
    open?: boolean;
    mode?: "view" | "edit";
    editable?: boolean;
    draftValue?: string;
    onOpenChange?: (next: boolean) => void;
    onModeChange?: (next: "view" | "edit") => void;
    onSave?: (() => void | Promise<void>) | undefined;
    onClose?: (() => void | Promise<void>) | undefined;
  } = $props();

  let retainedResource = $state<WebChatResourceReference | null>(null);
  let hydratedDraftResourceId = $state<string | null>(null);

  const activeResource = $derived(resource ?? retainedResource);
  const resolvedOpen = $derived(Boolean(open && activeResource?.kind === "comment"));
  const selectedText = $derived(activeResource?.commentAnchor?.selectedText ?? "");
  const sourceActorLabel = $derived(activeResource?.commentAnchor?.sourceActorLabel);
  const sourceLineNumber = $derived(activeResource?.commentAnchor?.sourceLineNumber);
  const sourceUri = $derived(activeResource?.commentAnchor?.sourceUri);

  const handleOpenChange = (next: boolean): void => {
    onOpenChange?.(next);
    if (!next) {
      void tick().then(() => {
        if (!open && !resource) {
          retainedResource = null;
        }
      });
    }
  };

  $effect(() => {
    if (resource) {
      retainedResource = resource;
    }
  });

  $effect(() => {
    if (!activeResource || activeResource.id === hydratedDraftResourceId) {
      return;
    }
    hydratedDraftResourceId = activeResource.id;
    draftValue = activeResource.commentText || activeResource.detailText || "";
  });
</script>

{#if activeResource}
  <CommentInspector
    open={resolvedOpen}
    title={activeResource.label}
    selectedText={selectedText}
    {sourceActorLabel}
    {sourceLineNumber}
    {sourceUri}
    {mode}
    canEdit={editable}
    bind:value={draftValue}
    onOpenChange={handleOpenChange}
    onModeChange={onModeChange}
    onSave={onSave}
    onClose={onClose}
  />
{/if}
