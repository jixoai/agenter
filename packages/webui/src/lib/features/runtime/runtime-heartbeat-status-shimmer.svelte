<script lang="ts">
	import { cn } from '$lib/utils.js';

	import type { RuntimeHeartbeatAttentionFocusSummary } from './runtime-heartbeat-statusbar-state';

	let {
		summary,
		class: className = '',
	}: {
		summary: RuntimeHeartbeatAttentionFocusSummary;
		class?: string;
	} = $props();

	const label = $derived(summary.labelParts.length > 0 ? summary.labelParts.join(' · ') : 'No tracked contexts');
</script>

<div
	class={cn(
		'runtime-heartbeat-shimmer inline-flex min-w-0 items-center rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground',
		summary.running ? 'runtime-heartbeat-shimmer--active' : 'bg-background/55',
		className,
	)}
	data-testid="runtime-heartbeat-shimmer"
	data-running={summary.running ? 'true' : 'false'}
	aria-live="polite"
>
	<span class="block truncate">
		{#if summary.running}
			Waiting for AI call · {label}
		{:else}
			{label}
		{/if}
	</span>
</div>

<style>
	.runtime-heartbeat-shimmer {
		position: relative;
		overflow: hidden;
	}

	.runtime-heartbeat-shimmer--active {
		background:
			linear-gradient(
				110deg,
				color-mix(in srgb, var(--background), transparent 18%) 20%,
				color-mix(in srgb, var(--foreground), transparent 92%) 38%,
				color-mix(in srgb, var(--background), transparent 18%) 56%
			),
			color-mix(in srgb, var(--background), transparent 22%);
		background-size: 220% 100%;
		animation: runtime-heartbeat-shimmer-slide 1.4s linear infinite;
	}

	@keyframes runtime-heartbeat-shimmer-slide {
		from {
			background-position: 200% 0;
		}

		to {
			background-position: -20% 0;
		}
	}
</style>
