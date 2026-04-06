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

<section
	bind:this={ref}
	data-layout-role="scaffold-root"
	data-slot="scaffold-root"
	class={cn("scaffold-root", className)}
	{...restProps}
>
	{@render children?.()}
</section>

<style>
	:where([data-layout-role="scaffold-root"]) {
		display: grid;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		grid-template-rows: auto minmax(0, 1fr) auto;
	}

	:global(:where([data-layout-role="scaffold-root"]) > [data-slot="scaffold-header"]) {
		grid-row: 1;
	}

	:global(:where([data-layout-role="scaffold-root"]) > [data-slot="scaffold-body"]),
	:global(:where([data-layout-role="scaffold-root"]) > [data-slot="scaffold-scroll-body"]) {
		grid-row: 2;
	}

	:global(:where([data-layout-role="scaffold-root"]) > [data-slot="scaffold-footer"]) {
		grid-row: 3;
	}
</style>
