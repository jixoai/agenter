<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	export interface ConversationContentProps extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import { getStickToBottomContext } from './stick-to-bottom-context.svelte.js';

	let {
		class: className = '',
		children,
		ref = $bindable<HTMLDivElement | null>(null),
		...restProps
	}: ConversationContentProps = $props();

	const context = getStickToBottomContext();
	let viewportRef = $state<HTMLDivElement | null>(null);

	$effect(() => {
		context.setElement(viewportRef);
		return () => {
			context.setElement(null);
		};
	});
</script>

<div
	bind:this={ref}
	class={cn('min-h-0 flex-1 overflow-hidden', className)}
	{...restProps}
>
	<ScrollView class="h-full" bind:viewportRef={viewportRef}>
		{@render children?.()}
	</ScrollView>
</div>
