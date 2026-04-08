<script lang="ts">
	import { ScrollView } from "@agenter/svelte-components";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<div
	bind:this={ref}
	data-layout-role="sidebar-content"
	data-slot="sidebar-content"
	data-sidebar="content"
	class={cn("grid flex-1", className)}
	{...restProps}
>
	<ScrollView class="h-full" contentClass="flex min-h-full flex-col gap-2">
		{@render children?.()}
	</ScrollView>
</div>

<style>
	[data-layout-role="sidebar-content"] {
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}
</style>
