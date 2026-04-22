<script lang="ts">
	import type { HeartbeatGroupItem, HeartbeatPartItem } from '@agenter/client-sdk';
	import { tick } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';

	import {
		createEmptyRuntimeHeartbeatConfigBinding,
	} from './runtime-heartbeat-config-state';
	import RuntimeStageHeartbeat from './runtime-stage-heartbeat.svelte';

	type DemoMode = 'projection-rekey' | 'stable-append';
	type IdentityProbe = {
		mode: DemoMode;
		beforeKey: string | null;
		afterKey: string | null;
		oldKeyStillMounted: boolean | null;
		afterKeyMounted: boolean | null;
		sameRowShell: boolean | null;
		sameGroupNode: boolean | null;
		note: string;
	};

	let {
		mode = 'stable-append',
	}: {
		mode?: DemoMode;
	} = $props();

	const baseTimestamp = Date.UTC(2026, 3, 22, 9, 0, 0);
	const configBinding = createEmptyRuntimeHeartbeatConfigBinding();

	const createEntry = (input: {
		id: number;
		messageId: string;
		role: HeartbeatPartItem['role'];
		aiCallId: number | null;
		createdAt: number;
		text: string;
	}): HeartbeatPartItem => ({
		id: input.id,
		messageId: input.messageId,
		windowId: null,
		aiCallId: input.aiCallId,
		roundIndex: input.id,
		scope: 'heartbeat_part',
		role: input.role,
		createdAt: input.createdAt,
		updatedAt: input.createdAt + 600,
		isComplete: true,
		text: input.text,
		parts: [
			{
				partId: input.id,
				partIndex: 0,
				messageId: input.messageId,
				windowId: null,
				aiCallId: input.aiCallId,
				roundIndex: input.id,
				scope: 'heartbeat_part',
				role: input.role,
				partType: 'text',
				mimeType: null,
				payload: {
					type: 'text',
					content: input.text,
				},
				createdAt: input.createdAt,
				updatedAt: input.createdAt + 600,
				isComplete: true,
			},
		],
	});

	const createGroup = (input: {
		id: number;
		groupId: string;
		kind: HeartbeatGroupItem['kind'];
		aiCallId: number | null;
		role: HeartbeatPartItem['role'];
		text: string;
		offsetMs: number;
	}): HeartbeatGroupItem => {
		const createdAt = baseTimestamp + input.offsetMs;
		return {
			id: input.id,
			groupId: input.groupId,
			kind: input.kind,
			aiCallId: input.aiCallId,
			createdAt,
			updatedAt: createdAt + 1_200,
			isComplete: true,
			items: [
				createEntry({
					id: input.id,
					messageId: `${input.groupId}:entry`,
					role: input.role,
					aiCallId: input.aiCallId,
					createdAt,
					text: input.text,
				}),
			],
		};
	};

	const stableInitialGroups = Array.from({ length: 5 }, (_, index) =>
		createGroup({
			id: 700 + index,
			groupId: `heartbeat-group:call:${700 + index}`,
			kind: 'call',
			aiCallId: 700 + index,
			role: 'assistant',
			offsetMs: index * 4_000,
			text: `Stable Heartbeat card ${index + 1}. Existing row identity should survive later append.`,
		}),
	);
	const stableAnchorKey = stableInitialGroups.at(-1)?.groupId ?? null;
	const stableAppendedGroup = createGroup({
		id: 705,
		groupId: 'heartbeat-group:call:705',
		kind: 'call',
		aiCallId: 705,
		role: 'assistant',
		offsetMs: 24_000,
		text: 'Stable append adds one more latest call group while older cards keep the same key.',
	});

	const projectionOlderGroups = Array.from({ length: 4 }, (_, index) =>
		createGroup({
			id: 800 + index,
			groupId: `heartbeat-group:call:${800 + index}`,
			kind: 'call',
			aiCallId: 800 + index,
			role: 'assistant',
			offsetMs: index * 4_000,
			text: `Projected history ${index + 1}. These older cards are not supposed to move.`,
		}),
	);
	const projectionPendingGroup = createGroup({
		id: 804,
		groupId: 'heartbeat-group:before-call-pending:805',
		kind: 'before-call-pending',
		aiCallId: null,
		role: 'user',
		offsetMs: 18_000,
		text: 'Pending request context before the runtime has projected a durable aiCallId.',
	});
	const projectedBeforeCallGroup = createGroup({
		id: 8050,
		groupId: 'heartbeat-group:before-call:805',
		kind: 'before-call',
		aiCallId: 805,
		role: 'user',
		offsetMs: 18_000,
		text: 'Pending request context before the runtime has projected a durable aiCallId.',
	});
	const projectedCallGroup = createGroup({
		id: 8051,
		groupId: 'heartbeat-group:call:805',
		kind: 'call',
		aiCallId: 805,
		role: 'assistant',
		offsetMs: 22_000,
		text: 'Projected assistant call row after grouped refresh. This is a new key and a new card subtree.',
	});

	let rootRef = $state<HTMLDivElement | null>(null);
	let groups = $state<HeartbeatGroupItem[]>([]);
	let refreshing = $state(false);
	let probe = $state<IdentityProbe>({
		mode: 'stable-append',
		beforeKey: null,
		afterKey: null,
		oldKeyStillMounted: null,
		afterKeyMounted: null,
		sameRowShell: null,
		sameGroupNode: null,
		note: 'Click the demo action to probe row identity.',
	});
	let lastMode: DemoMode | null = null;

	const cloneGroup = (group: HeartbeatGroupItem): HeartbeatGroupItem => structuredClone(group);
	const escapeSelectorValue = (value: string): string =>
		typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
			? CSS.escape(value)
			: value.replace(/["\\]/gu, '\\$&');
	const readRowShell = (groupKey: string): HTMLElement | null =>
		rootRef?.querySelector<HTMLElement>(`[data-anchored-row-key="${escapeSelectorValue(groupKey)}"]`) ?? null;
	const readGroupNode = (groupKey: string): HTMLElement | null =>
		rootRef?.querySelector<HTMLElement>(`[data-heartbeat-group-key="${escapeSelectorValue(groupKey)}"]`) ?? null;
	const waitForPaint = async (): Promise<void> => {
		await tick();
		if (typeof window === 'undefined') {
			return;
		}
		await new Promise<void>((resolve) => {
			window.requestAnimationFrame(() => {
				resolve();
			});
		});
	};
	const resolveInitialGroups = (nextMode: DemoMode): HeartbeatGroupItem[] =>
		(nextMode === 'stable-append' ? stableInitialGroups : [...projectionOlderGroups, projectionPendingGroup]).map(cloneGroup);

	const reset = (): void => {
		groups = resolveInitialGroups(mode);
		refreshing = false;
		probe = {
			mode,
			beforeKey: null,
			afterKey: null,
			oldKeyStillMounted: null,
			afterKeyMounted: null,
			sameRowShell: null,
			sameGroupNode: null,
			note:
				mode === 'stable-append'
					? 'This path matches the stable Storybook append stories: existing cards keep the same groupId.'
					: 'This path matches the page-level projection churn: a pending group rekeys into durable before-call/call groups.',
		};
	};

	const runDemo = async (): Promise<void> => {
		refreshing = true;
		const beforeKey = mode === 'stable-append' ? stableAnchorKey : projectionPendingGroup.groupId;
		if (!beforeKey) {
			return;
		}
		const beforeRowShell = readRowShell(beforeKey);
		const beforeGroupNode = readGroupNode(beforeKey);

		if (mode === 'stable-append') {
			groups = [...groups, cloneGroup(stableAppendedGroup)];
		} else {
			groups = [...projectionOlderGroups, projectedBeforeCallGroup, projectedCallGroup].map(cloneGroup);
		}

		await waitForPaint();
		refreshing = false;
		await waitForPaint();

		const afterKey = mode === 'stable-append' ? beforeKey : projectedBeforeCallGroup.groupId;
		const afterRowShell = readRowShell(afterKey);
		const afterGroupNode = readGroupNode(afterKey);
		const oldKeyStillMounted = readRowShell(beforeKey) !== null;
		const afterKeyMounted = afterRowShell !== null && afterGroupNode !== null;
		const sameRowShell = beforeKey === afterKey && beforeRowShell && afterRowShell ? afterRowShell.isSameNode(beforeRowShell) : false;
		const sameGroupNode =
			beforeKey === afterKey && beforeGroupNode && afterGroupNode ? afterGroupNode.isSameNode(beforeGroupNode) : false;

		probe = {
			mode,
			beforeKey,
			afterKey,
			oldKeyStillMounted,
			afterKeyMounted,
			sameRowShell,
			sameGroupNode,
			note:
				mode === 'stable-append'
					? 'Stable append preserves the existing anchored row because the display key never changes.'
					: 'Projection refresh remounts the pending card because the display key changes from pending to durable.',
		};
	};

	$effect(() => {
		if (mode === lastMode) {
			return;
		}
		lastMode = mode;
		reset();
	});
</script>

<div
	bind:this={rootRef}
	class="grid h-[48rem] min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
	data-testid="runtime-heartbeat-page-drift-demo"
>
	<section class="grid gap-2 rounded-2xl border border-border/70 bg-background/85 px-3 py-3 shadow-sm">
		<div class="flex flex-wrap items-center gap-2">
			<Button
				size="sm"
				variant="outline"
				data-testid="runtime-heartbeat-page-drift-run"
				onclick={() => void runDemo()}
			>
				{mode === 'stable-append' ? 'Append stable latest' : 'Simulate page projection refresh'}
			</Button>
			<Button
				size="sm"
				variant="secondary"
				data-testid="runtime-heartbeat-page-drift-reset"
				onclick={reset}
			>
				Reset
			</Button>
		</div>
		<p class="text-xs text-muted-foreground">{probe.note}</p>
		<div class="grid gap-1 text-xs text-muted-foreground">
			<div>beforeKey: <code>{probe.beforeKey ?? '—'}</code></div>
			<div>afterKey: <code>{probe.afterKey ?? '—'}</code></div>
			<div>sameRowShell: <code>{probe.sameRowShell === null ? '—' : String(probe.sameRowShell)}</code></div>
			<div>sameGroupNode: <code>{probe.sameGroupNode === null ? '—' : String(probe.sameGroupNode)}</code></div>
		</div>
		<div class="sr-only" data-testid="runtime-heartbeat-page-drift-state">{JSON.stringify(probe)}</div>
	</section>

	<RuntimeStageHeartbeat
		sessionStatus="running"
		schedulerState={null}
		groupsState={{
			data: groups,
			loaded: true,
			loading: false,
			refreshing,
			error: null,
			refreshedAt: Date.now(),
		}}
		modelCalls={[]}
		attention={null}
		compactPending={false}
		compactDisabled={false}
		onRequestCompact={() => {}}
		configBinding={configBinding}
		configLoading={false}
		configSaving={false}
		configError={null}
		sessionIconUrl="https://example.test/runtime-heartbeat-page-drift-avatar.webp"
		avatarLabel="Runtime Drift Demo"
		onLoadOlder={async () => ({ items: 0, hasMore: false })}
		onRefreshConfig={() => {}}
		onSaveConfig={() => true}
	/>
</div>
