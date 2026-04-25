<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import { cn, type WithElementRef } from '$lib/utils.js';

	type InputGroupLayout = 'inline' | 'block';

	let {
		ref = $bindable(null),
		layout = 'inline',
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		layout?: InputGroupLayout;
		children?: Snippet;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="input-group"
	data-layout={layout}
	class={cn(
		'border-input bg-background focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-w-0 overflow-hidden rounded-md border shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]',
		layout === 'block' ? 'grid' : 'flex items-stretch',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
