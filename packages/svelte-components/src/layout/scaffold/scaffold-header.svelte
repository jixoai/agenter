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

<header
	bind:this={ref}
	data-slot="scaffold-header"
	class={cn("scaffold-header", className)}
	{...restProps}
>
	{@render children?.()}
</header>

<style>
	:where([data-slot="scaffold-header"]) {
		min-inline-size: 0;
	}
</style>
