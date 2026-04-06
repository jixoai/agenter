<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import ScrollView from "../../scroll-view.svelte";
	import { cn, type WithElementRef } from "../../internal/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		viewportClass = "",
		contentClass = "",
		orientation = "vertical",
		viewportTestId = undefined,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		viewportClass?: string;
		contentClass?: string;
		orientation?: "vertical" | "horizontal" | "both";
		viewportTestId?: string;
		children?: Snippet;
	} = $props();
</script>

<div
	bind:this={ref}
	data-layout-role="scaffold-scroll-body"
	data-slot="scaffold-scroll-body"
	class={cn("scaffold-scroll-body", className)}
	{...restProps}
>
	<ScrollView class="scaffold-scroll-view" {viewportClass} {contentClass} {orientation} {viewportTestId}>
		{@render children?.()}
	</ScrollView>
</div>

<style>
	:where([data-layout-role="scaffold-scroll-body"]) {
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}

	.scaffold-scroll-view {
		block-size: 100%;
	}
</style>
