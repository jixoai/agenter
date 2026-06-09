<script lang="ts">
	import {
		HeartbeatRecordDetailView,
		HeartbeatView,
		createCachedResourceState,
		type CachedResourceState,
		type HeartbeatRecordDetail,
		type HeartbeatRecordItem,
		type HeartbeatViewCallbacks,
		type HeartbeatViewState,
		type ModelCallItem,
	} from '@agenter/web-heartbeat-view';
	import type { HeartbeatRecordDetailOutput } from '@agenter/client-sdk';
	import { onMount } from 'svelte';

	import { createAppController } from '$lib/app/app-controller.svelte';
	import type { SettingsLayerFile } from '$lib/features/settings/settings-graph-types';

	import { readRuntimeHeartbeatConfigBinding } from './runtime-heartbeat-config-state';
	import { HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE } from './runtime-heartbeat-app-view-url';

	type HeartbeatAppViewSurface = 'list' | 'detail';

	let {
		runtimeId,
		recordId = null,
		surface,
	}: {
		runtimeId: string;
		recordId?: number | null;
		surface: HeartbeatAppViewSurface;
	} = $props();

	const controller = createAppController();
	let hydrating = $state(true);
	let hydrateError = $state<string | null>(null);
	let configGraph = $state<Awaited<ReturnType<typeof controller.runtimeStore.listRuntimeSettingsScope>> | null>(null);
	let configLayerFile = $state<SettingsLayerFile | null>(null);
	let configLoading = $state(false);
	let configError = $state<string | null>(null);
	let hydratedRuntimeId = $state<string | null>(null);
	let localRecordDetailsState = $state<Record<number, CachedResourceState<HeartbeatRecordDetail | null>>>({});

	type SourceHeartbeatRecordDetail = NonNullable<HeartbeatRecordDetailOutput>;

	const adaptModelCall = (call: SourceHeartbeatRecordDetail['aiCalls'][number]): ModelCallItem => ({
		id: call.id,
		kind: call.kind,
		status: call.status,
		provider: call.provider,
		model: call.model,
		roundIndex: call.roundIndex,
		createdAt: call.createdAt,
		updatedAt: call.updatedAt,
		isComplete: call.isComplete,
		providerSnapshot: {
			provider: call.provider,
			model: call.model,
			requestUrl: call.requestUrl,
			completedAt: call.completedAt,
		},
		request: call.requestBody,
		response: call.responseBody ?? call.outcome ?? call.error,
	});

	const adaptRecordDetail = (detail: SourceHeartbeatRecordDetail | null): HeartbeatRecordDetail | null =>
		detail === null
			? null
			: {
					...detail,
					aiCalls: detail.aiCalls.map(adaptModelCall),
				};

	const adaptRecordDetailState = (
		state: CachedResourceState<HeartbeatRecordDetailOutput | null>,
	): CachedResourceState<HeartbeatRecordDetail | null> => ({
		...state,
		data: adaptRecordDetail(state.data),
	});

	const session = $derived(controller.runtimeState.sessions.find((entry) => entry.id === runtimeId) ?? null);
	const runtime = $derived(controller.runtimeState.runtimes[runtimeId] ?? null);
	const groupsState = $derived(
		controller.runtimeState.heartbeatGroupsBySession[runtimeId] ?? createCachedResourceState([]),
	);
	const recordsState = $derived(
		controller.runtimeState.heartbeatRecordsBySession[runtimeId] ?? createCachedResourceState(null),
	);
	const recordDetailsState = $derived.by<Record<number, CachedResourceState<HeartbeatRecordDetail | null>>>(() => {
		const source = controller.runtimeState.heartbeatRecordDetailsBySession[runtimeId] ?? {};
		return Object.fromEntries(
			Object.entries(source).map(([recordKey, state]) => [Number(recordKey), adaptRecordDetailState(state)]),
		);
	});
	const selectedRecordDetailState = $derived(recordId === null ? undefined : recordDetailsState[recordId]);
	const selectedLocalRecordDetailState = $derived(recordId === null ? undefined : localRecordDetailsState[recordId]);
	const selectedDetailState = $derived(selectedLocalRecordDetailState ?? selectedRecordDetailState);
	const modelCalls = $derived(controller.runtimeState.modelCallsBySession[runtimeId] ?? []);
	const configBinding = $derived(readRuntimeHeartbeatConfigBinding(configGraph, configLayerFile));
	const avatarLabel = $derived(session?.avatar || session?.name || 'Avatar');
	const selectedRecord = $derived.by<HeartbeatRecordItem | null>(() => {
		if (recordId === null) {
			return null;
		}
		return (
			selectedDetailState?.data?.record ??
			recordDetailsState[recordId]?.data?.record ??
			recordsState.data?.records.find((record) => record.id === recordId) ??
			null
		);
	});
	const viewState = $derived<HeartbeatViewState>({
		sessionStatus: session?.status ?? 'stopped',
		schedulerState: runtime?.schedulerState ?? null,
		groupsState,
		recordsState,
		recordDetailsState,
		modelCalls,
		attention: runtime?.attention ?? null,
		attentionDelivery: runtime?.attentionDelivery ?? null,
		configBinding,
		configLoading,
		configError,
		runtime,
		livePushStatus: session?.status === 'running' ? 'active' : 'inactive',
	});
	const callbacks = $derived<HeartbeatViewCallbacks>({
		onLoadOlder: () => controller.runtimeStore.loadMoreHeartbeatInspection(runtimeId),
		onLoadRecordPage: (anchor) => controller.runtimeStore.loadHeartbeatRecords(runtimeId, { anchor }),
		onLoadRecordDetail: (nextRecordId) => controller.runtimeStore.loadHeartbeatRecordDetail(runtimeId, nextRecordId),
		onOpenRecordDetail: (nextRecordId) => {
			window.parent.postMessage(
				{
					type: HEARTBEAT_RECORD_SELECT_MESSAGE_TYPE,
					runtimeId,
					recordId: nextRecordId,
				},
				window.location.origin,
			);
		},
	});

	const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

	const loadConfig = async (): Promise<void> => {
		configLoading = true;
		configError = null;
		try {
			const graph = await controller.runtimeStore.listRuntimeSettingsScope(runtimeId);
			configGraph = graph;
			const editableLayer = graph.layers.find((layer) => layer.editable) ?? null;
			configLayerFile = editableLayer
				? await controller.runtimeStore.readRuntimeSettingsLayer(runtimeId, editableLayer.layerId)
				: null;
		} catch (error) {
			configError = toErrorMessage(error);
			configGraph = null;
			configLayerFile = null;
		} finally {
			configLoading = false;
		}
	};

	const hydrateRuntime = async (): Promise<void> => {
		hydrating = true;
		hydrateError = null;
		try {
			await controller.runtimeStore.hydrateSessionArtifacts(runtimeId, {
				includeChatHistory: false,
				observabilityMode: 'heartbeat',
			});
			await Promise.all([controller.runtimeStore.loadHeartbeatRecords(runtimeId), loadConfig()]);
			hydratedRuntimeId = runtimeId;
		} catch (error) {
			hydrateError = toErrorMessage(error);
		} finally {
			hydrating = false;
		}
	};

	const loadSelectedRecordDetail = async (nextRecordId: number): Promise<void> => {
		localRecordDetailsState = {
			...localRecordDetailsState,
			[nextRecordId]: {
				...(localRecordDetailsState[nextRecordId] ?? createCachedResourceState<HeartbeatRecordDetail | null>(null)),
				loading: true,
				refreshing: false,
				error: null,
			},
		};
		try {
			await controller.runtimeStore.loadHeartbeatRecordDetail(runtimeId, nextRecordId);
			const source = controller.runtimeStore.getState().heartbeatRecordDetailsBySession[runtimeId]?.[nextRecordId];
			localRecordDetailsState = {
				...localRecordDetailsState,
				[nextRecordId]: source
					? adaptRecordDetailState(source)
					: {
							...createCachedResourceState<HeartbeatRecordDetail | null>(null),
							loaded: true,
							loading: false,
							refreshedAt: Date.now(),
						},
			};
		} catch (error) {
			localRecordDetailsState = {
				...localRecordDetailsState,
				[nextRecordId]: {
					...(localRecordDetailsState[nextRecordId] ?? createCachedResourceState<HeartbeatRecordDetail | null>(null)),
					loading: false,
					refreshing: false,
					error: toErrorMessage(error),
				},
			};
		}
	};

	onMount(() => {
		void controller.start();
		return () => {
			controller.stop();
		};
	});

	$effect(() => {
		if (controller.authBootstrapState !== 'authenticated') {
			return;
		}
		if (hydratedRuntimeId === runtimeId) {
			return;
		}
		void hydrateRuntime();
	});

	$effect(() => {
		if (surface !== 'detail' || recordId === null || hydratedRuntimeId !== runtimeId) {
			return;
		}
		if (
			selectedRecordDetailState?.loading ||
			selectedRecordDetailState?.refreshing ||
			selectedDetailState?.loading ||
			selectedDetailState?.refreshing ||
			selectedDetailState?.loaded
		) {
			return;
		}
		void loadSelectedRecordDetail(recordId);
	});

