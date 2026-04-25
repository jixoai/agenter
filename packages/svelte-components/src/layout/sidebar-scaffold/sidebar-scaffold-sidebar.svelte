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
	data-layout-role="sidebar-scaffold-sidebar"
	data-slot="sidebar-scaffold-sidebar"
	class={cn("sidebar-scaffold-sidebar", className)}
	{...restProps}
>
	{@render children?.()}
</aside>

<style>
	:where([data-layout-role="sidebar-scaffold-sidebar"]) {
		display: grid;
		min-block-size: 0;
		min-inline-size: 0;
	}
</style>
