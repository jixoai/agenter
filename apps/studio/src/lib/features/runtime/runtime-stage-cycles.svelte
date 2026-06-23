<script lang="ts">
	import type {
		RuntimeAttentionDeliveryState,
		ModelCallItem,
		ObservabilityTraceItem,
		RuntimeAttentionState,
		RuntimeChatCycle,
	} from '@agenter/client-sdk';
	import { MarkdownPreviewContent } from '@jixo/codemirror';

	import JSONViewer from '$lib/components/web-components/json-viewer.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { cn } from '$lib/utils.js';

	import {
		buildRuntimeCycleDetailModel,
		buildRuntimeCycleTimelineItems,
		EMPTY_RUNTIME_ATTENTION_STATE,
	} from './runtime-cycle-inspector-state';
	import { formatRuntimeTimestamp } from './runtime-shell-format';

	type CycleDetailTab = 'summary' | 'io' | 'model' | 'attention';

	let {
		cycles,
		activeCycle,
		latestCycle,
		attention = null,
		attentionDelivery = null,
		modelCalls = [],
		traces = [],
	}: {
		cycles: RuntimeChatCycle[];
		activeCycle: RuntimeChatCycle | null;
		latestCycle: RuntimeChatCycle | null;
		attention?: RuntimeAttentionState | null;
		attentionDelivery?: RuntimeAttentionDeliveryState | null;
		modelCalls?: ModelCallItem[];
		traces?: ObservabilityTraceItem[];
	} = $props();

	const normalizeDetailTab = (value: string): CycleDetailTab => {
		return value === 'io' || value === 'model' || value === 'attention' ? value : 'summary';
	};

	const summarizeTrace = (trace: ObservabilityTraceItem): string => {
		const outcome = trace.outcome?.code ?? trace.status;
		return `${trace.kind} / ${trace.name} · ${outcome}`;
	};

	const cycleTimeline = $derived(
		buildRuntimeCycleTimelineItems({
			cycles,
			activeCycle,
			attention,
			attentionDelivery,
			modelCalls,
			traces,
		}),
	);
	const activeCount = $derived(
		cycleTimeline.filter((item) => item.cycle.status !== 'done' && item.cycle.status !== 'error').length,
	);
	const errorCount = $derived(cycleTimeline.filter((item) => item.cycle.status === 'error').length);

	let selectedCycleId = $state<string | null>(null);
	let detailTab = $state<CycleDetailTab>('summary');

	const selectedTimelineItem = $derived.by(() => {
		for (const cycleId of [selectedCycleId, activeCycle?.id, latestCycle?.id]) {
			if (!cycleId) {
				continue;
			}
			const timelineItem = cycleTimeline.find((item) => item.id === cycleId || item.cycle.id === cycleId);
			if (timelineItem) {
				return timelineItem;
			}
		}
		return cycleTimeline[0] ?? null;
	});
	const selectedCycleDetail = $derived(
		selectedTimelineItem
			? buildRuntimeCycleDetailModel({
					cycle: selectedTimelineItem.cycle,
					attention: attention ?? EMPTY_RUNTIME_ATTENTION_STATE,
					attentionDelivery,
					modelCalls,
					traces,
				})
			: null,
	);
</script>

