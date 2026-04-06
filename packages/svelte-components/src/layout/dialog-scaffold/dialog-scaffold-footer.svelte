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

<Scaffold.Footer
	bind:ref
	data-slot="dialog-scaffold-footer"
	class={cn("flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4", className)}
	{...restProps}
>
	{@render children?.()}
</Scaffold.Footer>
