<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";
  import MessageSquareDot from "@lucide/svelte/icons/message-square-dot";

  import { Button as Framework7Button, Link, Segmented } from "./framework7-components";

  let {
    label,
    selectedText,
    commentText = "",
    sourceSummary = "",
    mode = null,
    onView,
    onEdit,
  }: {
    label: string;
    selectedText: string;
    commentText?: string;
    sourceSummary?: string;
    mode?: "view" | "edit" | null;
    onView?: (() => void) | undefined;
    onEdit?: (() => void) | undefined;
  } = $props();

  const indexLabel = $derived(label.replace(/^[^\d]*/u, "") || "1");
  const hasComment = $derived(commentText.trim().length > 0);
</script>

<div class="comment-anchor-badge" data-mode={mode ?? "closed"} part="comment-anchor-badge">
  <div class="comment-anchor-badge-row">
    <Link
      href="#"
      role="button"
      class="comment-anchor-serial"
      aria-label={`${label} comment anchor`}
      title={label}
      onclick={(event: MouseEvent) => {
        event.preventDefault();
        onView?.();
      }}
    >
      <MessageSquareDot class="comment-anchor-icon" />
      <span>{indexLabel}</span>
    </Link>

    <Segmented strong round class="comment-anchor-actions" role="tablist" aria-label={`${label} actions`}>
      <Framework7Button
        type="button"
        small
        round
        active={mode === "view"}
        role="tab"
        aria-selected={mode === "view"}
        aria-label={`View ${label}`}
        onclick={() => {
          onView?.();
        }}
      >
        <Eye class="comment-anchor-action-icon" />
        <span>View</span>
      </Framework7Button>
      <Framework7Button
        type="button"
        small
        round
        active={mode === "edit"}
        role="tab"
        aria-selected={mode === "edit"}
        aria-label={`Edit ${label}`}
        onclick={() => {
          onEdit?.();
        }}
      >
        <FilePenLine class="comment-anchor-action-icon" />
        <span>Edit</span>
      </Framework7Button>
    </Segmented>
  </div>

  {#if mode === "view" && hasComment}
    <section class="comment-anchor-detail" aria-label={`${label} detail`}>
      <div class="comment-anchor-detail-meta">{sourceSummary || selectedText}</div>
      <p>{commentText}</p>
    </section>
  {/if}
</div>

<style>
  .comment-anchor-badge {
    display: grid;
    gap: 0.22rem;
    margin: 0.24rem 0 0.04rem;
    max-width: 100%;
  }

  .comment-anchor-badge-row {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    min-width: 0;
    width: fit-content;
    max-width: 100%;
  }

  :global(.comment-anchor-serial.link) {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: 1.48rem;
    height: 1.48rem;
    min-width: 1.48rem;
    border-radius: 0.52rem;
    background: var(--f7-theme-color, #007aff);
    color: white;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0, 122, 255, 0.18);
    text-decoration: none;
  }

  :global(.comment-anchor-icon) {
    width: 0.86rem;
    height: 0.86rem;
    opacity: 0.92;
  }

  :global(.comment-anchor-serial span) {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 1rem;
    font-weight: 760;
    letter-spacing: 0;
    scale: 0.46;
    top: -0.15rem;
  }

  :global(.comment-anchor-actions.segmented) {
    width: auto;
    min-width: 3.95rem;
    max-width: 4.6rem;
    --f7-button-height: 1.38rem;
    --f7-button-font-size: 0.62rem;
    --f7-segmented-strong-padding: 2px;
    --f7-segmented-strong-between-buttons: 2px;
  }

  :global(.comment-anchor-actions .button) {
    gap: 0.16rem;
    padding-inline: 0.22rem;
  }

  :global(.comment-anchor-action-icon) {
    width: 0.68rem;
    height: 0.68rem;
  }

  :global(.comment-anchor-actions .button span) {
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

  .comment-anchor-detail {
    display: grid;
    gap: 0.16rem;
    border-radius: 0.74rem;
    background: color-mix(in srgb, var(--f7-theme-color, #007aff) 8%, white);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--f7-theme-color, #007aff) 15%, transparent);
    padding: 0.44rem 0.52rem;
  }

  .comment-anchor-detail-meta {
    overflow: hidden;
    color: var(--f7-text-color-secondary, #6b7280);
    font-size: 0.54rem;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .comment-anchor-detail p {
    margin: 0;
    color: var(--f7-text-color, #111827);
    font-size: 0.64rem;
    line-height: 1.34;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
