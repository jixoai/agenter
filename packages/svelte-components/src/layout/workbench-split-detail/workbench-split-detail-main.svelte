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

<section
	bind:this={ref}
	data-layout-role="workbench-split-detail-main"
	data-slot="workbench-split-detail-main"
	class={cn("workbench-split-detail-main", className)}
	{...restProps}
>
	{@render children?.()}
</section>
