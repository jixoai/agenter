<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { CardHeader as F7CardHeader } from "../../framework7-components";
  import { cn, type WithElementRef } from "../utils";

  let {
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div data-slot="card-header" class={cn("web-chat-f7-card-header", className)} {...restProps}>
  <F7CardHeader>
    {@render children?.()}
  </F7CardHeader>
</div>

<style>
  .web-chat-f7-card-header :global(.card-header) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem;
    align-items: start;
    padding: 1rem 1rem 0.85rem;
  }

  .web-chat-f7-card-header :global(.card-header [data-slot="card-action"]) {
    justify-self: end;
  }
</style>