</script>

<svelte:head>
	<title>Heartbeat app-view</title>
</svelte:head>

<div class="runtime-heartbeat-app-view" data-testid="runtime-heartbeat-app-view" data-surface={surface}>
	{#if controller.authBootstrapState !== 'authenticated'}
		<div class="runtime-heartbeat-app-view__state">{controller.statusText}</div>
	{:else if hydrateError}
		<div class="runtime-heartbeat-app-view__state runtime-heartbeat-app-view__state--error">{hydrateError}</div>
	{:else if surface === 'list'}
		<HeartbeatView
			state={viewState}
			mode="configable"
			{avatarLabel}
			{callbacks}
			showToolbar={false}
			showSecondaryStatus={true}
		/>
	{:else if recordId === null}
		<div class="runtime-heartbeat-app-view__state">No Heartbeat record selected.</div>
	{:else if selectedRecord}
		<HeartbeatRecordDetailView
			record={selectedRecord}
			detailState={selectedDetailState}
		/>
	{:else if hydrating || selectedDetailState?.loading}
		<div class="runtime-heartbeat-app-view__state">Loading Heartbeat record…</div>
	{:else}
		<div class="runtime-heartbeat-app-view__state">Heartbeat record is not available.</div>
	{/if}
</div>

<style>
	.runtime-heartbeat-app-view {
		box-sizing: border-box;
		block-size: 100dvh;
		min-block-size: 0;
		min-inline-size: 0;
		overflow: auto;
		background: var(--background, Canvas);
		color: var(--foreground, CanvasText);
	}

	.runtime-heartbeat-app-view[data-surface='list'] {
		overflow: hidden auto;
	}

	.runtime-heartbeat-app-view[data-surface='detail'] {
		padding: 0.75rem;
	}

	.runtime-heartbeat-app-view__state {
		display: grid;
		min-block-size: 100%;
		place-items: center;
		padding: 1rem;
		color: var(--muted-foreground, color-mix(in srgb, CanvasText, transparent 35%));
		font-size: 0.875rem;
		text-align: center;
	}

	.runtime-heartbeat-app-view__state--error {
		color: var(--destructive, #dc2626);
	}
</style>
