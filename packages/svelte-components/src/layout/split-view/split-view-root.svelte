<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import { cn, type WithElementRef } from "../../internal/utils.js";

	type SplitViewVariant = "sidebar-content" | "content-detail" | "sidebar-content-detail";
	type SplitViewPadding = "page" | "none";

	let {
		ref = $bindable(null),
		class: className,
		variant = "sidebar-content" as SplitViewVariant,
		padding = "page" as SplitViewPadding,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		variant?: SplitViewVariant;
		padding?: SplitViewPadding;
		children?: Snippet;
	} = $props();
</script>

<div
	bind:this={ref}
	data-layout-role="split-view-root"
	data-slot="split-view-root"
	data-variant={variant}
	data-padding={padding}
	class={cn("split-view-root", className)}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:where([data-layout-role="split-view-root"]) {
		display: grid;
		min-block-size: 0;
		min-inline-size: 0;
		block-size: 100%;
		gap: 1rem;
		grid-template-columns: minmax(0, 1fr);
	}

	:where([data-layout-role="split-view-root"][data-padding="page"]) {
		padding: 1rem;
	}

	:where([data-layout-role="split-view-root"][data-variant="sidebar-content"]) {
		grid-template-rows: auto minmax(0, 1fr);
	}

	:where([data-layout-role="split-view-root"][data-variant="content-detail"]) {
		display: flex;
		flex-direction: column;
		block-size: auto;
	}

	:where([data-layout-role="split-view-root"][data-variant="sidebar-content-detail"]) {
		display: flex;
		flex-direction: column;
		block-size: auto;
	}

	@media (min-width: 768px) {
		:where([data-layout-role="split-view-root"][data-padding="page"]) {
			padding: 1.5rem;
		}

		:where([data-layout-role="split-view-root"][data-variant="sidebar-content"]) {
			grid-template-columns: 18rem minmax(0, 1fr);
			grid-template-rows: none;
		}
	}

	@media (min-width: 1024px) {
		:where([data-layout-role="split-view-root"][data-variant="content-detail"]) {
			display: grid;
			block-size: 100%;
			grid-template-columns: minmax(0, 1fr) 20rem;
			grid-template-rows: none;
		}
	}

	@media (min-width: 1280px) {
		:where([data-layout-role="split-view-root"][data-variant="sidebar-content-detail"]) {
			display: grid;
			block-size: 100%;
			grid-template-columns: 18rem minmax(0, 1fr);
			grid-template-rows: none;
		}
	}

	@media (min-width: 1536px) {
		:where([data-layout-role="split-view-root"][data-variant="sidebar-content-detail"]) {
			grid-template-columns: 18rem minmax(0, 1fr) 24rem;
		}
	}
</style>
