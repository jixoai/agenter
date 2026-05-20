<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { cn } from '$lib/utils.js';

	let {
		label = 'Loading',
		class: className = '',
	}: {
		label?: string;
		class?: string;
	} = $props();
</script>

<div class={cn('inline-flex items-center gap-2 text-xs text-muted-foreground', className)} role="status" aria-live="polite">
	<LoaderCircle class="size-4 animate-spin" />
	<span>{label}</span>
</div>
