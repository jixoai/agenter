<script lang="ts">
	import type { RuntimeSnapshotEntry } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import { formatRuntimeTimestamp } from './runtime-shell-format';

	let {
		runtime,
	}: {
		runtime: RuntimeSnapshotEntry | null;
	} = $props();

	const attention = $derived(runtime?.attention ?? null);
	const schedulerState = $derived(runtime?.schedulerState ?? null);
	const snapshotContexts = $derived(attention?.snapshot.contexts ?? []);
	const activeContexts = $derived(attention?.active ?? []);
	const hooks = $derived([...(attention?.hooks ?? [])].reverse().slice(0, 6));
</script>

<div class="grid auto-rows-max gap-4" data-testid="runtime-attention-stage">
	<div class="grid gap-3 md:grid-cols-3" data-testid="runtime-attention-summary">
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contexts</div>
			<div class="mt-2 text-2xl font-semibold">{snapshotContexts.length}</div>
		</div>
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active attention</div>
			<div class="mt-2 text-2xl font-semibold">{activeContexts.length}</div>
		</div>
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent hooks</div>
			<div class="mt-2 text-2xl font-semibold">{hooks.length}</div>
		</div>
	</div>

	<Card.Root>
		<Card.Header class="border-b">
			<Card.Action>
				<Badge variant="outline">{schedulerState?.runtimeStatus ?? 'waiting_input'}</Badge>
			</Card.Action>
			<Card.Title>Attention posture</Card.Title>
			<Card.Description>LoopBus containment and attention pressure explain why the runtime is active, waiting, blocked, or backing off.</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-3 pt-6 md:grid-cols-2">
			<div class="rounded-xl border px-4 py-3">
				<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scheduler phase</div>
				<div class="mt-2 text-sm font-semibold">{runtime?.schedulerPhase ?? 'idle'}</div>
				<div class="mt-1 text-xs text-muted-foreground">{schedulerState?.waitingReason ?? 'No waiting reason recorded.'}</div>
			</div>
			<div class="rounded-xl border px-4 py-3">
				<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next auto wake</div>
				<div class="mt-2 text-sm font-semibold">{formatRuntimeTimestamp(schedulerState?.nextAutoWakeAt)}</div>
				<div class="mt-1 text-xs text-muted-foreground">
					Retry {schedulerState?.retryCount ?? 0} · Backoff {schedulerState?.backoffMs ?? 0} ms
				</div>
			</div>
			<div class="rounded-xl border px-4 py-3">
				<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Unresolved scores</div>
				<div class="mt-2 text-sm font-semibold">{schedulerState?.unresolvedScoreCount ?? 0}</div>
			</div>
			<div class="rounded-xl border px-4 py-3">
				<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last wake</div>
				<div class="mt-2 text-sm font-semibold">{schedulerState?.lastWakeSource ?? 'Unknown source'}</div>
				<div class="mt-1 text-xs text-muted-foreground">{formatRuntimeTimestamp(schedulerState?.lastWakeAt)}</div>
			</div>
		</Card.Content>
	</Card.Root>

	<div class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Active contexts</Card.Title>
				<Card.Description>Contexts currently participating in the runtime loop, ordered by the runtime projection rather than raw storage order.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6">
				{#if activeContexts.length > 0}
					{#each activeContexts as match (match.contextId)}
						<div class="rounded-xl border px-4 py-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="text-sm font-semibold">{match.contextId}</div>
								<Badge variant="secondary">{match.recentCommits.length} recent commits</Badge>
							</div>
							<div class="mt-2 text-xs text-muted-foreground">
								Owner {match.context.owner} · Updated {formatRuntimeTimestamp(match.context.updatedAt)}
							</div>
						</div>
					{/each}
				{:else if snapshotContexts.length > 0}
					{#each snapshotContexts as context (context.contextId)}
						<div class="rounded-xl border px-4 py-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="text-sm font-semibold">{context.contextId}</div>
								<Badge variant="outline">{context.commitCount ?? context.commits.length} commits</Badge>
							</div>
							<div class="mt-2 text-xs text-muted-foreground">
								Owner {context.owner} · Updated {formatRuntimeTimestamp(context.updatedAt)}
							</div>
						</div>
					{/each}
				{:else}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						No attention contexts are available for this runtime yet.
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="border-b">
				<Card.Title>Recent hooks</Card.Title>
				<Card.Description>Attention outputs recently delivered, ignored, or failed across linked systems.</Card.Description>
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
