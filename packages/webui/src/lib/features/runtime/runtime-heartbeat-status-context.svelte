<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	import type { RuntimeHeartbeatContextState } from './runtime-heartbeat-statusbar-state';

	let {
		state,
		class: className = '',
	}: {
		state: RuntimeHeartbeatContextState;
		class?: string;
	} = $props();

	const integerFormatter = new Intl.NumberFormat('en-US');
	const percentFormatter = new Intl.NumberFormat('en-US', {
		style: 'percent',
		maximumFractionDigits: 1,
	});
	const currencyFormatter = (currency: string) =>
		new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
			maximumFractionDigits: 4,
		});

	const formatInteger = (value: number | null): string => (value === null ? 'n/a' : integerFormatter.format(value));
	const formatPercent = (value: number | null): string => (value === null ? 'n/a' : percentFormatter.format(value));
	const costLabel = $derived(
		state.kind === 'available' && state.estimatedCost
			? currencyFormatter(state.estimatedCost.currency).format(state.estimatedCost.totalCost)
			: null,
	);
</script>

{#if state.kind !== 'absent'}
	<div
		class={cn(
			'inline-flex min-w-[16rem] max-w-full flex-col gap-1.5 rounded-[1rem] border border-border/60 bg-background/75 px-3 py-2',
			state.kind === 'unavailable' ? 'opacity-65' : '',
			className,
		)}
		data-testid="runtime-heartbeat-context"
		data-context-state={state.kind}
	>
		<div class="flex min-w-0 items-center gap-2">
			<Badge variant="outline" class="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
				Context
			</Badge>
			{#if state.kind === 'available'}
				<div class="truncate font-mono text-[11px] text-foreground">{formatInteger(state.totalTokens)} tok</div>
				{#if costLabel}
					<div class="truncate text-[11px] text-muted-foreground">~{costLabel}</div>
				{/if}
			{:else}
				<div class="truncate text-[11px] text-muted-foreground">Latest usage unavailable</div>
			{/if}
		</div>

		{#if state.kind === 'available'}
			<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
				<span>P {formatInteger(state.promptTokens)}</span>
				<span>C {formatInteger(state.completionTokens)}</span>
				{#if state.maxContextTokens}
					<span>{formatPercent(state.progress)} of {formatInteger(state.maxContextTokens)}</span>
				{/if}
			</div>
			{#if state.maxContextTokens}
				<div class="grid gap-1">
					<div class="h-1.5 overflow-hidden rounded-full bg-muted/75">
						<div
							class="h-full rounded-full bg-primary/75"
							style:width={`${Math.max(0.02, state.progress ?? 0) * 100}%`}
						></div>
					</div>
					<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
						<span>Remaining {formatInteger(state.remainingTokens)}</span>
						{#if state.estimatedCost?.bandLimitTokens}
							<span>Band ≤ {formatInteger(state.estimatedCost.bandLimitTokens)}</span>
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>
{/if}
