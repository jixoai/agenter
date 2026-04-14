<script lang="ts">
	import Bookmark from '@lucide/svelte/icons/bookmark';

	import { cn } from '$lib/utils.js';

	let { class: className = '', children, size = 16, ...restProps } = $props<{
		class?: string;
		children?: import('svelte').Snippet;
		size?: number;
	}>();
</script>

{#if children}
	{@render children?.()}
{:else}
	<Bookmark class={cn('size-4 shrink-0', className)} {size} {...restProps} />
{/if}
