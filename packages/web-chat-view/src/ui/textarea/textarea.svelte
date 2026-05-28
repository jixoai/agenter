<script lang="ts">
  import type { HTMLTextareaAttributes } from "svelte/elements";

  import { cn, type WithElementRef, type WithoutChildren } from "../utils";

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    "data-slot": dataSlot = "textarea",
    ...restProps
  }: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<textarea
  bind:this={ref}
  data-slot={dataSlot}
  class={cn("input web-chat-f7-textarea", className)}
  bind:value
  {...restProps}
></textarea>

<style>
  :global(.web-chat-f7-textarea) {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 4rem;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    background: color-mix(in srgb, var(--f7-card-bg-color, #fff) 94%, transparent);
    padding: 0.65rem 0.75rem;
    color: var(--f7-text-color, #111827);
    box-shadow: none;
    outline: none;
    resize: vertical;
  }

  :global(.web-chat-f7-textarea::placeholder) {
    color: var(--f7-text-color-secondary, #9ca3af);
  }

  :global(.web-chat-f7-textarea:focus-visible) {
    border-color: color-mix(in srgb, var(--f7-theme-color, #007aff) 56%, white);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--f7-theme-color, #007aff) 18%, transparent);
  }
</style>
