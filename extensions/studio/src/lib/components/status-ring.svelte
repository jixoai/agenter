<script lang="ts">
	import { cn } from '$lib/utils.js';

	let {
		value,
		total,
		label,
		pulse = false,
		class: className,
	}: {
		value: number;
		total: number;
		label: string;
		pulse?: boolean;
		class?: string;
	} = $props();

	const ratio = $derived(total > 0 ? Math.min(1, Math.max(0, value / total)) : 0);
	const circumference = 2 * Math.PI * 14;
	const dashOffset = $derived(circumference * (1 - ratio));
</script>

<div
	class={cn(
		'relative inline-flex size-10 items-center justify-center rounded-full',
		pulse && 'animate-pulse',
		className,
	)}
	aria-label={label}
	title={label}
>
	<svg viewBox="0 0 32 32" class="size-10 -rotate-90">
		<circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="3" class="fill-none opacity-15" />
		<circle
			cx="16"
			cy="16"
			r="14"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
			class="fill-none transition-[stroke-dashoffset] duration-200"
			stroke-dasharray={circumference}
			stroke-dashoffset={dashOffset}
		/>
	</svg>
	<span class="absolute text-[10px] font-semibold">{Math.min(value, total)}/{total}</span>
</div>
