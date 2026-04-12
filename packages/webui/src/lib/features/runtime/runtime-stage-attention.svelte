<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import type { MessageChannelEntry, RuntimeSnapshotEntry, SessionNotificationItem } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';

	import {
		buildRuntimeAttentionContextItems,
		buildRuntimeSchedulerSignals,
	} from './runtime-attention-contexts';
	import { formatRuntimeTimestamp } from './runtime-shell-format';
	import {
		buildRuntimeAttentionQueueItems,
		buildRuntimeAttentionScoreSummary,
		filterRuntimeAttentionContextItems,
		filterRuntimeAttentionHooks,
		filterRuntimeAttentionQueueItems,
	} from './runtime-stage-attention-state';

	let {
		sessionId,
		runtime,
		channels,
		notifications,
		onOpenRoom,
		onOpenTerminal,
		onSetRoomVisibility,
		onSetTerminalVisibility,
		onConsumeNotification,
	}: {
		sessionId: string;
		runtime: RuntimeSnapshotEntry | null;
		channels: MessageChannelEntry[];
		notifications: SessionNotificationItem[];
		onOpenRoom: (chatId: string) => void | Promise<void>;
		onOpenTerminal: (terminalId: string) => void | Promise<void>;
		onSetRoomVisibility: (chatId: string, focused: boolean) => void | Promise<void>;
		onSetTerminalVisibility: (terminalId: string, focused: boolean) => void | Promise<void>;
		onConsumeNotification: (input: {
			chatId?: string;
			terminalId?: string;
			upToMessageId?: string | null;
		}) => void | Promise<void>;
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
	const hooks = $derived([...(attention?.hooks ?? [])].reverse().slice(0, 8));
	const queueItems = $derived(buildRuntimeAttentionQueueItems(notifications, contextItems));

	let searchQuery = $state('');
	let selectedContextId = $state<string | null>(null);
	let selectedQueueId = $state<string | null>(null);
	let quickActionBusy = $state<'focus' | 'background' | 'consume' | 'open' | null>(null);

	const filteredContextItems = $derived(filterRuntimeAttentionContextItems(contextItems, searchQuery));
	const filteredQueueItems = $derived(filterRuntimeAttentionQueueItems(queueItems, searchQuery));
	const filteredHooks = $derived(filterRuntimeAttentionHooks(hooks, searchQuery));
	const activeContextItems = $derived(filteredContextItems.filter((item) => item.source === 'active'));
	const trackedContextItems = $derived(filteredContextItems.filter((item) => item.source === 'tracked'));
	const hasSearchQuery = $derived(searchQuery.trim().length > 0);

	$effect(() => {
		const fallbackContextId = filteredContextItems[0]?.contextId ?? filteredQueueItems[0]?.attentionContextId ?? null;
		if (!fallbackContextId) {
			selectedContextId = null;
			return;
		}
		if (!selectedContextId || !contextItems.some((item) => item.contextId === selectedContextId)) {
			selectedContextId = fallbackContextId;
		}
	});

	$effect(() => {
		if (!selectedQueueId || !filteredQueueItems.some((item) => item.id === selectedQueueId)) {
			selectedQueueId =
				filteredQueueItems.find((item) => item.attentionContextId === selectedContextId)?.id ??
				filteredQueueItems[0]?.id ??
				null;
		}
	});

	const selectedContext = $derived(
		contextItems.find((item) => item.contextId === selectedContextId) ??
			filteredContextItems[0] ??
			null,
	);
	const selectedScoreSummary = $derived(
		selectedContext ? buildRuntimeAttentionScoreSummary(selectedContext.scores) : null,
	);
	const selectedQueue = $derived(
		filteredQueueItems.find((item) => item.id === selectedQueueId) ??
			queueItems.find((item) => item.id === selectedQueueId) ??
			null,
	);
	const selectedHooks = $derived(
		selectedContextId ? filteredHooks.filter((hook) => hook.contextId === selectedContextId).slice(0, 4) : [],
	);
	const focusedStackItems = $derived(
		activeContextItems.filter((item) => item.contextId !== selectedContextId),
	);
	const trackedStackItems = $derived(
		trackedContextItems.filter((item) => item.contextId !== selectedContextId),
	);

	const formatScore = (value: number): string => {
		return Number.isInteger(value) ? String(value) : value.toFixed(1);
	};

	const openContext = async (): Promise<void> => {
		if (!selectedContext?.jumpTarget) {
			return;
		}
		quickActionBusy = 'open';
		try {
			if (selectedContext.jumpTarget.kind === 'room') {
				await onOpenRoom(selectedContext.jumpTarget.targetId);
				return;
			}
			await onOpenTerminal(selectedContext.jumpTarget.targetId);
		} finally {
			quickActionBusy = null;
		}
	};

	const focusQueuedSource = async (focused: boolean): Promise<void> => {
		if (!selectedQueue) {
			return;
		}
		quickActionBusy = focused ? 'focus' : 'background';
		try {
			if (selectedQueue.sourceType === 'chat') {
				await onSetRoomVisibility(selectedQueue.sourceId, focused);
				if (focused) {
					await onOpenRoom(selectedQueue.sourceId);
				}
				return;
			}
			await onSetTerminalVisibility(selectedQueue.sourceId, focused);
			if (focused) {
				await onOpenTerminal(selectedQueue.sourceId);
			}
		} finally {
			quickActionBusy = null;
		}
	};

	const consumeSelectedQueue = async (): Promise<void> => {
		if (!selectedQueue) {
			return;
		}
		quickActionBusy = 'consume';
		try {
			if (selectedQueue.sourceType === 'chat') {
				await onConsumeNotification({
					chatId: selectedQueue.sourceId,
					upToMessageId: selectedQueue.messageId ?? null,
				});
				return;
			}
			await onConsumeNotification({
				terminalId: selectedQueue.sourceId,
			});
		} finally {
			quickActionBusy = null;
		}
	};
</script>

<WorkbenchPageContent data-testid="runtime-attention-stage">
	{#snippet main()}
		<div class="grid h-full gap-4">
			<Card.Root>
				<Card.Content class="grid gap-3 pt-6">
					<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
						<label class="grid gap-1.5">
							<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
								Search attention
							</div>
							<Input
								bind:value={searchQuery}
								data-testid="runtime-attention-search"
								placeholder="Search context, source, queued push, hook id, or error"
							/>
						</label>
						<div class="flex flex-wrap items-center gap-2 md:justify-end">
							{#each schedulerSignals as signal (signal.id)}
								<Badge variant={signal.variant} class="rounded-full bg-background/70">
									{signal.label}
								</Badge>
							{/each}
							{#if hasSearchQuery}
								<Button size="sm" variant="ghost" class="rounded-full" onclick={() => (searchQuery = '')}>
									Clear
								</Button>
							{/if}
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="border-b">
					<Card.Title>Selected context</Card.Title>
					<Card.Description>
						{#if selectedContext}
							The current runtime story starts from one chosen attention context before branching into stack and queue.
						{:else}
							No attention context is available yet for this runtime.
						{/if}
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-4 pt-6">
					{#if selectedContext}
						<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
							<div class="grid gap-2">
								<div class="flex flex-wrap items-center gap-2">
									<div class="text-base font-semibold">{selectedContext.label}</div>
									<Badge variant={selectedContext.source === 'active' ? 'secondary' : 'outline'}>
										{selectedContext.source}
									</Badge>
									<Badge variant="outline">{selectedContext.commitLabel}</Badge>
									{#if selectedContext.jumpTarget}
										<Badge variant="outline">{selectedContext.jumpTarget.kind}</Badge>
									{/if}
								</div>
								<div class="text-sm text-muted-foreground">
									Owner {selectedContext.owner} · Updated {formatRuntimeTimestamp(selectedContext.updatedAt)}
								</div>
							</div>

							{#if selectedContext.jumpTarget}
								<Button variant="outline" class="rounded-full" onclick={() => void openContext()}>
									<ArrowUpRightIcon class="size-4" />
									{selectedContext.jumpTarget.actionLabel} source
								</Button>
							{/if}
						</div>

						<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
							<div class="grid gap-2">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Recent commits
								</div>
								{#if selectedContext.recentCommits.length === 0}
									<div class="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
										No recent commits are available for this context yet.
									</div>
								{:else}
									<div class="grid gap-2">
										{#each selectedContext.recentCommits as commit (commit.commitId)}
											<div class="rounded-xl border px-4 py-3">
												<div class="text-sm font-medium">{commit.summary}</div>
												<div class="mt-1 text-xs text-muted-foreground">
													{commit.source} · {formatRuntimeTimestamp(commit.createdAt)}
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<div class="grid gap-2 md:min-w-52">
								<div class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Positive scores
								</div>
								{#if selectedScoreSummary}
									<div class="flex flex-wrap gap-1.5">
										{#each selectedContext.scores as score (score.key)}
											<Badge variant="secondary" class="rounded-full text-[11px]">
												{score.key} {formatScore(score.value)}
											</Badge>
										{/each}
									</div>
								{:else}
									<div class="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
										No positive scores are active.
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
							No attention context matches the current runtime or search query.
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="border-b">
					<Card.Title>{activeContextItems.length > 0 ? 'Focused stack' : 'Tracked contexts'}</Card.Title>
					<Card.Description>
						{activeContextItems.length > 0
							? 'Contexts below the selected one remain active but subordinate.'
							: 'When no focused stack exists, tracked contexts remain available for inspection.'}
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-2 pt-6">
					{#if focusedStackItems.length > 0 || trackedStackItems.length > 0}
						{#each [...focusedStackItems, ...trackedStackItems] as item (item.contextId)}
							<button
								type="button"
								class={item.contextId === selectedContextId
									? 'grid gap-2 rounded-2xl border border-primary bg-primary/5 px-4 py-3 text-left'
									: 'grid gap-2 rounded-2xl border bg-card/70 px-4 py-3 text-left transition-colors hover:bg-muted/35'}
								onclick={() => {
									selectedContextId = item.contextId;
								}}
							>
								<div class="flex flex-wrap items-center gap-2">
									<div class="text-sm font-semibold">{item.label}</div>
									<Badge variant={item.source === 'active' ? 'secondary' : 'outline'}>{item.source}</Badge>
									{#if item.jumpTarget}
										<Badge variant="outline">{item.jumpTarget.kind}</Badge>
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">
									Owner {item.owner} · {item.commitLabel} · Updated {formatRuntimeTimestamp(item.updatedAt)}
								</div>
							</button>
						{/each}
					{:else}
						<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
							{hasSearchQuery
								? `No stack items match “${searchQuery.trim()}”.`
								: 'No additional focused or tracked contexts are available.'}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="border-b">
					<Card.Title>Queued push inbox</Card.Title>
					<Card.Description>
						Background notifications stay compact here until they are focused or consumed.
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-2 pt-6">
					{#if filteredQueueItems.length > 0}
						{#each filteredQueueItems as item (item.id)}
							<button
								type="button"
								class={item.id === selectedQueueId
									? 'grid gap-2 rounded-2xl border border-amber-500/70 bg-amber-500/8 px-4 py-3 text-left'
									: 'grid gap-2 rounded-2xl border bg-card/70 px-4 py-3 text-left transition-colors hover:bg-muted/35'}
								onclick={() => {
									selectedQueueId = item.id;
									selectedContextId = item.attentionContextId;
								}}
							>
								<div class="flex flex-wrap items-center gap-2">
									<div class="text-sm font-semibold">{item.label}</div>
									<Badge variant="outline">{item.sourceType}</Badge>
									<Badge variant="secondary">{formatRuntimeTimestamp(item.timestamp)}</Badge>
								</div>
								<div class="text-sm text-muted-foreground">{item.content || 'Notification summary unavailable.'}</div>
							</button>
						{/each}
					{:else}
						<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
							{hasSearchQuery ? `No queued pushes match “${searchQuery.trim()}”.` : 'No queued push notifications are waiting.'}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{/snippet}

	{#snippet bottom()}
		<Card.Root>
			<Card.Content class="grid gap-4 pt-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
				<div class="grid gap-1">
					<div class="text-sm font-semibold">
						{selectedQueue
							? `${selectedQueue.label} is ready for a visibility or consume action.`
							: selectedContext
								? `${selectedContext.label} is the current attention anchor.`
								: 'Attention quick actions appear when a context or queued push is selected.'}
					</div>
					<div class="text-xs text-muted-foreground">
						{selectedQueue
							? 'Quick actions stay inside Attention instead of sending you to a separate notification page.'
							: 'Queued notifications promote into focused attention only when explicitly selected.'}
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					{#if selectedContext?.jumpTarget}
						<Button
							variant="outline"
							disabled={quickActionBusy !== null}
							onclick={() => void openContext()}
						>
							<ArrowUpRightIcon class="size-4" />
							{quickActionBusy === 'open' ? 'Opening…' : 'Open source'}
						</Button>
					{/if}
					{#if selectedQueue}
						<Button
							variant="outline"
							disabled={quickActionBusy !== null}
							onclick={() => void focusQueuedSource(false)}
						>
							{quickActionBusy === 'background' ? 'Updating…' : 'Keep in background'}
						</Button>
						<Button
							variant="outline"
							disabled={quickActionBusy !== null}
							onclick={() => void consumeSelectedQueue()}
						>
							{quickActionBusy === 'consume' ? 'Clearing…' : 'Consume push'}
						</Button>
						<Button disabled={quickActionBusy !== null} onclick={() => void focusQueuedSource(true)}>
							{quickActionBusy === 'focus' ? 'Focusing…' : 'Promote and open'}
						</Button>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	{/snippet}

	{#snippet drawer()}
		{#snippet attentionDrawerSummary()}
			<div><span class="font-medium text-foreground">Session:</span> {sessionId}</div>
			<div><span class="font-medium text-foreground">Focused contexts:</span> {activeContextItems.length}</div>
			<div><span class="font-medium text-foreground">Queued pushes:</span> {queueItems.length}</div>
			<div><span class="font-medium text-foreground">Visible hooks:</span> {filteredHooks.length}</div>
		{/snippet}

		<WorkbenchDetailDrawer
			title="Attention detail"
			description="Actionable selection facts stay first. Passive runtime metadata remains docked at the bottom."
			summary={attentionDrawerSummary}
		>
			<section class="grid gap-2">
				<h4 class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Selection facts</h4>
				{#if selectedContext}
					<div class="text-sm font-semibold">{selectedContext.label}</div>
					<div class="text-sm text-muted-foreground">Context {selectedContext.contextId}</div>
					<div class="text-sm text-muted-foreground">Owner {selectedContext.owner}</div>
					<div class="text-sm text-muted-foreground">
						Updated {formatRuntimeTimestamp(selectedContext.updatedAt)}
					</div>
				{:else}
					<div class="text-sm text-muted-foreground">Select one context to inspect it in detail.</div>
				{/if}
			</section>

			<section class="grid gap-2 border-t border-border/55 pt-4">
				<h4 class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Delivery contract</h4>
				{#if selectedQueue}
					<div class="text-sm font-medium">{selectedQueue.sourceType} · {selectedQueue.sourceId}</div>
					<div class="text-sm text-muted-foreground">{selectedQueue.content || 'Notification summary unavailable.'}</div>
					<div class="text-sm text-muted-foreground">
						Queued at {formatRuntimeTimestamp(selectedQueue.timestamp)}
					</div>
				{:else if selectedContext?.jumpTarget}
					<div class="text-sm font-medium">{selectedContext.jumpTarget.kind}</div>
					<div class="text-sm text-muted-foreground">{selectedContext.jumpTarget.label}</div>
				{:else}
					<div class="text-sm text-muted-foreground">No queued delivery is selected right now.</div>
				{/if}
			</section>

			<section class="grid gap-2 border-t border-border/55 pt-4">
				<h4 class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Linked runtime sources</h4>
				{#if selectedHooks.length > 0}
					{#each selectedHooks as hook (hook.id)}
						<div class="grid gap-1 rounded-xl border px-3 py-2">
							<div class="flex flex-wrap items-center gap-2">
								<div class="text-sm font-medium">{hook.systemId}</div>
								<Badge variant={hook.status === 'failed' ? 'destructive' : hook.status === 'delivered' ? 'secondary' : 'outline'}>
									{hook.status}
								</Badge>
							</div>
							<div class="text-xs text-muted-foreground">
								{hook.hookId} · {formatRuntimeTimestamp(hook.createdAt)}
							</div>
							{#if hook.error}
								<div class="text-xs text-destructive">{hook.error}</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="text-sm text-muted-foreground">No hook deliveries are attached to the current selection.</div>
				{/if}
			</section>
		</WorkbenchDetailDrawer>
	{/snippet}
</WorkbenchPageContent>
