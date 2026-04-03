<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		headerClass = '',
		bodyClass = '',
		header,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> & {
		header?: Snippet;
		headerClass?: string;
		bodyClass?: string;
		children?: Snippet;
	} = $props();
</script>

<section
	bind:this={ref}
	data-slot="panel-shell"
	class={cn(
		'bg-card text-card-foreground grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] rounded-xl border shadow-sm',
		className,
	)}
	{...restProps}
>
	{#if header}
		<header data-slot="panel-shell-header" class={cn('grid gap-2 border-b px-6 py-4', headerClass)}>
			{@render header()}
		</header>
	{/if}

	<div data-slot="panel-shell-body" class={cn('grid min-w-0', bodyClass)}>
		{@render children?.()}
	</div>
</section>
