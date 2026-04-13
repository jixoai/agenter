<script lang="ts">
	import type { RuntimeSnapshotEntry, SessionEntry } from '@agenter/client-sdk';
	import type { SettingsLayerFile } from '$lib/features/settings/settings-graph-types';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import WorkspaceSettingsPanel from '$lib/features/settings/workspace-settings-panel.svelte';

	const controller = getAppControllerContext();

	let {
		session,
		runtime,
	}: {
		session: SessionEntry;
		runtime: RuntimeSnapshotEntry | null;
	} = $props();

	let detailMode = $state<'split' | 'sheet'>('split');
	let loading = $state(false);
	let saving = $state(false);
	let status = $state('Loading runtime settings…');
	let settingsGraph = $state<Awaited<ReturnType<typeof controller.runtimeStore.listRuntimeSettingsScope>> | null>(null);
	let selectedLayerId = $state<string | null>(null);
	let layerFile = $state<SettingsLayerFile | null>(null);

	let graphLoadToken = 0;
	let layerLoadToken = 0;

	const runtimeLabel = $derived(session.avatar || session.name);

	const loadLayer = async (layerId: string): Promise<void> => {
		const token = ++layerLoadToken;
		status = `Loading ${layerId}…`;
		const nextLayerFile = await controller.runtimeStore.readRuntimeSettingsLayer(session.id, layerId);
		if (token !== layerLoadToken) {
			return;
		}
		layerFile = nextLayerFile;
		selectedLayerId = nextLayerFile.layer.layerId;
		status = `Loaded ${nextLayerFile.layer.sourceId}.`;
	};

	const loadSettingsGraph = async (preserveLayerId?: string | null): Promise<void> => {
		const token = ++graphLoadToken;
		loading = true;
		status = `Loading settings for ${runtimeLabel}…`;
		try {
			const nextGraph = await controller.runtimeStore.listRuntimeSettingsScope(session.id);
			if (token !== graphLoadToken) {
				return;
			}
			settingsGraph = nextGraph;
			const nextLayerId =
				(preserveLayerId && nextGraph.layers.some((layer) => layer.layerId === preserveLayerId) ? preserveLayerId : null) ??
				nextGraph.layers.find((layer) => layer.editable)?.layerId ??
				nextGraph.layers[0]?.layerId ??
				null;
			selectedLayerId = nextLayerId;
			if (nextLayerId) {
				await loadLayer(nextLayerId);
			} else {
				layerFile = null;
				status = 'No runtime settings layers discovered.';
			}
		} catch (error) {
			if (token !== graphLoadToken) {
				return;
			}
			settingsGraph = null;
			layerFile = null;
			selectedLayerId = null;
			status = error instanceof Error ? error.message : 'Failed to load runtime settings.';
		} finally {
			if (token === graphLoadToken) {
				loading = false;
			}
		}
	};

	const saveLayer = async (): Promise<void> => {
		if (!selectedLayerId || !layerFile) {
			return;
		}
		saving = true;
		status = `Saving ${layerFile.layer.sourceId}…`;
		try {
			const result = await controller.runtimeStore.saveRuntimeSettingsLayer({
				sessionId: session.id,
				layerId: selectedLayerId,
				content: layerFile.content,
				baseMtimeMs: layerFile.mtimeMs,
			});
			if (!result.ok) {
				status =
					result.reason === 'readonly'
						? result.message
						: `Conflict while saving ${layerFile.layer.sourceId}. Reloaded the latest version instead.`;
				if (result.reason === 'conflict') {
					layerFile = result.latest;
				}
				return;
			}
			layerFile = result.file;
			await loadSettingsGraph(result.file.layer.layerId);
			status = `Saved ${result.file.layer.sourceId}.`;
		} catch (error) {
			status = error instanceof Error ? error.message : 'Failed to save runtime settings.';
		} finally {
			saving = false;
		}
	};

	$effect(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return;
		}
		const mediaQuery = window.matchMedia('(max-width: 1023.98px), ((max-width: 1279.98px) and (orientation: portrait))');
		const syncMode = (): void => {
			detailMode = mediaQuery.matches ? 'sheet' : 'split';
		};
		syncMode();
		mediaQuery.addEventListener('change', syncMode);
		return () => {
			mediaQuery.removeEventListener('change', syncMode);
		};
	});

	$effect(() => {
		void runtime;
		void loadSettingsGraph(selectedLayerId);
	});
</script>

<div class="grid h-full" data-testid="runtime-settings-stage">
	<WorkspaceSettingsPanel
		disabled={saving}
		{loading}
		{saving}
		{status}
		title={`${runtimeLabel} runtime settings`}
		description={`Inspect effective settings, per-layer sources, and provenance for ${runtimeLabel} in ${session.workspacePath}.`}
		effective={
			settingsGraph?.effective ?? {
				content: '{}\n',
				value: {},
				schema: { type: 'object' },
				provenance: {},
			}
		}
		layers={settingsGraph?.layers ?? []}
		{selectedLayerId}
		layerContent={layerFile?.content ?? ''}
		{detailMode}
		onSelectLayer={(layerId) => {
			selectedLayerId = layerId;
		}}
		onLayerContentChange={(content) => {
			layerFile = layerFile
				? {
						...layerFile,
						content,
					}
				: null;
		}}
		onRefreshLayers={() => {
			void loadSettingsGraph(selectedLayerId);
		}}
		onLoadLayer={(layerId) => {
			void loadLayer(layerId);
		}}
		onSaveLayer={() => void saveLayer()}
	/>
</div>