<div class="grid auto-rows-max gap-4" data-testid="runtime-cycles-stage">
	{#if cycleTimeline.length === 0}
		<Item.Root size="sm" variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
			<div>No cycle history yet.</div>
			<div>Collected inputs and generated outputs will appear here after the runtime advances.</div>
		</Item.Root>
	{:else}
		<div class="grid gap-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
			<section class="grid auto-rows-max gap-2.5" data-testid="runtime-cycle-timeline">
				{#each cycleTimeline as item (item.id)}
					<button
						type="button"
						class={cn(
							'rounded-2xl border px-4 py-3 text-left transition-colors',
							selectedTimelineItem?.id === item.id
								? 'border-primary bg-primary/5 shadow-sm'
								: 'bg-background hover:bg-muted/35',
						)}
						aria-pressed={selectedTimelineItem?.id === item.id}
						data-runtime-cycle-select={item.id}
						onclick={() => {
							selectedCycleId = item.id;
						}}
					>
						<div class="grid gap-2">
							<div class="flex flex-wrap items-center gap-2">
								<div class="truncate text-sm font-semibold">{item.title}</div>
								{#if item.active}
									<Badge variant="secondary" class="rounded-full text-[11px]">Live</Badge>
								{/if}
								<Badge variant={item.statusVariant} class="rounded-full text-[11px]">{item.statusLabel}</Badge>
								<Badge variant="outline" class="rounded-full text-[11px]">{item.badgeLabel}</Badge>
								<Badge variant="outline" class="rounded-full text-[11px]">{item.cycle.kind}</Badge>
								{#if item.compactTrigger}
									<Badge variant="outline" class="rounded-full text-[11px]">{item.compactTrigger}</Badge>
								{/if}
							</div>
							<div class="text-sm font-medium text-foreground">{item.headline}</div>
							<div class="text-[11px] text-muted-foreground">
								{item.detail} · {formatRuntimeTimestamp(item.cycle.createdAt)}
							</div>
						</div>
					</button>
				{/each}
			</section>

			{#if selectedCycleDetail}
				<Item.Root size="sm" class="grid gap-4" data-testid={`runtime-cycle-detail-${selectedCycleDetail.cycle.id}`}>
					<div class="grid gap-2">
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="text-sm font-semibold">{selectedCycleDetail.title}</h3>
							<Badge variant={selectedCycleDetail.statusVariant} class="rounded-full text-[11px]">
								{selectedCycleDetail.statusLabel}
							</Badge>
							<Badge variant="outline" class="rounded-full text-[11px]">
								{selectedCycleDetail.badgeLabel}
							</Badge>
							<Badge variant="outline" class="rounded-full text-[11px]">
								{selectedCycleDetail.cycle.kind}
							</Badge>
							{#if selectedCycleDetail.compactTrigger}
								<Badge variant="outline" class="rounded-full text-[11px]">
									{selectedCycleDetail.compactTrigger}
								</Badge>
							{/if}
						</div>
						<div class="text-sm font-medium text-foreground">{selectedCycleDetail.summary.headline}</div>
						<div class="text-xs text-muted-foreground">
							{selectedCycleDetail.summary.detail} · {formatRuntimeTimestamp(selectedCycleDetail.cycle.createdAt)}
						</div>
					</div>

					<Tabs.Root value={detailTab} onValueChange={(value) => (detailTab = normalizeDetailTab(value))} class="grid gap-4">
						<Tabs.List class="grid w-full grid-cols-2 lg:grid-cols-4">
							<Tabs.Trigger value="summary">Summary</Tabs.Trigger>
							<Tabs.Trigger value="io">I/O</Tabs.Trigger>
							<Tabs.Trigger value="model">Model</Tabs.Trigger>
							<Tabs.Trigger value="attention">Attention</Tabs.Trigger>
						</Tabs.List>
					</Tabs.Root>

					{#if detailTab === 'summary'}
						<div class="grid gap-4">
							<dl class="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Wake source</dt>
									<dd class="font-medium text-foreground">{selectedCycleDetail.metrics.wakeSource}</dd>
								</div>
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Protocol</dt>
									<dd class="font-medium text-foreground">{selectedCycleDetail.metrics.protocolMode}</dd>
								</div>
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Model call</dt>
									<dd class="font-medium text-foreground">
										{selectedCycleDetail.primaryModelCall
											? `#${selectedCycleDetail.primaryModelCall.id}`
											: selectedCycleDetail.cycle.modelCallId ?? 'none'}
									</dd>
								</div>
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Sequence</dt>
									<dd class="font-medium text-foreground">{selectedCycleDetail.cycle.seq ?? 'unknown'}</dd>
								</div>
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Contexts</dt>
									<dd class="font-medium text-foreground">{selectedCycleDetail.metrics.contextCount}</dd>
								</div>
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Inputs / outputs</dt>
									<dd class="font-medium text-foreground">
										{selectedCycleDetail.metrics.inputCount} / {selectedCycleDetail.metrics.outputCount}
									</dd>
								</div>
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Delivery</dt>
									<dd class="font-medium text-foreground">
										{selectedCycleDetail.metrics.attemptCount} attempts
										<span class="text-muted-foreground"> · {selectedCycleDetail.metrics.receiptCount} receipts</span>
									</dd>
								</div>
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Receipts</dt>
									<dd class="font-medium text-foreground">
										{selectedCycleDetail.metrics.deliveredCount} accepted
										{#if selectedCycleDetail.metrics.failedCount > 0}
											<span class="text-muted-foreground"> · {selectedCycleDetail.metrics.failedCount} failed</span>
										{/if}
									</dd>
								</div>
								<div class="grid gap-1 rounded-xl border border-border/70 bg-muted/15 px-3 py-2">
									<dt class="uppercase tracking-[0.16em]">Live / traces</dt>
									<dd class="font-medium text-foreground">
										{selectedCycleDetail.metrics.liveCount} / {selectedCycleDetail.metrics.traceCount}
									</dd>
								</div>
							</dl>

							{#if selectedCycleDetail.cycle.streaming?.content.trim().length}
								<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
									<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
										Streaming draft
									</div>
									<div class="whitespace-pre-wrap break-words text-sm text-foreground">
										{selectedCycleDetail.cycle.streaming.content.trim()}
									</div>
								</section>
							{/if}

							{#if selectedCycleDetail.cycle.clientMessageIds.length > 0}
								<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
									<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
										Client messages
									</div>
									<div class="flex flex-wrap gap-1.5">
										{#each selectedCycleDetail.cycle.clientMessageIds as clientMessageId (clientMessageId)}
											<Badge variant="outline" class="rounded-full text-[11px]">{clientMessageId}</Badge>
										{/each}
									</div>
								</section>
							{/if}

							<div class="grid gap-4 xl:grid-cols-4">
								<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
									<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
										Hook outcomes
									</div>
									{#if selectedCycleDetail.hooks.length === 0}
										<div class="text-sm text-muted-foreground">No attention hooks were recorded for this cycle.</div>
									{:else}
										<div class="grid gap-2">
											{#each selectedCycleDetail.hooks as hook (hook.id)}
												<Item.Root size="sm" variant="muted" class="grid gap-2">
													<div class="flex flex-wrap items-center gap-2">
														<div class="text-sm font-medium">{hook.bridgeId}</div>
														<Badge variant={hook.status === 'failed' ? 'destructive' : hook.status === 'delivered' ? 'secondary' : 'outline'}>
															{hook.status}
														</Badge>
														<Badge variant="outline" class="rounded-full text-[11px]">{hook.contextId}</Badge>
													</div>
													<div class="text-xs text-muted-foreground">
														{hook.commitId} · {formatRuntimeTimestamp(hook.createdAt)}
													</div>
													{#if hook.error}
														<div class="text-xs text-destructive">{hook.error}</div>
													{/if}
												</Item.Root>
											{/each}
										</div>
									{/if}
								</section>

								<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
									<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
										Delivery attempts
									</div>
									{#if selectedCycleDetail.deliveryDispatches.length === 0}
										<div class="text-sm text-muted-foreground">
											No delivery attempt was recorded for this cycle's commit set.
										</div>
									{:else}
										<div class="grid gap-2">
											{#each selectedCycleDetail.deliveryDispatches as dispatch (dispatch.dispatchId)}
												<Item.Root size="sm" variant="muted" class="grid gap-1.5">
													<div class="flex flex-wrap items-center gap-2">
														<div class="text-sm font-medium">{dispatch.commitId}</div>
														<Badge variant="outline" class="rounded-full text-[11px]">
															attempt {dispatch.attemptIndex}
														</Badge>
													</div>
													<div class="text-xs text-muted-foreground">
														agentCall {dispatch.agentCallId}
														{#if dispatch.sessionModelCallId !== null}
															<span> · ai_call #{dispatch.sessionModelCallId}</span>
														{/if}
													</div>
												</Item.Root>
											{/each}
										</div>
									{/if}
								</section>

								<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
									<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
										Delivery receipts
									</div>
									{#if selectedCycleDetail.deliveryReceipts.length === 0}
										<div class="text-sm text-muted-foreground">
											No delivery receipt was recorded for this cycle's commit set.
										</div>
									{:else}
										<div class="grid gap-2">
											{#each selectedCycleDetail.deliveryReceipts as receipt (receipt.receiptId)}
												<Item.Root size="sm" variant="muted" class="grid gap-2">
													<div class="flex flex-wrap items-center gap-2">
														<div class="text-sm font-medium">{receipt.providerEventKind}</div>
														<Badge
															variant={receipt.status === 'errored'
																? 'destructive'
																: receipt.status === 'accepted' || receipt.status === 'completed'
																	? 'secondary'
																	: 'outline'}
														>
															{receipt.status}
														</Badge>
														<Badge variant="outline" class="rounded-full text-[11px]">
															attempt {receipt.attemptIndex}
														</Badge>
													</div>
													<div class="text-xs text-muted-foreground">
														{receipt.commitId} · {formatRuntimeTimestamp(receipt.timestamp)}
													</div>
													{#if receipt.errorMessage}
														<div class="text-xs text-destructive">
															{receipt.errorCode ? `${receipt.errorCode}: ` : ''}{receipt.errorMessage}
														</div>
													{/if}
												</Item.Root>
											{/each}
										</div>
									{/if}
								</section>

								<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
									<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
										Explicit effects
									</div>
									{#if selectedCycleDetail.deliveryEffects.length === 0}
										<div class="text-sm text-muted-foreground">
											No durable external effect was linked to this cycle.
										</div>
									{:else}
										<div class="grid gap-2">
											{#each selectedCycleDetail.deliveryEffects as effect (effect.effectId)}
												<Item.Root size="sm" variant="muted" class="grid gap-2">
													<div class="flex flex-wrap items-center gap-2">
														<div class="text-sm font-medium">{effect.effectKind}</div>
														<Badge variant="secondary">{effect.actionKind}</Badge>
														<Badge variant="outline" class="rounded-full text-[11px]">{effect.target}</Badge>
													</div>
													<div class="text-xs text-muted-foreground">
														action {effect.actionId} · record {effect.effectRecordId} · {formatRuntimeTimestamp(effect.timestamp)}
													</div>
												</Item.Root>
											{/each}
										</div>
									{/if}
								</section>

								<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
									<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
										Trace evidence
									</div>
									{#if selectedCycleDetail.traces.length === 0}
										<div class="text-sm text-muted-foreground">No observability traces were retained for this cycle.</div>
									{:else}
										<div class="grid gap-2">
											{#each selectedCycleDetail.traces as trace (trace.id)}
												<Item.Root size="sm" variant="muted" class="grid gap-1.5">
													<div class="flex flex-wrap items-center gap-2">
														<div class="text-sm font-medium">{trace.name}</div>
														<Badge variant={trace.status === 'error' ? 'destructive' : trace.status === 'running' ? 'secondary' : 'outline'}>
															{trace.status}
														</Badge>
													</div>
													<div class="text-xs text-muted-foreground">{summarizeTrace(trace)}</div>
												</Item.Root>
											{/each}
										</div>
									{/if}
								</section>
							</div>
						</div>
					{:else if detailTab === 'io'}
						<div class="grid gap-4 xl:grid-cols-3">
							<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Inputs</div>
								{#if selectedCycleDetail.cycle.inputs.length === 0}
									<div class="text-sm text-muted-foreground">No collected inputs.</div>
								{:else}
									<div class="grid gap-2">
										{#each selectedCycleDetail.cycle.inputs as input, index (`${selectedCycleDetail.cycle.id}-input-${index}`)}
											<Item.Root size="sm" variant="muted" class="grid gap-2">
												<div class="flex flex-wrap items-center gap-2">
													<div class="text-sm font-medium">{input.name}</div>
													<Badge variant="outline" class="rounded-full text-[11px]">{input.source}</Badge>
													<Badge variant="outline" class="rounded-full text-[11px]">{input.role}</Badge>
												</div>
												{@const textParts = input.parts
													.filter((part): part is Extract<(typeof input.parts)[number], { type: 'text' }> => part.type === 'text')
													.map((part) => part.text.trim())
													.filter((part) => part.length > 0)}
												{@const assetParts = input.parts.filter((part) => part.type !== 'text')}
												{#if textParts.length > 0}
													<div class="whitespace-pre-wrap break-words text-sm text-foreground">{textParts.join('\n\n')}</div>
												{/if}
												{#if assetParts.length > 0}
													<div class="flex flex-wrap gap-1.5">
														{#each assetParts as part (`${part.assetId}-${part.kind}`)}
															<Badge variant="secondary" class="rounded-full text-[11px]">
																{part.kind} · {part.name}
															</Badge>
														{/each}
													</div>
												{/if}
											</Item.Root>
										{/each}
									</div>
								{/if}
							</section>

							<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Outputs</div>
								{#if selectedCycleDetail.cycle.outputs.length === 0}
									<div class="text-sm text-muted-foreground">No persisted outputs.</div>
								{:else}
									<div class="grid gap-2">
										{#each selectedCycleDetail.cycle.outputs as message (`${selectedCycleDetail.cycle.id}-output-${message.id}`)}
											<Item.Root size="sm" variant="muted" class="grid gap-2">
												<div class="flex flex-wrap items-center gap-2">
													<div class="text-sm font-medium">{message.role}</div>
													{#if message.channel}
														<Badge variant="outline" class="rounded-full text-[11px]">{message.channel}</Badge>
													{/if}
													<div class="text-xs text-muted-foreground">{formatRuntimeTimestamp(message.timestamp)}</div>
												</div>
												{#if message.content.trim().length > 0}
													<div class="whitespace-pre-wrap break-words text-sm text-foreground">{message.content.trim()}</div>
												{/if}
												{#if (message.attachments?.length ?? 0) > 0}
													<div class="flex flex-wrap gap-1.5">
														{#each message.attachments ?? [] as attachment (attachment.assetId)}
															<Badge variant="secondary" class="rounded-full text-[11px]">
																{attachment.kind} · {attachment.name}
															</Badge>
														{/each}
													</div>
												{/if}
											</Item.Root>
										{/each}
									</div>
								{/if}
							</section>

							<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Live messages
								</div>
								{#if selectedCycleDetail.cycle.liveMessages.length === 0}
									<div class="text-sm text-muted-foreground">No in-flight messages were captured.</div>
								{:else}
									<div class="grid gap-2">
										{#each selectedCycleDetail.cycle.liveMessages as message (`${selectedCycleDetail.cycle.id}-live-${message.id}`)}
											<Item.Root size="sm" variant="muted" class="grid gap-2">
												<div class="flex flex-wrap items-center gap-2">
													<div class="text-sm font-medium">{message.role}</div>
													{#if message.channel}
														<Badge variant="outline" class="rounded-full text-[11px]">{message.channel}</Badge>
													{/if}
												</div>
												<div class="whitespace-pre-wrap break-words text-sm text-foreground">{message.content.trim() || 'Structured live message'}</div>
											</Item.Root>
										{/each}
									</div>
								{/if}
							</section>
						</div>
					{:else if detailTab === 'model'}
						<section class="grid gap-4">
							{#if selectedCycleDetail.primaryModelCall}
								<div class="flex flex-wrap gap-1.5">
									<Badge variant="secondary" class="rounded-full text-[11px]">
										#{selectedCycleDetail.primaryModelCall.id}
									</Badge>
									<Badge variant="outline" class="rounded-full text-[11px]">
										{selectedCycleDetail.primaryModelCall.provider}
									</Badge>
									<Badge variant="outline" class="rounded-full text-[11px]">
										{selectedCycleDetail.primaryModelCall.model}
									</Badge>
									<Badge
										variant={selectedCycleDetail.primaryModelCall.status === 'error'
											? 'destructive'
											: selectedCycleDetail.primaryModelCall.status === 'running'
												? 'secondary'
												: 'outline'}
										class="rounded-full text-[11px]"
									>
										{selectedCycleDetail.primaryModelCall.status}
									</Badge>
								</div>

								<div class="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
									<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
										<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
											System prompt
										</div>
										{#if selectedCycleDetail.modelConfig.systemPrompt.length > 0}
											<MarkdownPreviewContent
												value={selectedCycleDetail.modelConfig.systemPrompt}
												tone="viewer"
												class="min-w-0"
											/>
										{:else}
											<div class="text-sm text-muted-foreground">No system prompt snapshot was retained.</div>
										{/if}
									</section>

									<section class="grid gap-4">
										<div class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
											<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
												Model request
											</div>
											<JSONViewer
												value={{
													messages: selectedCycleDetail.modelConfig.requestMessages,
													tools: selectedCycleDetail.modelConfig.requestTools,
													meta: selectedCycleDetail.modelConfig.requestMeta,
												}}
											/>
										</div>

										<div class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
											<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
												Model response
											</div>
											<JSONViewer
												value={{
													response: selectedCycleDetail.modelConfig.response,
													error: selectedCycleDetail.modelConfig.error,
													outcome: selectedCycleDetail.modelConfig.outcome,
												}}
											/>
										</div>
									</section>
								</div>
							{:else}
								<Item.Root size="sm" variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
									<div>No model call snapshot is linked to this cycle.</div>
									<div>Compaction-only or preflight cycles can still be inspected from the Summary and Attention tabs.</div>
								</Item.Root>
							{/if}
						</section>
					{:else}
						<div class="grid gap-4 xl:grid-cols-2">
							<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Input contexts
								</div>
								{#if selectedCycleDetail.inputContexts.length === 0}
									<div class="text-sm text-muted-foreground">No input contexts were captured for this cycle.</div>
								{:else}
									<div class="grid gap-2">
										{#each selectedCycleDetail.inputContexts as context (context.key)}
											<Item.Root size="sm" variant="muted" class="grid gap-1.5">
												<div class="text-sm font-medium">{context.title}</div>
												<div class="text-xs text-muted-foreground">
													{context.contextId}
													{#if context.scoreSummary}
														· {context.scoreSummary}
													{/if}
												</div>
											</Item.Root>
										{/each}
									</div>
								{/if}
							</section>

							<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Input commits
								</div>
								{#if selectedCycleDetail.inputCommits.length === 0}
									<div class="text-sm text-muted-foreground">No input commits were recorded.</div>
								{:else}
									<div class="grid gap-2">
										{#each selectedCycleDetail.inputCommits as commit (commit.key)}
											<Item.Root size="sm" variant="muted" class="grid gap-1.5">
												<div class="text-sm font-medium">{commit.title}</div>
												<div class="text-xs text-muted-foreground">
													{commit.contextId}
													{#if commit.scoreSummary}
														· {commit.scoreSummary}
													{/if}
												</div>
											</Item.Root>
										{/each}
									</div>
								{/if}
							</section>

							<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Output commits
								</div>
								{#if selectedCycleDetail.producedCommits.length === 0}
									<div class="text-sm text-muted-foreground">No commits were produced in this cycle.</div>
								{:else}
									<div class="grid gap-2">
										{#each selectedCycleDetail.producedCommits as commit (commit.key)}
											<Item.Root size="sm" variant="muted" class="grid gap-1.5">
												<div class="text-sm font-medium">{commit.title}</div>
												<div class="text-xs text-muted-foreground">
													{commit.contextId}
													{#if commit.scoreSummary}
														· {commit.scoreSummary}
													{/if}
												</div>
											</Item.Root>
										{/each}
									</div>
								{/if}
							</section>

							<section class="grid gap-2 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Remaining active contexts
								</div>
								{#if selectedCycleDetail.activeContexts.length === 0}
									<div class="text-sm text-muted-foreground">This cycle left no remaining active contexts.</div>
								{:else}
									<div class="grid gap-2">
										{#each selectedCycleDetail.activeContexts as context (context.key)}
											<Item.Root size="sm" variant="muted" class="grid gap-1.5">
												<div class="text-sm font-medium">{context.title}</div>
												<div class="text-xs text-muted-foreground">
													{context.contextId}
													{#if context.scoreSummary}
														· {context.scoreSummary}
													{/if}
												</div>
											</Item.Root>
										{/each}
									</div>
								{/if}
							</section>
						</div>
					{/if}
				</Item.Root>
			{/if}
		</div>
	{/if}
</div>
