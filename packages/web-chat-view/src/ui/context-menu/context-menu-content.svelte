<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

  import { cn } from "../utils";

  let {
    ref = $bindable(null),
    sideOffset = 8,
    align = "start",
    class: className,
    ...restProps
  }: ContextMenuPrimitive.ContentProps & {
    class?: string;
  } = $props();
</script>

<ContextMenuPrimitive.Portal>
  <ContextMenuPrimitive.Content
    bind:ref
    {sideOffset}
    {align}
    data-slot="context-menu-content"
    class={cn(
      "z-50 min-w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_24px_64px_rgba(15,23,42,0.2)] outline-none data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...restProps}
  />
</ContextMenuPrimitive.Portal>
