<script lang="ts">
  import X from "@lucide/svelte/icons/x";

  import ResourceIconWithNumber, { type ResourceIconWithNumberKind } from "./components/resource-icon-with-number.svelte";
  import { resolveResourceIconNumber } from "./components/resource-icon-number";
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

  const iconKind = $derived.by<ResourceIconWithNumberKind>(() => {
    if (resource.kind === "comment") {
      return "comment";
    }
    if (resource.kind === "image") {
      return "image";
    }
    return "file";
  });
  const iconNumber = $derived(resolveResourceIconNumber(resource));
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
      <ResourceIconWithNumber
        kind={iconKind}
        number={iconNumber}
        extension={resource.extension}
        fileName={resource.fileName}
        class="resource-card-icon-atom"
      />
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
    width: var(--resource-card-size, 2.28rem);
    height: var(--resource-card-size, 2.28rem);
    min-width: var(--resource-card-size, 2.28rem);
    min-height: var(--resource-card-size, 2.28rem);
    max-width: var(--resource-card-size, 2.28rem);
    max-height: var(--resource-card-size, 2.28rem);
    display: block;
    line-height: 0;
    overflow: clip;
  }

  .resource-card-hitbox {
    display: block;
    width: var(--resource-card-size, 2.28rem);
    height: var(--resource-card-size, 2.28rem);
    min-width: var(--resource-card-size, 2.28rem);
    min-height: var(--resource-card-size, 2.28rem);
    max-width: var(--resource-card-size, 2.28rem);
    max-height: var(--resource-card-size, 2.28rem);
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
    overflow: visible;
    line-height: 0;
  }

  :global(.resource-card-icon-atom) {
    --resource-icon-tile-size: var(--resource-card-size, 2.28rem);
    display: inline-flex;
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
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: 0;
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
