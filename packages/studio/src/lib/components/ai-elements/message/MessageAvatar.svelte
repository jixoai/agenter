<script lang="ts">
	import type { ComponentProps } from 'svelte';

	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar/index.js';
	import { cn } from '$lib/utils.js';

	type MessageAvatarProps = ComponentProps<typeof Avatar> & {
		src?: string | null;
		name?: string;
	};

	let { src = null, name = 'AI', class: className = '', ...restProps }: MessageAvatarProps = $props();

	const fallbackText = $derived(name.slice(0, 2).toUpperCase());
</script>

<Avatar class={cn('size-8 shrink-0 ring-1 ring-border/70', className)} {...restProps}>
	{#if src}
		<AvatarImage alt={name} class="mt-0 mb-0" src={src} />
	{/if}
	<AvatarFallback>{fallbackText}</AvatarFallback>
</Avatar>
