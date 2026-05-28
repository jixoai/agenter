<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { CardFooter as F7CardFooter } from "../../framework7-components";
  import { cn, type WithElementRef } from "../utils";

  let {
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div data-slot="card-footer" class={cn("web-chat-f7-card-footer", className)} {...restProps}>
  <F7CardFooter>
    {@render children?.()}
  </F7CardFooter>
</div>

<style>
  .web-chat-f7-card-footer :global(.card-footer) {
    display: flex;
    align-items: center;
    padding: 0.85rem 1rem 1rem;
  }
</style>
