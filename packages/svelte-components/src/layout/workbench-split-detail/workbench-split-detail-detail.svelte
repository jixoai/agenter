<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import { cn, type WithElementRef } from "../../internal/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>, HTMLElement> & {
		children?: Snippet;
	} = $props();
</script>

<aside
	bind:this={ref}
	data-layout-role="workbench-split-detail-detail"
	data-slot="workbench-split-detail-detail"
	class={cn("workbench-split-detail-detail", className)}
	{...restProps}
>
	{@render children?.()}
</aside>
