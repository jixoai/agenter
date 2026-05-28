<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { cn, type WithElementRef } from "../utils";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLParagraphElement>> = $props();
</script>

<p bind:this={ref} data-slot="card-description" class={cn("web-chat-f7-card-description", className)} {...restProps}>
  {@render children?.()}
</p>

<style>
  .web-chat-f7-card-description {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--f7-text-color-secondary, #6b7280);
  }
</style>
