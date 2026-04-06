<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import { cn, type WithElementRef } from "../internal/utils.js";

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
	data-layout-role="clip-surface"
	data-slot="clip-surface"
	class={cn("clip-surface", className)}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:where([data-layout-role="clip-surface"]) {
		display: grid;
		min-block-size: 0;
		min-inline-size: 0;
		overflow: hidden;
	}
</style>
