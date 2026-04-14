<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	export interface ConversationContentProps extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { getStickToBottomContext } from './stick-to-bottom-context.svelte.js';

	let {
		class: className = '',
		children,
		ref = $bindable<HTMLDivElement | null>(null),
		...restProps
	}: ConversationContentProps = $props();

	const context = getStickToBottomContext();

	$effect(() => {
		context.setElement(ref);
		return () => {
			context.setElement(null);
		};
	});
</script>

<div
	bind:this={ref}
	class={cn('min-h-0 flex-1 overflow-y-auto', className)}
	{...restProps}
>
	{@render children?.()}
</div>
