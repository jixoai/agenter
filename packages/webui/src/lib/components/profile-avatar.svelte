<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { cn } from '$lib/utils.js';

	let {
		label,
		src = null,
		class: className,
	}: {
		label: string;
		src?: string | null;
		class?: string;
	} = $props();

	const initials = $derived(
		label
			.split(/\s+/u)
			.filter(Boolean)
			.slice(0, 2)
			.map((segment) => segment[0]?.toUpperCase() ?? '')
			.join('') || '?',
	);
</script>

<Avatar.Root class={cn('size-9 rounded-xl border border-border/80 bg-muted/50', className)}>
	{#if src}
		<Avatar.Image src={src} alt={label} class="object-cover" />
	{/if}
	<Avatar.Fallback class="bg-primary/10 text-primary text-xs font-semibold">{initials}</Avatar.Fallback>
</Avatar.Root>
