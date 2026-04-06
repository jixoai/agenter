<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import type { MessageChannelEntry, RuntimeSnapshotEntry } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import { cn } from '$lib/utils.js';

	import {
		buildRuntimeAttentionContextItems,
		buildRuntimeSchedulerSignals,
	} from './runtime-attention-contexts';
	import { formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		runtime,
		channels,
		onOpenRoom,
		onOpenTerminal,
	}: {
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
		onOpenRoom: (chatId: string) => void | Promise<void>;
		onOpenTerminal: (terminalId: string) => void | Promise<void>;
	} = $props();

	const attention = $derived(runtime?.attention ?? null);
	const contextItems = $derived(
		buildRuntimeAttentionContextItems({
			attention,
			channels,
			terminals: runtime?.terminals ?? [],
		}),
	);
	const schedulerSignals = $derived(
		buildRuntimeSchedulerSignals({
			schedulerPhase: runtime?.schedulerPhase ?? null,
			schedulerState: runtime?.schedulerState ?? null,
		}),
	);
	const hooks = $derived([...(attention?.hooks ?? [])].reverse().slice(0, 6));
	let expandedContextId = $state<string | null>(null);

	$effect(() => {
		if (expandedContextId && !contextItems.some((item) => item.contextId === expandedContextId)) {
			expandedContextId = null;
		}
	});

	const toggleContext = (contextId: string): void => {
		expandedContextId = expandedContextId === contextId ? null : contextId;
	};

	const openContext = async (contextId: string): Promise<void> => {
		const item = contextItems.find((entry) => entry.contextId === contextId);
		if (!item?.jumpTarget) {
			return;
		}
		if (item.jumpTarget.kind === 'room') {
			await onOpenRoom(item.jumpTarget.targetId);
			return;
		}
		await onOpenTerminal(item.jumpTarget.targetId);
	};

	const formatScore = (value: number): string => {
		return Number.isInteger(value) ? String(value) : value.toFixed(1);
	};
</script>

<div class="grid auto-rows-max gap-4" data-testid="runtime-attention-stage">
	{#if schedulerSignals.length > 0}
		<div class="flex flex-wrap gap-1.5" data-testid="runtime-attention-scheduler-signals">
			{#each schedulerSignals as signal (signal.id)}
				<Badge variant={signal.variant} class="rounded-full bg-background/70">
					{signal.label}
				</Badge>
			{/each}
		</div>
	{/if}

	<div class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Active contexts</Card.Title>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				{#if contextItems.length > 0}
					<div class="grid auto-rows-max gap-2.5">
						{#each contextItems as item (item.contextId)}
							{@const expanded = expandedContextId === item.contextId}
							<Item.Root size="sm" data-testid={`runtime-context-${item.contextId}`}>
								<div class="grid min-w-0 flex-1 gap-3">
									<div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
										<button
											type="button"
											class="flex min-w-0 items-start gap-3 text-left"
											aria-expanded={expanded}
											onclick={() => {
												toggleContext(item.contextId);
											}}
										>
											<div class="grid min-w-0 flex-1 gap-1">
												<div class="flex flex-wrap items-center gap-2">
													<div class="truncate text-sm font-semibold">{item.label}</div>
													{#if item.source === 'tracked'}
														<Badge
															variant="outline"
															class="rounded-full text-[10px] font-semibold tracking-[0.16em] uppercase"
														>
															Tracked
														</Badge>
													{/if}
													{#if item.jumpTarget}
														<Badge variant="secondary" class="rounded-full text-[11px]">
															{item.jumpTarget.kind === 'room' ? 'Room' : 'Terminal'}
														</Badge>
													{/if}
													<Badge variant="outline" class="rounded-full text-[11px]">
														{item.commitLabel}
													</Badge>
												</div>
												<div class="truncate text-xs text-muted-foreground">
													Owner {item.owner} · Updated {formatRuntimeTimestamp(item.updatedAt)}
												</div>
											</div>
											<ChevronDownIcon
												class={cn(
													'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
													expanded && 'rotate-180',
												)}
											/>
										</button>

										{#if item.jumpTarget}
											<Button
												size="sm"
												variant="outline"
												class="rounded-full"
												onclick={(event) => {
													event.stopPropagation();
													void openContext(item.contextId);
												}}
											>
												<ArrowUpRightIcon class="size-3.5" />
												{item.jumpTarget.actionLabel}
											</Button>
										{/if}
									</div>

									{#if expanded}
										<div class="grid gap-3 border-t pt-3">
											<dl class="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
												<div class="grid gap-1">
													<dt class="uppercase tracking-[0.16em]">Context</dt>
													<dd class="break-all font-medium text-foreground">{item.contextId}</dd>
												</div>
												<div class="grid gap-1">
													<dt class="uppercase tracking-[0.16em]">Owner</dt>
													<dd class="font-medium text-foreground">{item.owner}</dd>
												</div>
												<div class="grid gap-1">
													<dt class="uppercase tracking-[0.16em]">Updated</dt>
													<dd class="font-medium text-foreground">{formatRuntimeTimestamp(item.updatedAt)}</dd>
												</div>
											</dl>

											{#if item.scores.length > 0}
												<div class="grid gap-1.5">
													<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
														Positive scores
													</div>
													<div class="flex flex-wrap gap-1.5">
														{#each item.scores as score (score.key)}
															<Badge variant="outline" class="rounded-full text-[11px]">
																{score.key} {formatScore(score.value)}
															</Badge>
														{/each}
													</div>
												</div>
											{/if}

											<div class="grid gap-1.5">
												<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
													Recent commits
												</div>
												{#if item.recentCommits.length === 0}
													<div class="text-xs text-muted-foreground">No recent commits recorded.</div>
												{:else}
													<div class="grid gap-2">
														{#each item.recentCommits as commit (commit.commitId)}
															<div class="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
																<div class="text-sm font-medium">{commit.summary}</div>
																<div class="mt-1 text-xs text-muted-foreground">
																	{commit.source} · {formatRuntimeTimestamp(commit.createdAt)}
																</div>
															</div>
														{/each}
													</div>
												{/if}
												{#if item.commitsTruncated}
													<div class="text-xs text-muted-foreground">
														Showing the most recent commits only.
													</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							</Item.Root>
						{/each}
					</div>
				{:else}
					<Item.Root size="sm" variant="muted" class="grid gap-2 py-8 text-sm text-muted-foreground">
						<div>No active contexts are available for this runtime yet.</div>
						<div>Room and terminal jump actions will appear here when attention facts become available.</div>
					</Item.Root>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Recent hooks</Card.Title>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				{#if hooks.length === 0}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						No attention hooks have been published yet.
					</div>
				{:else}
					{#each hooks as hook (hook.id)}
						<div class="rounded-xl border px-4 py-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="text-sm font-semibold">{hook.systemId}</div>
								<Badge variant={hook.status === 'failed' ? 'destructive' : hook.status === 'delivered' ? 'secondary' : 'outline'}>
									{hook.status}
								</Badge>
							</div>
							<div class="mt-2 text-xs text-muted-foreground">
								Context {hook.contextId} · Hook {hook.hookId} · {formatRuntimeTimestamp(hook.createdAt)}
							</div>
							{#if hook.error}
								<div class="mt-2 text-xs text-destructive">{hook.error}</div>
							{/if}
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
