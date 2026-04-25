<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		'data-slot': dataSlot = 'input-group-textarea',
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes, HTMLTextAreaElement>> = $props();
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		'placeholder:text-muted-foreground flex min-h-16 w-full min-w-0 resize-y bg-transparent px-3 py-2 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		className,
	)}
	bind:value
	{...restProps}
></textarea>
