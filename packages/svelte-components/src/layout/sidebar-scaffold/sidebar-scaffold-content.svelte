<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import { cn, type WithElementRef } from "../../internal/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		children?: Snippet;
	} = $props();
</script>

<div
	bind:this={ref}
	data-layout-role="sidebar-scaffold-content"
	data-slot="sidebar-scaffold-content"
	class={cn("sidebar-scaffold-content", className)}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:where([data-layout-role="sidebar-scaffold-content"]) {
		display: grid;
		min-block-size: 0;
		min-inline-size: 0;
	}
</style>
