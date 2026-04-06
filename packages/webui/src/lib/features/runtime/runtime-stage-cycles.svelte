<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import type { RuntimeChatCycle } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import { cn } from '$lib/utils.js';

	import { formatCycleLabel, formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		cycles,
		activeCycle,
		latestCycle,
	}: {
		cycles: RuntimeChatCycle[];
		activeCycle: RuntimeChatCycle | null;
		latestCycle: RuntimeChatCycle | null;
	} = $props();

	const cycleItems = $derived.by(() => {
		const reversed = [...(cycles ?? [])].reverse();
		if (!activeCycle) {
			return reversed;
		}
		return [activeCycle, ...reversed.filter((cycle) => cycle.id !== activeCycle.id)];
	});
	let expandedCycleId = $state<string | null>(null);

	$effect(() => {
		if (expandedCycleId && !cycleItems.some((cycle) => cycle.id === expandedCycleId)) {
			expandedCycleId = null;
		}
		if (!expandedCycleId && cycleItems.length > 0) {
			expandedCycleId = activeCycle?.id ?? latestCycle?.id ?? cycleItems[0]?.id ?? null;
		}
	});

	const toggleCycle = (cycleId: string): void => {
		expandedCycleId = expandedCycleId === cycleId ? null : cycleId;
	};

	const truncateText = (value: string, limit = 120): string => {
		const normalized = value.replace(/\s+/gu, ' ').trim();
		if (normalized.length <= limit) {
			return normalized;
		}
		return `${normalized.slice(0, limit - 1)}…`;
	};

	const formatCollectedInputSummary = (cycle: RuntimeChatCycle['inputs'][number]): string => {
		const textPreview = cycle.parts
			.filter((part): part is Extract<(typeof cycle.parts)[number], { type: 'text' }> => part.type === 'text')
			.map((part) => truncateText(part.text, 96))
			.find((text) => text.length > 0);
		const assetCount = cycle.parts.filter((part) => part.type !== 'text').length;
		const assetSummary = assetCount > 0 ? `${assetCount} asset${assetCount === 1 ? '' : 's'}` : null;
		return [textPreview, assetSummary].filter((value) => value !== null).join(' · ') || 'Structured input';
	};

	const formatChatMessageSummary = (message: RuntimeChatCycle['outputs'][number]): string => {
		const content = truncateText(message.content, 96);
		const attachmentCount = message.attachments?.length ?? 0;
		const attachmentSummary =
			attachmentCount > 0 ? `${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}` : null;
		if (content.length > 0) {
			return [content, attachmentSummary].filter((value) => value !== null).join(' · ');
		}
		if (message.tool) {
			return [message.tool.name, message.tool.status, attachmentSummary]
				.filter((value) => value !== null)
				.join(' · ');
		}
		return attachmentSummary ?? 'Structured message';
	};

	const formatCompactTrigger = (trigger: RuntimeChatCycle['compactTrigger']): string | null => {
		if (!trigger) {
			return null;
		}
		return trigger.replaceAll('_', ' ');
	};
</script>

