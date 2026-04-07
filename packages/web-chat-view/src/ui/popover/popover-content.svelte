<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";

  import { cn } from "../utils";

  let {
    ref = $bindable(null),
    sideOffset = 8,
    align = "end",
    class: className,
    ...restProps
  }: PopoverPrimitive.ContentProps & {
    class?: string;
  } = $props();
</script>

<PopoverPrimitive.Portal>
  <PopoverPrimitive.Content
    bind:ref
    {sideOffset}
    {align}
    data-slot="popover-content"
    class={cn(
      "z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_24px_64px_rgba(15,23,42,0.18)] outline-none data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...restProps}
  />
</PopoverPrimitive.Portal>

<style>
  :global([data-slot="popover-content"]) {
    inline-size: min(
      var(--popover-inline-size, 22rem),
      var(--popover-max-inline-size, calc(100vw - 2rem))
    );
    max-inline-size: var(--popover-max-inline-size, calc(100vw - 2rem));
  }
</style>
