<script lang="ts">
	import {
		Context,
		ContextCacheUsage,
		ContextContent,
		ContextContentBody,
		ContextContentFooter,
		ContextContentHeader,
		ContextInputUsage,
		ContextOutputUsage,
		ContextReasoningUsage,
		ContextTrigger,
	} from '$lib/components/ai-elements/context/index.js';
	import { cn } from '$lib/utils.js';

	import type { RuntimeHeartbeatContextState } from './runtime-heartbeat-statusbar-state';

type RenderableContextState = Exclude<RuntimeHeartbeatContextState, { kind: 'absent' }> & {
	maxContextTokens: number;
};

	let {
		state,
		class: className = '',
	}: {
		state: RuntimeHeartbeatContextState;
		class?: string;
	} = $props();

	const currencyFormatter = (currency: string) =>
		new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
			maximumFractionDigits: 4,
		});

	const estimatedCostLabel = $derived.by(() => {
		if (state.kind !== 'available' || !state.estimatedCost) {
			return null;
		}
		return currencyFormatter(state.estimatedCost.currency).format(state.estimatedCost.totalCost);
	});

	const renderableState = $derived.by((): RenderableContextState | null => {
		if (state.kind === 'absent') {
			return null;
		}
		return {
			...state,
			maxContextTokens:
				state.maxContextTokens !== null && Number.isFinite(state.maxContextTokens) && state.maxContextTokens > 0
					? state.maxContextTokens
					: 0,
		};
	});
</script>

{#if renderableState}
	<div
		class={cn('max-w-full', className)}
		data-testid="runtime-heartbeat-context"
		data-context-state={renderableState.kind}
	>
		<Context
			maxTokens={renderableState.maxContextTokens}
			modelId={renderableState.providerLabel ?? undefined}
			usage={
				renderableState.kind === 'available'
					? {
							inputTokens: renderableState.inputTokens,
							outputTokens: renderableState.outputTokens,
							cachedInputTokens: renderableState.cachedInputTokens ?? undefined,
							reasoningTokens: renderableState.reasoningTokens ?? undefined,
						}
					: undefined
			}
			usedTokens={renderableState.kind === 'available' ? renderableState.usedTokens : 0}
			estimatedCostLabel={estimatedCostLabel}
		>
			<ContextTrigger class="h-8 max-w-full gap-2" disabled={renderableState.kind !== 'available'} />
			<ContextContent>
				<ContextContentHeader />
				<ContextContentBody>
					<ContextInputUsage />
					<ContextOutputUsage />
					<ContextReasoningUsage />
					<ContextCacheUsage />
				</ContextContentBody>
				<ContextContentFooter />
			</ContextContent>
		</Context>
	</div>
{/if}
