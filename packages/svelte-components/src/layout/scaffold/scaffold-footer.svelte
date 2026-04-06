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

<footer
	bind:this={ref}
	data-slot="scaffold-footer"
	class={cn("scaffold-footer", className)}
	{...restProps}
>
	{@render children?.()}
</footer>

<style>
	:where([data-slot="scaffold-footer"]) {
		min-inline-size: 0;
	}
</style>
