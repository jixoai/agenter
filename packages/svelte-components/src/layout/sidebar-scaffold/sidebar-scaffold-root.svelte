<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import { cn, type WithElementRef } from "../../internal/utils.js";

	type SidebarScaffoldPadding = "page" | "none";

	let {
		ref = $bindable(null),
		class: className,
		padding = "page" as SidebarScaffoldPadding,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		padding?: SidebarScaffoldPadding;
		children?: Snippet;
	} = $props();
</script>

<div
	bind:this={ref}
	data-layout-role="sidebar-scaffold-root"
	data-slot="sidebar-scaffold-root"
	data-padding={padding}
	class={cn("sidebar-scaffold-root", className)}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:where([data-layout-role="sidebar-scaffold-root"]) {
		display: grid;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		gap: 1rem;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
	}

	:where([data-layout-role="sidebar-scaffold-root"][data-padding="page"]) {
		padding: 1rem;
	}

	@media (min-width: 768px) {
		:where([data-layout-role="sidebar-scaffold-root"][data-padding="page"]) {
			padding: 1.5rem;
		}

		:where([data-layout-role="sidebar-scaffold-root"]) {
			grid-template-columns: 18rem minmax(0, 1fr);
			grid-template-rows: none;
		}
	}
</style>
