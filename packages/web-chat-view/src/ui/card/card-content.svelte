<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { CardContent as F7CardContent } from "../../framework7-components";
  import { cn, type WithElementRef } from "../utils";

  let {
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div data-slot="card-content" class={cn("web-chat-f7-card-content", className)} {...restProps}>
  <F7CardContent>
    {@render children?.()}
  </F7CardContent>
</div>

<style>
  .web-chat-f7-card-content :global(.card-content) {
    padding: 0 1rem 1rem;
  }
</style>
