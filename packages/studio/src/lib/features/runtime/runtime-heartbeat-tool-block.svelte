<script lang="ts">
	import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '$lib/components/ai-elements/tool/index.js';
	import { cn } from '$lib/utils.js';

	import type { HeartbeatDisplayBlock } from './runtime-heartbeat-parts';
	import { getHeartbeatToolPreview } from './runtime-heartbeat-parts';

	let {
		block,
		forceOpen = false,
		layoutMode = 'detailed',
	}: {
		block: Extract<HeartbeatDisplayBlock, { kind: 'tool' }>;
		forceOpen?: boolean;
		layoutMode?: 'compact' | 'detailed';
	} = $props();

	const formatTimedDuration = (durationMs: number): string => {
		const totalSeconds = Math.max(1, Math.ceil(durationMs / 1_000));
		if (totalSeconds < 60) {
			return `${totalSeconds}s`;
		}
		const totalMinutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		if (totalMinutes < 60) {
			return seconds === 0 ? `${totalMinutes}m` : `${totalMinutes}m ${seconds}s`;
		}
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
	};

	const shouldOpen = $derived(forceOpen || block.state !== 'output-available');
	const preview = $derived(getHeartbeatToolPreview(block.input));
	const isCompact = $derived(layoutMode === 'compact');
	const activeTimingHint = $derived(
		block.state === 'input-available' &&
			(block.visualHint?.kind === 'shell-sleep' || block.visualHint?.kind === 'shell-timeout')
			? block.visualHint
			: null,
	);
	let nowMs = $state(Date.now());
	const timingElapsedMs = $derived(
		activeTimingHint ? Math.max(0, nowMs - activeTimingHint.startedAt) : 0,
	);
	const timingRemainingMs = $derived(
		activeTimingHint ? Math.max(0, activeTimingHint.durationMs - timingElapsedMs) : 0,
	);
	const timingProgressRatio = $derived(
		activeTimingHint ? Math.min(1, timingElapsedMs / activeTimingHint.durationMs) : 0,
	);
	const timingProgressStyle = $derived(`transform: scaleX(${timingProgressRatio.toFixed(4)});`);
	const timingProgressState = $derived(timingRemainingMs > 0 ? 'running' : 'elapsed');
	const timingLabel = $derived(activeTimingHint?.kind === 'shell-timeout' ? 'timeout' : 'sleep');
	const statusDetail = $derived(
		activeTimingHint
			? timingRemainingMs > 0
				? `${timingLabel} ${formatTimedDuration(timingRemainingMs)} left`
				: `${timingLabel} elapsed`
			: null,
	);

	$effect(() => {
		if (!activeTimingHint || typeof window === 'undefined') {
			return;
		}
		nowMs = Date.now();
		const interval = window.setInterval(() => {
			nowMs = Date.now();
		}, 500);
		return () => {
			window.clearInterval(interval);
		};
	});
</script>

<Tool class={cn('min-w-0', activeTimingHint ? 'runtime-heartbeat-timed-tool' : '')} framed={!isCompact} open={shouldOpen}>
	<ToolHeader
		class={isCompact ? 'px-0 py-0.5' : ''}
		type={block.tool}
		state={block.state}
		{preview}
		{statusDetail}
	/>
	{#if activeTimingHint}
		<div
			aria-hidden="true"
			class="runtime-heartbeat-time-progress"
			data-testid={`runtime-heartbeat-tool-time-progress-${block.key}`}
			data-timing-progress-state={timingProgressState}
			data-timing-hint-kind={activeTimingHint.kind}
		>
			<div class="runtime-heartbeat-time-progress__fill" style={timingProgressStyle}></div>
		</div>
	{/if}
	<ToolContent class={cn('runtime-heartbeat-tool-content', isCompact ? 'gap-1 pt-1' : '')}>
		<ToolInput class={isCompact ? 'px-0 pb-0' : ''} input={block.input} plain />
		<ToolOutput class={isCompact ? 'px-0 pb-0' : ''} output={block.output} errorText={block.errorText} plain />
	</ToolContent>
</Tool>

<style>
	:global(.runtime-heartbeat-timed-tool) {
		position: relative;
	}

	:global(.runtime-heartbeat-timed-tool > summary),
	:global(.runtime-heartbeat-timed-tool > .runtime-heartbeat-tool-content) {
		position: relative;
		z-index: 1;
	}

	.runtime-heartbeat-time-progress {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		border-radius: inherit;
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--primary), transparent 92%),
				color-mix(in srgb, var(--primary), transparent 97%)
			),
			linear-gradient(180deg, transparent, color-mix(in srgb, var(--primary), transparent 96%));
		opacity: 0.95;
	}

	.runtime-heartbeat-time-progress__fill {
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		width: 100%;
		transform-origin: left center;
		border-radius: inherit;
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--primary), transparent 82%),
				color-mix(in srgb, var(--primary), transparent 88%)
			),
			linear-gradient(
				115deg,
				transparent 0%,
				color-mix(in srgb, white, transparent 72%) 44%,
				transparent 78%
			);
		transition: transform 420ms linear;
	}

	.runtime-heartbeat-time-progress[data-timing-progress-state='running'] .runtime-heartbeat-time-progress__fill {
		animation: runtime-heartbeat-time-wash 1.6s linear infinite;
	}

	@keyframes runtime-heartbeat-time-wash {
		from {
			background-position:
				0 0,
				-18rem 0;
		}
		to {
			background-position:
				0 0,
				18rem 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.runtime-heartbeat-time-progress__fill {
			transition: none;
			animation: none;
		}
	}
</style>
