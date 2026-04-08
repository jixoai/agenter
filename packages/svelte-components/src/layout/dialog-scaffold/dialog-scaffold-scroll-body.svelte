<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import * as Scaffold from "../scaffold/index.js";
	import { cn, type WithElementRef } from "../../internal/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		viewportClass = "",
		contentClass = "",
		orientation = "vertical",
		viewportTestId = undefined,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		viewportClass?: string;
		contentClass?: string;
		orientation?: "vertical" | "horizontal" | "both";
		viewportTestId?: string;
		children?: Snippet;
	} = $props();
</script>

<Scaffold.ScrollBody
	bind:ref
	data-dialog-scaffold-slot="scroll-body"
	class={cn("min-w-0", className)}
	viewportClass={cn("px-0", viewportClass)}
	{contentClass}
	{orientation}
	{viewportTestId}
	{...restProps}
>
	{@render children?.()}
</Scaffold.ScrollBody>
