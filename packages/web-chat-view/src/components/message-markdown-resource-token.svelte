<script lang="ts">
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

  const tokenText = $derived(resource.tokenText || `[^${resource.label}]`);
</script>

<span
  role="button"
  tabindex="0"
  class="message-resource-token"
  data-tone={tone}
  data-kind={resource.kind}
  part="message-resource-token"
  aria-label={`Open ${resource.kind} resource ${resource.label}`}
  title={resource.fileName ?? resource.detailText ?? resource.label}
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
  {tokenText}
</span>

<style>
  .message-resource-token {
    display: inline;
    inline-size: fit-content;
    max-inline-size: fit-content;
    border: 0;
    border-radius: 4px;
    padding: 0 0.03em;
    background: transparent;
    color: var(--f7-theme-color, #007aff);
    font: inherit;
    font-size: 0.9em;
    font-weight: 500;
    line-height: inherit;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: baseline;
    cursor: pointer;
  }

  .message-resource-token[data-tone="viewer"] {
    color: rgba(255, 255, 255, 0.9);
  }

  .message-resource-token:hover {
    text-decoration-line: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.14em;
  }

  .message-resource-token:focus-visible {
    background: color-mix(in srgb, currentColor 12%, transparent);
    outline: 2px solid color-mix(in srgb, currentColor 24%, transparent);
    outline-offset: 2px;
  }
</style>
