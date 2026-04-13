<script lang="ts">
	import type { SettingsEffectiveGraph, SettingsLayerFile, SettingsLayerItem } from './settings-graph-types';

	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import WorkspaceSettingsPanel from './workspace-settings-panel.svelte';

	let {
		effective,
		layers,
		layerFiles = {},
		layerContentById = {},
		initialSelectedLayerId = null,
		initialLayerContent = '',
		title = 'Runtime settings',
		description = 'Inspect effective settings and layer sources.',
		detailMode = 'split',
		onSelectLayer,
		onLoadLayer,
	}: {
		effective: SettingsEffectiveGraph;
		layers: SettingsLayerItem[];
		layerFiles?: Record<string, SettingsLayerFile>;
		layerContentById?: Record<string, string>;
		initialSelectedLayerId?: string | null;
		initialLayerContent?: string;
		title?: string;
		description?: string;
		detailMode?: 'split' | 'sheet';
		onSelectLayer?: (layerId: string) => void;
		onLoadLayer?: (layerId: string) => void;
	} = $props();

	let status = $state('Ready');
	let selectedLayerId = $state<string | null>(null);
	let currentFile = $state<SettingsLayerFile | null>(null);

	const resolveLayerFile = (layerId: string | null, fallbackContent = ''): SettingsLayerFile | null => {
		if (!layerId) {
			return null;
		}
		const layer = layers.find((candidate) => candidate.layerId === layerId);
		if (!layer) {
			return null;
		}
		return (
			layerFiles[layerId] ?? {
				layer,
				path: layer.path,
				content: layerContentById[layerId] ?? fallbackContent,
				mtimeMs: 0,
			}
		);
	};

	const selectLayer = (layerId: string): void => {
		selectedLayerId = layerId;
		onSelectLayer?.(layerId);
	};

	const loadLayer = (layerId: string): void => {
		currentFile = resolveLayerFile(layerId);
		selectedLayerId = layerId;
		status = `Loaded ${layerId}`;
		onLoadLayer?.(layerId);
	};

	const saveLayer = (): void => {
		status = `Saved ${selectedLayerId ?? 'layer'}`;
	};

	$effect(() => {
		const nextSelectedLayerId = initialSelectedLayerId ?? layers[0]?.layerId ?? null;
		selectedLayerId = nextSelectedLayerId;
		currentFile = resolveLayerFile(nextSelectedLayerId, initialLayerContent);
		status = 'Ready';
	});
</script>

<Tooltip.Provider delayDuration={0}>
	<div class="grid h-[44rem] gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4">
		<WorkspaceSettingsPanel
			status={status}
			loading={false}
			saving={false}
			disabled={false}
			{title}
			{description}
			{effective}
			{layers}
			{selectedLayerId}
			layerContent={currentFile?.content ?? ''}
			{detailMode}
			onSelectLayer={selectLayer}
			onLayerContentChange={(content) => {
				currentFile = currentFile
					? {
							...currentFile,
							content,
						}
					: null;
			}}
			onRefreshLayers={() => {
				status = 'Refreshed';
			}}
			onLoadLayer={loadLayer}
			onSaveLayer={saveLayer}
		/>
	</div>
</Tooltip.Provider>
