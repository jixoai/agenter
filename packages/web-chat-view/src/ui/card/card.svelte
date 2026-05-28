<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { Card as F7Card } from "../../framework7-components";
  import { cn, type WithElementRef } from "../utils";

  let {
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div class={cn("web-chat-f7-card", className)} {...restProps}>
  <F7Card>
    {@render children?.()}
  </F7Card>
</div>

<style>
  .web-chat-f7-card :global(.card) {
    margin: 0;
    border-radius: 20px;
    box-shadow: none;
    overflow: hidden;
  }
</style>
