<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import * as Scaffold from "../scaffold/index.js";
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

<Scaffold.Header
	bind:ref
	data-slot="dialog-scaffold-header"
	class={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b px-6 py-5", className)}
	{...restProps}
>
	{@render children?.()}
</Scaffold.Header>
