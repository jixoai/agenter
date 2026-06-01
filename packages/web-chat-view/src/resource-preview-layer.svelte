<script lang="ts">
  import { tick } from "svelte";
  import Copy from "@lucide/svelte/icons/copy";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";

  import { formatAttachmentSize } from "./chat-attachment-utils";
  import { writeClipboardText } from "./clipboard";
  import CommentInspector from "./comment-inspector.svelte";
  import ResourceIconWithNumber, { type ResourceIconWithNumberKind } from "./components/resource-icon-with-number.svelte";
  import { resolveResourceIconNumber } from "./components/resource-icon-number";
  import { Block, BlockTitle, Link, List, ListItem } from "./framework7-components";
  import { showFramework7Toast } from "./framework7-toast";
  import ResourcePreviewShell from "./resource-preview-shell.svelte";
  import type { WebChatResourceReference } from "./types";

  let {
    resource,
    open = false,
    onOpenChange,
    commentMode = "view",
    commentEditable = false,
    commentDraftValue = $bindable(""),
    onCommentModeChange,
    onCommentSave,
    onCommentClose,
  }: {
    resource: WebChatResourceReference | null;
    open?: boolean;
    onOpenChange?: (next: boolean) => void;
    commentMode?: "view" | "edit";
    commentEditable?: boolean;
    commentDraftValue?: string;
    onCommentModeChange?: (next: "view" | "edit") => void;
    onCommentSave?: (() => void | Promise<void>) | undefined;
    onCommentClose?: (() => void | Promise<void>) | undefined;
  } = $props();

  let retainedResource = $state<WebChatResourceReference | null>(null);

  const activeResource = $derived(resource ?? retainedResource);
  const resolvedOpen = $derived(Boolean(open && activeResource));
  const resolvedExtension = $derived(
    activeResource?.extension?.toUpperCase() ?? activeResource?.kind.toUpperCase() ?? "",
  );
  const resolvedTitle = $derived(activeResource?.fileName ?? activeResource?.label ?? "Resource");
  const previewTone = $derived(
    activeResource?.kind === "image" || activeResource?.kind === "video" ? "media" : "document",
  );
  const resolvedMeta = $derived.by(() => {
    if (!activeResource) {
      return "";
    }
    const parts = [activeResource.kind.toUpperCase()];
    if (typeof activeResource.sizeBytes === "number") {
      parts.push(formatAttachmentSize(activeResource.sizeBytes));
    }
    if (activeResource.mimeType) {
      parts.push(activeResource.mimeType);
    }
    return parts.join(" · ");
  });
  const resolvedSize = $derived(
    typeof activeResource?.sizeBytes === "number" ? formatAttachmentSize(activeResource.sizeBytes) : "",
  );
  const resolvedSummary = $derived(
    activeResource?.detailText?.trim()
    || activeResource?.tokenText?.trim()
    || activeResource?.fileName?.trim()
    || "",
  );
  const resolvedCommentMeta = $derived.by(() => {
    if (activeResource?.kind !== "comment") {
      return "";
    }
    const parts: string[] = [];
    const sourceActorLabel = activeResource.commentAnchor?.sourceActorLabel?.trim();
    if (sourceActorLabel) {
      parts.push(sourceActorLabel);
    }
    if (typeof activeResource.commentAnchor?.sourceLineNumber === "number") {
      parts.push(`Line ${activeResource.commentAnchor.sourceLineNumber}`);
    }
    return parts.join(" · ");
  });

  const resourceIconKind = $derived.by<ResourceIconWithNumberKind>(() => {
    if (activeResource?.kind === "comment") {
      return "comment";
    }
    if (activeResource?.kind === "image") {
      return "image";
    }
    return "file";
  });
  const resourceIconNumber = $derived(activeResource ? resolveResourceIconNumber(activeResource) : "*");

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

  const copyResourceLink = async (): Promise<void> => {
    if (!activeResource?.url) {
      return;
    }
    await writeClipboardText(activeResource.url);
    showFramework7Toast("已复制资源链接");
  };

  $effect(() => {
    if (resource) {
      retainedResource = resource;
    }
  });
