<script lang="ts">
  import type { Snippet } from "svelte";

  import { MessagebarAttachments } from "../framework7-components";
  import { cn } from "./utils";

  let {
    class: className,
    part = undefined,
    children,
  }: {
    class?: string;
    part?: string;
    children?: Snippet;
  } = $props();
</script>

<MessagebarAttachments class={cn(className)} {part}>
  {@render children?.()}
</MessagebarAttachments>
