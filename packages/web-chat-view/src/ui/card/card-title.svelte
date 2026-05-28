<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "../utils";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div bind:this={ref} data-slot="card-title" class={cn("web-chat-f7-card-title", className)} {...restProps}>
  {@render children?.()}
</div>

<style>
  .web-chat-f7-card-title {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.28;
    color: var(--f7-text-color, #111827);
  }
</style>
