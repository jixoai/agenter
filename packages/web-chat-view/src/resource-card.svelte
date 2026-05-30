<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import ImageIcon from "@lucide/svelte/icons/image";
  import MessageSquareDot from "@lucide/svelte/icons/message-square-dot";
  import Video from "@lucide/svelte/icons/video";
  import X from "@lucide/svelte/icons/x";

  import type { WebChatResourceReference } from "./types";

  let {
    resource,
    mode = "sent",
    tone = "participant",
    onRemove,
    onOpen,
  }: {
    resource: WebChatResourceReference;
    mode?: "pending" | "sent";
    tone?: "assistant" | "participant" | "viewer";
    onRemove?: (() => void) | undefined;
    onOpen?: (() => void) | undefined;
  } = $props();

  const ResourceIcon = $derived.by(() => {
    switch (resource.kind) {
      case "image":
        return ImageIcon;
      case "video":
        return Video;
      case "comment":
        return MessageSquareDot;
      default:
        return FileText;
    }
  });

  const extensionLabel = $derived(resource.extension?.toUpperCase() ?? resource.kind.toUpperCase());
  const commentIndexLabel = $derived(resource.label.replace(/^[^\d]*/u, "") || "1");
  const showPreviewImage = $derived(resource.kind === "image" && typeof resource.previewUrl === "string");
  const hasAction = $derived(
    mode === "pending" ? Boolean(onOpen || onRemove) : Boolean(resource.url || onOpen),
  );
</script>

<article class="resource-card" data-tone={tone} data-mode={mode} part="resource-card">
  <button
    type="button"
    class="resource-card-hitbox"
    part="resource-card-hitbox"
    aria-label={`Open ${resource.kind} resource ${resource.label}`}
    disabled={!hasAction}
    onclick={() => {
      if (mode === "pending" && onOpen) {
        onOpen();
        return;
      }
      if (mode === "pending") {
        return;
      }
      if (onOpen) {
        onOpen();
        return;
      }
      if (resource.url) {
        window.open(resource.url, "_blank", "noopener,noreferrer");
      }
    }}
  >
    <div class="resource-card-tile" data-kind={resource.kind} part="resource-card-tile">
      {#if showPreviewImage}
        <img src={resource.previewUrl} alt={resource.fileName ?? resource.label} class="resource-card-image" />
      {:else}
        <ResourceIcon class="resource-card-icon" />
        {#if resource.kind === "comment"}
          <span class="resource-card-comment-index">
            {commentIndexLabel}
          </span>
        {/if}
      {/if}
      {#if resource.kind !== "comment"}
        <span class="resource-card-extension">{extensionLabel}</span>
      {/if}
    </div>
    <span class="resource-card-copy sr-only">
      {resource.label} {resource.fileName ?? resource.detailText ?? resource.tokenText}
    </span>
  </button>

  {#if mode === "pending" && onRemove}
    <button
      type="button"
      class="resource-card-action"
      aria-label={`Remove ${resource.label}`}
      title={`Remove ${resource.label}`}
      onclick={onRemove}
    >
      <X class="size-3.5" />
    </button>
  {/if}
</article>

<style>
  .resource-card {
    position: relative;
    min-width: 0;
    display: block;
    line-height: 0;
  }

  .resource-card-hitbox {
    display: block;
    width: 2.28rem;
    height: 2.28rem;
    min-width: 2.28rem;
    border: 0;
    background: transparent;
    padding: 0;
    box-shadow: none;
    line-height: 0;
    font-size: 0;
  }

  .resource-card-hitbox:disabled {
    cursor: default;
    opacity: 1;
  }

  .resource-card-tile {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 11px;
    border: 1px solid rgba(60, 60, 67, 0.16);
    background: #f2f2f7;
    color: var(--f7-text-color, #111827);
    box-shadow: none;
  }

  .resource-card-tile[data-kind="image"] {
    background: #e9edf5;
    color: #475569;
  }

  .resource-card-tile[data-kind="video"],
  .resource-card-tile[data-kind="file"] {
    background: #f2f2f7;
  }

  .resource-card-tile[data-kind="comment"] {
    background:
      radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 54%),
      linear-gradient(180deg, #fbfbfd 0%, #ececf4 100%);
    color: #1f2937;
  }

  .resource-card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  :global(.resource-card-icon) {
    width: 0.84rem;
    height: 0.84rem;
  }

  .resource-card-tile[data-kind="comment"] :global(.resource-card-icon) {
    width: 1.06rem;
    height: 1.06rem;
    opacity: 0.22;
    transform: translateY(-0.08rem);
  }

  .resource-card-comment-index {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0;
    color: #0f172a;
    transform: translateY(0.02rem);
  }

  .resource-card-extension {
    position: absolute;
    left: 0.18rem;
    bottom: 0.18rem;
    font-size: 0.4rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
    border-radius: 999px;
    background: rgba(60, 60, 67, 0.78);
    color: white;
    padding: 0.05rem 0.2rem;
  }

  :global(.resource-card-action) {
    position: absolute;
    top: 0.1rem;
    right: 0.1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.9rem !important;
    height: 0.9rem !important;
    min-width: 0.9rem !important;
    min-height: 0.9rem !important;
    max-width: 0.9rem !important;
    max-height: 0.9rem !important;
    border-radius: 999px !important;
    border: 0;
    background: rgba(60, 60, 67, 0.82);
    color: white;
    padding: 0;
    box-shadow: none;
    z-index: 1;
  }

  :global(.resource-card-action:hover) {
    background: rgba(60, 60, 67, 0.92);
    color: white;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  @container (max-width: 34rem) {
    .resource-card-hitbox {
      width: 2.16rem;
      height: 2.16rem;
      min-width: 2.16rem;
    }
  }
</style>
