<script lang="ts">
  import ResourceIconWithNumber, { type ResourceIconWithNumberKind } from "./resource-icon-with-number.svelte";
  import { resolveResourceIconNumber } from "./resource-icon-number";
  import type { WebChatResourceReference } from "../types";

  let {
    resource,
    tone = "participant",
    onOpen,
  }: {
    resource: WebChatResourceReference;
    tone?: "assistant" | "participant" | "viewer";
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
  const tokenTitle = $derived(resource.fileName ?? resource.detailText ?? resource.tokenText ?? resource.label);
</script>

<span
  role="button"
  tabindex="0"
  class="message-resource-token"
  data-tone={tone}
  data-kind={resource.kind}
  data-resource-number={iconNumber}
  part="message-resource-token"
  aria-label={`Open ${resource.kind} resource ${resource.label}`}
  title={tokenTitle}
  onclick={() => {
    onOpen?.();
  }}
  onkeydown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen?.();
    }
  }}
>
  <ResourceIconWithNumber
    kind={iconKind}
    number={iconNumber}
    extension={resource.extension}
    fileName={resource.fileName}
    size="inline"
  />
</span>

<style>
  .message-resource-token {
    display: inline-flex;
    align-items: baseline;
    inline-size: auto;
    max-inline-size: 100%;
    border: 0;
    border-radius: 0.38em;
    padding: 0 0.04em;
    background: transparent;
    color: var(--f7-theme-color, #007aff);
    font: inherit;
    font-size: 1em;
    font-weight: 500;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: -0.16em;
    cursor: pointer;
  }

  .message-resource-token[data-tone="viewer"] {
    color: rgba(255, 255, 255, 0.9);
  }

  .message-resource-token:hover {
    background: color-mix(in srgb, currentColor 10%, transparent);
  }

  .message-resource-token:focus-visible {
    background: color-mix(in srgb, currentColor 12%, transparent);
    outline: 2px solid color-mix(in srgb, currentColor 24%, transparent);
    outline-offset: 2px;
  }
</style>
