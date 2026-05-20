<script lang="ts">
	import { cn } from '$lib/utils.js';

	import { formatContextInteger } from './context-format';

	let {
		label,
		description,
		value,
		class: className = '',
	}: {
		label: string;
		description: string;
		value: number;
		class?: string;
	} = $props();
</script>

<div class={cn('flex items-center justify-between gap-3 rounded-xl border border-border/55 bg-background/70 px-3 py-2', className)}>
	<div class="grid gap-0.5">
		<div class="text-sm font-medium">{label}</div>
		<div class="text-[11px] text-muted-foreground">{description}</div>
	</div>
	<div class="font-mono text-sm text-foreground">{formatContextInteger(value)}</div>
</div>
