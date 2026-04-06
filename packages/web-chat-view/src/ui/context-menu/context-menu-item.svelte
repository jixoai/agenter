<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

  import { cn } from "../utils";

  let {
    ref = $bindable(null),
    class: className,
    variant = "default",
    ...restProps
  }: ContextMenuPrimitive.ItemProps & {
    class?: string;
    variant?: "default" | "destructive";
  } = $props();
</script>

<ContextMenuPrimitive.Item
  bind:ref
  data-slot="context-menu-item"
  data-variant={variant}
  class={cn(
    "group relative flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-950 data-[variant=destructive]:text-rose-700 data-[variant=destructive][data-highlighted]:bg-rose-50 data-[variant=destructive][data-highlighted]:text-rose-900",
    className,
  )}
  {...restProps}
/>
