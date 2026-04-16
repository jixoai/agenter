<script lang="ts">
	import { cn } from '$lib/utils.js';

	import type {
		RuntimeHeartbeatAttentionFocusSummary,
		RuntimeHeartbeatStatusState,
	} from './runtime-heartbeat-statusbar-state';

	let {
		status,
		summary,
		class: className = '',
	}: {
		status: RuntimeHeartbeatStatusState;
		summary: RuntimeHeartbeatAttentionFocusSummary;
		class?: string;
	} = $props();

	const label = $derived(
		[status.label, status.detail, ...summary.labelParts]
			.filter((value): value is string => typeof value === 'string' && value.length > 0)
			.join(' · '),
	);
</script>

<div
	class={cn(
		'runtime-heartbeat-shimmer inline-flex min-w-0 items-center rounded-full border px-3 py-1.5 text-xs',
		status.animated
			? 'runtime-heartbeat-shimmer--active border-border/60 text-foreground'
			: status.tone === 'destructive'
				? 'border-destructive/35 bg-destructive/8 text-destructive'
				: status.tone === 'warning'
					? 'border-amber-500/25 bg-amber-500/8 text-amber-900 dark:text-amber-200'
					: 'border-border/60 bg-background/55 text-muted-foreground',
		className,
	)}
	data-testid="runtime-heartbeat-shimmer"
	data-running={status.animated ? 'true' : 'false'}
	aria-live="polite"
>
	<span class="block truncate">{label}</span>
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
