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

<Scaffold.Root bind:ref data-dialog-scaffold-slot="root" class={cn("gap-0", className)} {...restProps}>
	{@render children?.()}
</Scaffold.Root>