</script>

{#if activeResource?.kind === "comment"}
  <ResourcePreviewShell
    open={resolvedOpen}
    title={resolvedTitle}
    eyebrow="Comment"
    meta={resolvedCommentMeta}
    onOpenChange={handleOpenChange}
  >
    <CommentInspector
      standaloneShell={false}
      open={resolvedOpen}
      title={resolvedTitle}
      selectedText={activeResource.commentAnchor?.selectedText ?? ""}
      sourceActorLabel={activeResource.commentAnchor?.sourceActorLabel}
      sourceLineNumber={activeResource.commentAnchor?.sourceLineNumber}
      sourceUri={activeResource.commentAnchor?.sourceUri}
      mode={commentMode}
      canEdit={commentEditable}
      bind:value={commentDraftValue}
      onModeChange={onCommentModeChange}
      onSave={onCommentSave}
      onClose={onCommentClose}
      onOpenChange={handleOpenChange}
    />
  </ResourcePreviewShell>
{:else if activeResource}
  <ResourcePreviewShell
    open={resolvedOpen}
    title={resolvedTitle}
    eyebrow={resolvedExtension}
    meta={resolvedMeta}
    tone={previewTone}
    onOpenChange={handleOpenChange}
  >
    {#snippet headerActions()}
      {#if activeResource.url}
        <Link
          href={activeResource.url}
          target="_blank"
          rel="noreferrer"
          external
          iconOnly
          class="resource-preview-open-link"
        >
          <ExternalLink class="size-4" />
        </Link>
      {/if}
    {/snippet}

    {#snippet footerActions()}
      {#if activeResource.url}
        <Link
          href={activeResource.url}
          download={activeResource.fileName ?? activeResource.label}
          class="resource-preview-toolbar-link"
        >
          <Download class="size-4" />
          <span>Download</span>
        </Link>
        <Link
          href="#"
          role="button"
          class="resource-preview-toolbar-link"
          onclick={(event: MouseEvent) => {
            event.preventDefault();
            void copyResourceLink();
          }}
        >
          <Copy class="size-4" />
          <span>Copy</span>
        </Link>
        <Link
          href={activeResource.url}
          target="_blank"
          rel="noreferrer"
          external
          class="resource-preview-toolbar-link"
        >
          <ExternalLink class="size-4" />
          <span>Open</span>
        </Link>
      {/if}
    {/snippet}

    {#if activeResource.kind === "image" && activeResource.previewUrl}
      <div class="resource-preview-media-stage">
        <img
          src={activeResource.previewUrl}
          alt={activeResource.fileName ?? activeResource.label}
          class="resource-preview-image"
        />
      </div>
    {:else}
      <div class="resource-preview-document-stack" data-kind={activeResource.kind}>
        <List class="resource-preview-summary-list" mediaList strongIos insetIos>
          <ListItem
            title={activeResource.label}
            subtitle={activeResource.fileName ?? activeResource.kind}
            text={resolvedSummary}
            after={resolvedExtension}
          >
            {#snippet media()}
              <div class="resource-preview-fallback-tile">
                <ResourceIconWithNumber
                  kind={resourceIconKind}
                  number={resourceIconNumber}
                  extension={activeResource.extension}
                  fileName={activeResource.fileName}
                  class="resource-preview-icon-atom"
                />
              </div>
            {/snippet}
          </ListItem>
        </List>

        {#if resolvedSummary}
          <BlockTitle>Summary</BlockTitle>
          <Block class="resource-preview-note-panel" strongIos insetIos aria-label="Resource summary">
            <p class="resource-preview-note-copy">{resolvedSummary}</p>
          </Block>
        {/if}

        <BlockTitle>Details</BlockTitle>
        <List class="resource-preview-facts-list" strongIos insetIos dividersIos aria-label="Resource details">
          <ListItem title="Reference" after={activeResource.label} />
          {#if activeResource.fileName}
            <ListItem title="File" after={activeResource.fileName} />
          {/if}
          {#if activeResource.mimeType}
            <ListItem title="Type" after={activeResource.mimeType} />
          {/if}
          {#if resolvedSize}
            <ListItem title="Size" after={resolvedSize} />
          {/if}
          {#if activeResource.tokenText}
            <ListItem title="Inline token" after={activeResource.tokenText} />
          {/if}
        </List>
      </div>
    {/if}
  </ResourcePreviewShell>
{/if}

<style>
  .resource-preview-media-stage {
    min-height: inherit;
    display: grid;
    place-items: center;
    padding-inline: 0.52rem;
  }

  .resource-preview-image {
    display: block;
    width: min(100%, 22.8rem);
    max-width: 100%;
    max-height: min(64vh, 32rem);
    border-radius: 1.2rem;
    object-fit: contain;
    box-shadow:
      0 18px 38px rgba(6, 10, 18, 0.18),
      0 0 0 1px rgba(255, 255, 255, 0.03);
  }

  :global(.resource-preview-open-link) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.85rem;
    min-width: 1.85rem;
    height: 1.85rem;
    border-radius: 999px;
    border: 0;
    background: rgba(255, 255, 255, 0.2);
    color: var(--f7-text-color, #111827);
    backdrop-filter: blur(18px);
  }

  .resource-preview-document-stack {
    width: min(100%, 22.5rem);
    margin: 0 auto;
    display: grid;
    align-content: start;
    gap: 0;
  }

  .resource-preview-fallback-tile {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    --resource-icon-tile-size: 2.46rem;
    width: 2.46rem;
    height: 2.46rem;
    line-height: 0;
  }

  :global(.resource-preview-summary-list.list),
  :global(.resource-preview-facts-list.list) {
    margin-block: 0 0.68rem;
  }

  :global(.resource-preview-summary-list .item-title) {
    font-weight: 650;
  }

  :global(.resource-preview-summary-list .item-after) {
    color: var(--f7-theme-color, #007aff);
    font-size: 0.68rem;
    font-weight: 700;
  }

  :global(.resource-preview-summary-list .item-text) {
    color: var(--f7-text-color-secondary, #475569);
    line-clamp: 2;
    -webkit-line-clamp: 2;
  }

  :global(.resource-preview-document-stack .block-title) {
    margin: 0.08rem 1rem 0.36rem;
    color: var(--f7-text-color-secondary, #64748b);
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  :global(.resource-preview-note-panel.block) {
    box-sizing: border-box;
    margin-block: 0 0.68rem;
    padding-block: 0.68rem;
  }

  .resource-preview-note-copy {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.44;
    color: #0f172a;
    word-break: break-word;
  }

  :global(.resource-preview-facts-list.list) {
    --f7-list-item-min-height: 2.15rem;
    --f7-list-item-title-font-size: 0.78rem;
    --f7-list-item-title-font-weight: 560;
    --f7-list-item-after-font-size: 0.76rem;
    --f7-list-item-after-text-color: #475569;
  }

  :global(.resource-preview-facts-list .item-after) {
    max-width: 12rem;
    overflow: hidden;
    text-align: end;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.resource-preview-toolbar-link) {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 4.55rem;
    min-height: 2.02rem;
    gap: 0.26rem;
    border: 1px solid rgba(60, 60, 67, 0.12);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.86);
    color: var(--f7-theme-color, #007aff);
    font-size: 0.68rem;
    font-weight: 650;
    line-height: 1;
    padding-inline: 0.58rem;
    text-decoration: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
    -webkit-tap-highlight-color: transparent;
  }

  :global(.resource-preview-toolbar-link svg) {
    width: 0.9rem;
    height: 0.9rem;
    flex: 0 0 auto;
  }

  :global(.resource-preview-toolbar-link:active) {
    transform: scale(0.98);
  }
</style>
