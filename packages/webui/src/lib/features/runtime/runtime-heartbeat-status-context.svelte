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
</script>

{#if state.kind !== 'absent'}
	<div class={cn('max-w-full', className)} data-testid="runtime-heartbeat-context" data-context-state={state.kind}>
		<Context
			maxTokens={state.maxContextTokens}
			modelId={state.providerLabel}
			usage={
				state.kind === 'available'
					? {
							inputTokens: state.inputTokens,
							outputTokens: state.outputTokens,
							cachedInputTokens: state.cachedInputTokens,
							reasoningTokens: state.reasoningTokens,
						}
					: null
			}
			usedTokens={state.kind === 'available' ? state.usedTokens : null}
			estimatedCostLabel={estimatedCostLabel}
			disabled={state.kind !== 'available'}
		>
			<ContextTrigger class="h-8 max-w-full" />
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
