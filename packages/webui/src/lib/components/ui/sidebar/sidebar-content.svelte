<script lang="ts">
	import ScrollView from "$lib/components/scroll-view.svelte";
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
	data-slot="sidebar-content"
	data-sidebar="content"
	class={cn("flex min-h-0 flex-1 flex-col", className)}
	{...restProps}
>
	<ScrollView
		class="min-h-0 flex-1 group-data-[collapsible=icon]:overflow-hidden"
		contentClass="flex min-h-full flex-col gap-2"
	>
		{@render children?.()}
	</ScrollView>
</div>
