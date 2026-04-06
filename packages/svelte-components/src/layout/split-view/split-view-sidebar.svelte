<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import { cn, type WithElementRef } from "../../internal/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> & {
		children?: Snippet;
	} = $props();
</script>

<aside
	bind:this={ref}
	data-layout-role="split-view-sidebar"
	data-slot="split-view-sidebar"
	class={cn("split-view-sidebar", className)}
	{...restProps}
>
	{@render children?.()}
</aside>

<style>
	:where([data-layout-role="split-view-sidebar"]) {
		display: grid;
		min-block-size: 0;
		min-inline-size: 0;
	}
</style>
