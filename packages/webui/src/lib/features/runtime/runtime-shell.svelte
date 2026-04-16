<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';

	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import * as Card from '$lib/components/ui/card/index.js';
	import type { SettingsLayerFile } from '$lib/features/settings/settings-graph-types';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import { buildMessageRoomHref } from '$lib/features/messages/message-room-location';
	import RuntimePageToolbarContent from './runtime-page-toolbar-content.svelte';
	import {
		pickEditableSettingsLayerId,
		readRuntimeHeartbeatConfigBinding,
		writeRuntimeHeartbeatConfigLayer,
	} from './runtime-heartbeat-config-state';
	import RuntimePrimaryStage from './runtime-primary-stage.svelte';
	import {
		basenameWorkspace,
		buildRuntimeTabs,
		normalizeRuntimeTab,
		resolveRuntimeStatusLabel,
	} from './runtime-shell-state';

	let {
		sessionId,
		tab,
	}: {
		sessionId: string;
		tab?: string;
	} = $props();

	const controller = getAppControllerContext();
	const pendingCycleLoads = new SvelteSet<string>();
	const attemptedCycleLoads = new SvelteSet<string>();
	let shellHydrationVersion = 0;
	let shellHydrating = $state(true);
	let shellHydrationError = $state<string | null>(null);
	let heartbeatConfigLoading = $state(false);
	let heartbeatConfigSaving = $state(false);
	let heartbeatConfigError = $state<string | null>(null);
	let heartbeatCompactPending = $state(false);
	let heartbeatConfigGraph = $state<Awaited<ReturnType<typeof controller.runtimeStore.listRuntimeSettingsScope>> | null>(null);
	let heartbeatConfigLayerFile = $state<SettingsLayerFile | null>(null);
	let heartbeatConfigLoadVersion = 0;
	let heartbeatConfigSessionId = $state<string | null>(null);

	const activeTab = $derived(normalizeRuntimeTab(tab));
	const session = $derived(controller.runtimeState.sessions.find((entry) => entry.id === sessionId) ?? null);
	const runtime = $derived(session ? controller.runtimeState.runtimes[session.id] ?? null : null);
	const channels = $derived(
		controller.runtimeState.messageChannelsBySession[sessionId]?.data?.filter((channel) => !channel.archivedAt) ?? [],
	);
	const heartbeatGroups = $derived(
		controller.runtimeState.heartbeatGroupsBySession[sessionId] ?? {
			data: [],
			loaded: false,
			loading: false,
			refreshing: false,
			error: null,
			refreshedAt: null,
		},
	);
	const modelCalls = $derived(controller.runtimeState.modelCallsBySession[sessionId] ?? []);
	const cycles = $derived(controller.runtimeState.chatCyclesBySession[sessionId] ?? []);
	const notifications = $derived(
		controller.runtimeState.notifications.filter((notification) => notification.sessionId === sessionId),
	);
	const activeCycle = $derived(runtime?.activeCycle ?? null);
	const latestCycle = $derived(cycles[cycles.length - 1] ?? activeCycle ?? null);
	const tabs = $derived(buildRuntimeTabs({ activeCycle, latestCycle }));
	const workspaceLabel = $derived(session ? basenameWorkspace(session.workspacePath) : 'Unknown workspace');
	const sessionIconUrl = $derived(session ? controller.runtimeStore.sessionIconUrl(session.id) : null);
	const unreadCount = $derived(controller.runtimeState.unreadBySession[sessionId] ?? 0);
	const isRunning = $derived(session?.status === 'running' || session?.status === 'starting');
	const heartbeatConfigBinding = $derived(readRuntimeHeartbeatConfigBinding(heartbeatConfigGraph, heartbeatConfigLayerFile));
	const heartbeatProviderMetadata = $derived(heartbeatConfigBinding.providerMetadata);
	const heartbeatSchedulerState = $derived(runtime?.schedulerState ?? null);
	const heartbeatCompactDisabled = $derived(session?.status !== 'running' || runtime?.activeCycle?.kind === 'compact');
	const runtimeLoading = $derived(
		shellHydrating ||
			controller.runtimeState.connectionStatus === 'connecting' ||
			controller.runtimeState.connectionStatus === 'reconnecting',
	);

	const openRoom = async (chatId: string): Promise<void> => {
		await goto(buildMessageRoomHref({ chatId, sessionId }));
	};

	const openTerminal = async (terminalId: string): Promise<void> => {
		await goto(`/terminals/${encodeURIComponent(terminalId)}`);
	};

	const toggleRuntime = async (): Promise<void> => {
		if (!session) {
			return;
		}
		if (session.status === 'running' || session.status === 'starting') {
			await controller.runtimeStore.stopSession(session.id);
			return;
		}
		await controller.runtimeStore.startSession(session.id);
	};

	const loadHeartbeatConfig = async (preserveLayerId?: string | null): Promise<void> => {
		if (!session) {
			heartbeatConfigGraph = null;
			heartbeatConfigLayerFile = null;
			return;
		}
		const token = ++heartbeatConfigLoadVersion;
		heartbeatConfigLoading = true;
		heartbeatConfigError = null;
		try {
			const nextGraph = await controller.runtimeStore.listRuntimeSettingsScope(session.id);
			if (token !== heartbeatConfigLoadVersion) {
				return;
			}
			heartbeatConfigGraph = nextGraph;
			const nextLayerId =
				(preserveLayerId && nextGraph.layers.some((layer) => layer.layerId === preserveLayerId) ? preserveLayerId : null) ??
				pickEditableSettingsLayerId(nextGraph);
			if (!nextLayerId) {
				heartbeatConfigLayerFile = null;
				return;
			}
			const nextLayerFile = await controller.runtimeStore.readRuntimeSettingsLayer(session.id, nextLayerId);
			if (token !== heartbeatConfigLoadVersion) {
				return;
			}
			heartbeatConfigLayerFile = nextLayerFile;
		} catch (error) {
			if (token !== heartbeatConfigLoadVersion) {
				return;
			}
			heartbeatConfigError = error instanceof Error ? error.message : 'Failed to load Heartbeat config.';
			heartbeatConfigGraph = null;
			heartbeatConfigLayerFile = null;
		} finally {
			if (token === heartbeatConfigLoadVersion) {
				heartbeatConfigLoading = false;
			}
		}
	};

	const saveHeartbeatConfig = async (
		draft: Parameters<typeof writeRuntimeHeartbeatConfigLayer>[0]['draft'],
	): Promise<void> => {
		if (!session || !heartbeatConfigLayerFile || !heartbeatConfigBinding.activeProviderId || !heartbeatConfigBinding.editableLayerId) {
			return;
		}
		heartbeatConfigSaving = true;
		heartbeatConfigError = null;
		try {
			const nextContent = writeRuntimeHeartbeatConfigLayer({
				content: heartbeatConfigLayerFile.content,
				draft,
			});
			const result = await controller.runtimeStore.saveRuntimeSettingsLayer({
				sessionId: session.id,
				layerId: heartbeatConfigBinding.editableLayerId,
				content: nextContent,
				baseMtimeMs: heartbeatConfigLayerFile.mtimeMs,
			});
			if (!result.ok) {
				heartbeatConfigError =
					result.reason === 'readonly'
						? result.message
						: 'Conflict while saving Heartbeat config. Reloaded the latest layer.';
				if (result.reason === 'conflict') {
					heartbeatConfigLayerFile = result.latest;
				}
				return;
			}
			heartbeatConfigLayerFile = result.file;
			await loadHeartbeatConfig(result.file.layer.layerId);
		} catch (error) {
			heartbeatConfigError = error instanceof Error ? error.message : 'Failed to save Heartbeat config.';
		} finally {
			heartbeatConfigSaving = false;
		}
	};

	const requestHeartbeatCompact = async (): Promise<void> => {
		if (!session || heartbeatCompactPending || heartbeatCompactDisabled) {
			return;
		}
		heartbeatCompactPending = true;
		try {
			await controller.runtimeStore.requestRuntimeCompact(session.id);
		} finally {
			heartbeatCompactPending = false;
		}
	};

	$effect(() => {
		const requestedSessionId = sessionId;
		const version = ++shellHydrationVersion;
		shellHydrating = true;
		shellHydrationError = null;
		void controller.runtimeStore
			.hydrateSessionArtifacts(requestedSessionId)
			.catch((error) => {
				if (version !== shellHydrationVersion) {
					return;
				}
				shellHydrationError = error instanceof Error ? error.message : 'Unable to hydrate runtime facts.';
			})
			.finally(() => {
				if (version === shellHydrationVersion) {
					shellHydrating = false;
				}
			});
	});

	$effect(() => {
		if (!session) {
			return;
		}
		if (attemptedCycleLoads.has(session.id) || pendingCycleLoads.has(session.id)) {
			return;
		}
		attemptedCycleLoads.add(session.id);
		pendingCycleLoads.add(session.id);
		void controller.runtimeStore.loadChatCycles(session.id).finally(() => {
			pendingCycleLoads.delete(session.id);
		});
	});

	$effect(() => {
		const configSessionId = session?.id ?? null;
		if (!configSessionId) {
			heartbeatConfigGraph = null;
			heartbeatConfigLayerFile = null;
			heartbeatConfigError = null;
			heartbeatConfigSessionId = null;
			return;
		}
		if (heartbeatConfigSessionId === configSessionId) {
			return;
		}
		heartbeatConfigSessionId = configSessionId;
		void loadHeartbeatConfig(null);
	});
