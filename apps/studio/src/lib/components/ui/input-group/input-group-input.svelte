<script lang="ts">
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from 'svelte/elements';

	import { cn, type WithElementRef } from '$lib/utils.js';

	type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;
	type Props = WithElementRef<Omit<HTMLInputAttributes, 'type'> & { type?: InputType }>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		class: className,
		'data-slot': dataSlot = 'input-group-input',
		...restProps
	}: Props = $props();
</script>

<input
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		'placeholder:text-muted-foreground flex h-9 min-w-0 flex-1 bg-transparent px-3 py-1 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		className,
	)}
	{type}
	bind:value
	{...restProps}
/>
