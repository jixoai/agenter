<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';

	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(''),
		class: className = '',
		ariaLabel,
		children,
		disabled = false,
		loop = true,
		rovingFocus = true,
	}: {
		ref?: HTMLDivElement | null;
		value?: string;
		class?: string;
		ariaLabel?: string;
		children?: import('svelte').Snippet;
		disabled?: boolean;
		loop?: boolean;
		rovingFocus?: boolean;
	} = $props();
</script>

<ToggleGroupPrimitive.Root
	bind:ref
	bind:value
	type="single"
	aria-label={ariaLabel}
	{disabled}
	{loop}
	{rovingFocus}
	data-slot="toggle-group"
	class={cn(
		'inline-flex h-7 items-center rounded-full border border-border/60 bg-background/80 p-0.5 shadow-sm',
		className,
	)}
>
	{@render children?.()}
</ToggleGroupPrimitive.Root>
