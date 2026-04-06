<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import FileText from "@lucide/svelte/icons/file-text";
  import ImageIcon from "@lucide/svelte/icons/image";
  import Video from "@lucide/svelte/icons/video";
  import type { MessageAttachment } from "@agenter/message-system/types";

  import { formatAttachmentSize } from "./chat-attachment-utils";

  let {
    attachments,
    tone = "participant",
  }: {
    attachments: MessageAttachment[];
    tone?: "assistant" | "participant" | "viewer";
  } = $props();

  const iconFor = (kind: MessageAttachment["kind"]) => {
    switch (kind) {
      case "image":
        return ImageIcon;
      case "video":
        return Video;
      default:
        return FileText;
    }
  };
</script>

{#if attachments.length > 0}
  <div class="attachment-grid" part="message-attachments" data-tone={tone}>
    {#each attachments as attachment (attachment.assetId)}
      {@const AttachmentIcon = iconFor(attachment.kind)}
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        class="attachment-card"
        title={`${attachment.name} · ${formatAttachmentSize(attachment.sizeBytes)}`}
      >
        <div class="attachment-preview" data-kind={attachment.kind}>
          {#if attachment.kind === "image"}
            <img src={attachment.url} alt={attachment.name} class="h-full w-full object-cover" loading="lazy" />
          {:else}
            <AttachmentIcon class="size-5" />
          {/if}
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-semibold">{attachment.name}</div>
          <div class="attachment-meta">
            <AttachmentIcon class="size-3.5 shrink-0" />
            <span>{attachment.kind}</span>
            <span>·</span>
            <span>{formatAttachmentSize(attachment.sizeBytes)}</span>
          </div>
        </div>
        <ExternalLink class="size-3.5 shrink-0 opacity-60" />
      </a>
    {/each}
  </div>
{/if}

<style>
  .attachment-grid {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.85rem;
  }

  .attachment-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    border: 1px solid rgba(203, 213, 225, 0.56);
    border-radius: 1rem;
    padding: 0.55rem;
    text-decoration: none;
    color: inherit;
    background: rgba(248, 250, 252, 0.7);
  }

  .attachment-grid[data-tone="viewer"] .attachment-card {
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.08);
  }

  .attachment-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.25rem;
    height: 3.25rem;
    overflow: hidden;
    border-radius: 0.9rem;
    background: rgba(15, 23, 42, 0.08);
    color: #475569;
    flex-shrink: 0;
  }

  .attachment-preview[data-kind="video"],
  .attachment-preview[data-kind="file"] {
    background: rgba(15, 23, 42, 0.94);
    color: white;
  }

  .attachment-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.35rem;
    font-size: 0.68rem;
    color: rgba(71, 85, 105, 0.9);
  }

  .attachment-grid[data-tone="viewer"] .attachment-meta {
    color: rgba(255, 255, 255, 0.72);
  }
</style>