</script>

{#if session}
	<WorkbenchPageToolbar>
		<RuntimePageToolbarContent
			sessionId={session.id}
			title={session.avatar || session.name}
			{workspaceLabel}
			statusLabel={resolveRuntimeStatusLabel(session.status)}
			{unreadCount}
			{sessionIconUrl}
			{activeTab}
			{tabs}
			{isRunning}
			onToggleRuntime={toggleRuntime}
		/>
	</WorkbenchPageToolbar>
{/if}

{#if !session}
	<div class="flex h-full items-center justify-center p-6">
		<Card.Root class="max-w-lg">
			<Card.Header>
				<Card.Title>{runtimeLoading ? 'Hydrating runtime facts' : 'Runtime unavailable'}</Card.Title>
				<Card.Description>
					{#if runtimeLoading}
						Loading persisted Heartbeat, Attention, and Settings facts for this AvatarSession.
					{:else}
						The selected AvatarSession no longer exists in the global runtime snapshot.
					{/if}
				</Card.Description>
			</Card.Header>
			{#if shellHydrationError}
				<Card.Content class="pt-0 text-sm text-muted-foreground">
					{shellHydrationError}
				</Card.Content>
			{/if}
		</Card.Root>
	</div>
{:else}
	<WorkbenchScaffold tone="page" body="body" bodyClass="h-full" data-testid="runtime-shell">
		<RuntimePrimaryStage
			tab={activeTab}
			{session}
			{runtime}
			{channels}
			{notifications}
			{heartbeatGroups}
			{modelCalls}
			heartbeatSchedulerState={heartbeatSchedulerState}
			heartbeatProviderMetadata={heartbeatProviderMetadata}
			heartbeatConfigBinding={heartbeatConfigBinding}
			heartbeatConfigLoading={heartbeatConfigLoading}
			heartbeatConfigSaving={heartbeatConfigSaving}
			heartbeatConfigError={heartbeatConfigError}
			heartbeatCompactPending={heartbeatCompactPending}
			heartbeatCompactDisabled={heartbeatCompactDisabled}
			{sessionIconUrl}
			avatarLabel={session.avatar || session.name}
			onOpenRoom={(chatId) => void openRoom(chatId)}
			onOpenTerminal={(terminalId) => void openTerminal(terminalId)}
			onSetRoomVisibility={async (chatId, focused) => {
				await controller.runtimeStore.setChatVisibility({
					sessionId: session.id,
					chatId,
					visible: true,
					focused,
				});
			}}
			onSetTerminalVisibility={async (terminalId, focused) => {
				await controller.runtimeStore.setTerminalVisibility({
					sessionId: session.id,
					terminalId,
					visible: true,
					focused,
				});
			}}
			onConsumeNotification={async (input) => {
				await controller.runtimeStore.consumeNotifications({
					sessionId: session.id,
					chatId: input.chatId,
					terminalId: input.terminalId,
					upToMessageId: input.upToMessageId ?? null,
				});
			}}
			onLoadOlderHeartbeat={() => controller.runtimeStore.loadMoreHeartbeatInspection(session.id)}
			onRequestHeartbeatCompact={() => void requestHeartbeatCompact()}
			onRefreshHeartbeatConfig={() => void loadHeartbeatConfig(heartbeatConfigBinding.editableLayerId)}
			onSaveHeartbeatConfig={saveHeartbeatConfig}
		/>
	</WorkbenchScaffold>
{/if}
