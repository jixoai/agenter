<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import { cn, type WithElementRef } from '$lib/utils.js';

	type InputGroupAddonAlign = 'inline-start' | 'inline-end' | 'block-start' | 'block-end';

	let {
		ref = $bindable(null),
		align = 'inline-end',
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		align?: InputGroupAddonAlign;
		children?: Snippet;
	} = $props();

	const alignClassName = $derived.by(() => {
		switch (align) {
			case 'inline-start':
				return 'order-first border-r px-1.5';
			case 'block-start':
				return 'order-first border-b px-1.5 py-1';
			case 'block-end':
				return 'order-last border-t px-1.5 py-1';
			default:
				return 'order-last border-l px-1.5';
		}
	});
</script>

<div
	bind:this={ref}
	data-slot="input-group-addon"
	data-align={align}
	class={cn('flex min-h-9 shrink-0 items-center gap-1 bg-muted/35 text-muted-foreground', alignClassName, className)}
	{...restProps}
>
	{@render children?.()}
</div>
