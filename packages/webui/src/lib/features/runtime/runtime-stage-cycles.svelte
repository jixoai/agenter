<script lang="ts">
	import type { RuntimeChatCycle } from '@agenter/client-sdk';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

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

	const cycleItems = $derived([...(cycles ?? [])].reverse());
	const errorCount = $derived(cycles.filter((cycle) => cycle.status === 'error').length);
	const activeCount = $derived(
		cycles.filter(
			(cycle) =>
				cycle.status === 'pending' ||
				cycle.status === 'collecting' ||
				cycle.status === 'streaming' ||
				cycle.status === 'applying',
		).length,
	);
</script>

<div class="grid auto-rows-max gap-4" data-testid="runtime-cycles-stage">
	<div class="grid gap-3 md:grid-cols-3">
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recorded cycles</div>
			<div class="mt-2 text-2xl font-semibold">{cycles.length}</div>
		</div>
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active cycles</div>
			<div class="mt-2 text-2xl font-semibold">{activeCount}</div>
		</div>
		<div class="rounded-xl border bg-muted/20 px-4 py-3">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Error cycles</div>
			<div class="mt-2 text-2xl font-semibold">{errorCount}</div>
		</div>
	</div>

	{#if activeCycle}
		<Card.Root>
			<Card.Header class="border-b">
				<Card.Action>
					<Badge variant="secondary">Live</Badge>
				</Card.Action>
				<Card.Title>Active cycle</Card.Title>
				<Card.Description>The current cycle is still open and may continue collecting inputs, calling models, or publishing tool results.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-3 pt-6 md:grid-cols-3">
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cycle id</div>
					<div class="mt-2 text-sm font-semibold">{formatCycleLabel(activeCycle.cycleId)}</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Wake source</div>
					<div class="mt-2 text-sm font-semibold">{activeCycle.wakeSource ?? 'Unknown'}</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</div>
					<div class="mt-2 text-sm font-semibold">{formatRuntimeTimestamp(activeCycle.createdAt)}</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Header class="border-b">
			<Card.Action>
				{#if latestCycle}
					<Badge variant={latestCycle.status === 'error' ? 'destructive' : latestCycle.status === 'done' ? 'secondary' : 'outline'}>
						{latestCycle.status}
					</Badge>
				{/if}
			</Card.Action>
			<Card.Title>Recent cycles</Card.Title>
			<Card.Description>The runtime history keeps the durable envelope of wake source, protocol kind, and input/output counts.</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-3 pt-6">
			{#if cycleItems.length === 0}
				<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">No cycle history yet.</div>
			{:else}
				{#each cycleItems as cycle (cycle.id)}
					<div class="rounded-xl border px-4 py-3">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="grid gap-1">
								<div class="text-sm font-semibold">Cycle {formatCycleLabel(cycle.cycleId)}</div>
								<div class="text-xs text-muted-foreground">{cycle.kind} · wake {cycle.wakeSource ?? 'unknown'}</div>
							</div>
							<Badge variant={cycle.status === 'error' ? 'destructive' : cycle.status === 'done' ? 'secondary' : 'outline'}>
								{cycle.status}
							</Badge>
						</div>
						<div class="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
							<span>Inputs {cycle.inputs.length}</span>
							<span>Outputs {cycle.outputs.length}</span>
							<span>Live messages {cycle.liveMessages.length}</span>
							<span>{formatRuntimeTimestamp(cycle.createdAt)}</span>
						</div>
					</div>
				{/each}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