<div class="grid auto-rows-max gap-3" data-testid="runtime-cycles-stage">
	{#if cycleItems.length === 0}
		<Item.Root size="sm" variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
			<div>No cycle history yet.</div>
			<div>Collected inputs and generated outputs will appear here after the runtime advances.</div>
		</Item.Root>
	{:else}
		{#each cycleItems as cycle (cycle.id)}
			{@const expanded = expandedCycleId === cycle.id}
			{@const cycleActive = activeCycle?.id === cycle.id}
			<Item.Root
				size="sm"
				class={cn(
					'grid min-w-0 gap-3',
					cycleActive && 'border-primary/40 bg-primary/5',
				)}
				data-testid={`runtime-cycle-${cycle.id}`}
			>
				<button
					type="button"
					class="flex min-w-0 items-start gap-3 text-left"
					aria-expanded={expanded}
					onclick={() => {
						toggleCycle(cycle.id);
					}}
				>
					<div class="grid min-w-0 flex-1 gap-2">
						<div class="flex flex-wrap items-center gap-2">
							<div class="truncate text-sm font-semibold">Cycle {formatCycleLabel(cycle.cycleId)}</div>
							{#if cycleActive}
								<Badge variant="secondary" class="rounded-full text-[11px]">
									Live
								</Badge>
							{/if}
							<Badge
								variant={cycle.status === 'error' ? 'destructive' : cycle.status === 'done' ? 'secondary' : 'outline'}
								class="rounded-full text-[11px]"
							>
								{cycle.status}
							</Badge>
							<Badge variant="outline" class="rounded-full text-[11px]">
								{cycle.kind}
							</Badge>
							{#if formatCompactTrigger(cycle.compactTrigger)}
								<Badge variant="outline" class="rounded-full text-[11px]">
									{formatCompactTrigger(cycle.compactTrigger)}
								</Badge>
							{/if}
						</div>
						<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
							<span>Wake {cycle.wakeSource ?? 'unknown'}</span>
							<span>Inputs {cycle.inputs.length}</span>
							<span>Outputs {cycle.outputs.length}</span>
							<span>Live {cycle.liveMessages.length}</span>
							<span>{formatRuntimeTimestamp(cycle.createdAt)}</span>
						</div>
					</div>
					<ChevronDownIcon
						class={cn(
							'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
							expanded && 'rotate-180',
						)}
					/>
				</button>

				{#if expanded}
					<div class="grid gap-3 border-t pt-3">
						<dl class="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
							<div class="grid gap-1">
								<dt class="uppercase tracking-[0.16em]">Cycle id</dt>
								<dd class="break-all font-medium text-foreground">{cycle.id}</dd>
							</div>
							<div class="grid gap-1">
								<dt class="uppercase tracking-[0.16em]">Sequence</dt>
								<dd class="font-medium text-foreground">{cycle.seq ?? 'unknown'}</dd>
							</div>
							<div class="grid gap-1">
								<dt class="uppercase tracking-[0.16em]">Wake source</dt>
								<dd class="font-medium text-foreground">{cycle.wakeSource ?? 'unknown'}</dd>
							</div>
							<div class="grid gap-1">
								<dt class="uppercase tracking-[0.16em]">Model call</dt>
								<dd class="font-medium text-foreground">{cycle.modelCallId ?? 'none'}</dd>
							</div>
						</dl>

						{#if cycle.clientMessageIds.length > 0}
							<div class="grid gap-1.5">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Client messages
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each cycle.clientMessageIds as clientMessageId (clientMessageId)}
										<Badge variant="outline" class="rounded-full text-[11px]">
											{clientMessageId}
										</Badge>
									{/each}
								</div>
							</div>
						{/if}

						<div class="grid gap-3 xl:grid-cols-3">
							<div class="grid gap-1.5">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Inputs
								</div>
								{#if cycle.inputs.length === 0}
									<div class="text-xs text-muted-foreground">No collected inputs.</div>
								{:else}
									<div class="grid gap-2">
										{#each cycle.inputs as input, index (`${cycle.id}-input-${index}`)}
											<div class="grid gap-1 text-xs text-muted-foreground">
												<div class="flex flex-wrap items-center gap-1.5">
													<div class="font-medium text-foreground">{input.name}</div>
													<Badge variant="outline" class="rounded-full text-[10px]">
														{input.source}
													</Badge>
													<Badge variant="outline" class="rounded-full text-[10px]">
														{input.role}
													</Badge>
												</div>
												<div>{formatCollectedInputSummary(input)}</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<div class="grid gap-1.5">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Outputs
								</div>
								{#if cycle.outputs.length === 0}
									<div class="text-xs text-muted-foreground">No persisted outputs.</div>
								{:else}
									<div class="grid gap-2">
										{#each cycle.outputs as message (`${cycle.id}-output-${message.id}`)}
											<div class="grid gap-1 text-xs text-muted-foreground">
												<div class="flex flex-wrap items-center gap-1.5">
													<div class="font-medium text-foreground">{message.role}</div>
													{#if message.channel}
														<Badge variant="outline" class="rounded-full text-[10px]">
															{message.channel}
														</Badge>
													{/if}
												</div>
												<div>{formatChatMessageSummary(message)}</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<div class="grid gap-1.5">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Live messages
								</div>
								{#if cycle.liveMessages.length === 0}
									<div class="text-xs text-muted-foreground">No in-flight messages.</div>
								{:else}
									<div class="grid gap-2">
										{#each cycle.liveMessages as message (`${cycle.id}-live-${message.id}`)}
											<div class="grid gap-1 text-xs text-muted-foreground">
												<div class="flex flex-wrap items-center gap-1.5">
													<div class="font-medium text-foreground">{message.role}</div>
													{#if message.channel}
														<Badge variant="outline" class="rounded-full text-[10px]">
															{message.channel}
														</Badge>
													{/if}
												</div>
												<div>{formatChatMessageSummary(message)}</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</Item.Root>
		{/each}
	{/if}
</div>
