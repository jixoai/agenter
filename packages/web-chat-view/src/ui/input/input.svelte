<script lang="ts">
  import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";

  import { cn, type WithElementRef } from "../utils";

  type InputType = Exclude<HTMLInputTypeAttribute, "file">;
  type Props = WithElementRef<
    Omit<HTMLInputAttributes, "type"> &
      ({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
  >;

  let {
    ref = $bindable(null),
    value = $bindable(),
    type,
    files = $bindable(),
    class: className,
    "data-slot": dataSlot = "input",
    ...restProps
  }: Props = $props();
</script>

{#if type === "file"}
  <input
    bind:this={ref}
    data-slot={dataSlot}
    class={cn("input web-chat-f7-input web-chat-f7-input--file", className)}
    type="file"
    bind:files
    bind:value
    {...restProps}
  />
{:else}
  <input
    bind:this={ref}
    data-slot={dataSlot}
    class={cn("input web-chat-f7-input", className)}
    {type}
    bind:value
    {...restProps}
  />
{/if}

<style>
  :global(.web-chat-f7-input) {
    display: flex;
    width: 100%;
    min-width: 0;
    height: 2.25rem;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    background: color-mix(in srgb, var(--f7-card-bg-color, #fff) 94%, transparent);
    padding: 0.5rem 0.75rem;
    color: var(--f7-text-color, #111827);
    box-shadow: none;
    outline: none;
  }

  :global(.web-chat-f7-input::placeholder) {
    color: var(--f7-text-color-secondary, #9ca3af);
  }

  :global(.web-chat-f7-input:focus-visible) {
    border-color: color-mix(in srgb, var(--f7-theme-color, #007aff) 56%, white);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--f7-theme-color, #007aff) 18%, transparent);
  }

  :global(.web-chat-f7-input--file) {
    padding-top: 0.55rem;
    font-size: 0.92rem;
  }
</style>
