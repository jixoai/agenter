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

<div
	bind:this={ref}
	data-layout-role="scaffold-body"
	data-slot="scaffold-body"
	class={cn("scaffold-body", className)}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:where([data-layout-role="scaffold-body"]) {
		display: grid;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}
</style>
