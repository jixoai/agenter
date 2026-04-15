<script lang="ts">
	import type { SettingsEffectiveGraph, SettingsLayerFile, SettingsLayerItem } from './settings-graph-types';

	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import WorkspaceSettingsPanel from './workspace-settings-panel.svelte';

	let {
		disabled = false,
		loading = false,
		saving = false,
		status = 'layers refreshed',
		title = 'Workspace settings',
		description = 'Inspect effective settings and source layers.',
		compactShell = false,
		effective,
		layers,
		layerFiles = {},
		layerContentById = {},
		initialSelectedLayerId = null,
		initialLayerContent = '{}\n',
		onSelectLayer,
		onLayerContentChange,
		onRefreshLayers,
		onLoadLayer,
		onSaveLayer,
	}: {
		disabled?: boolean;
		loading?: boolean;
		saving?: boolean;
		status?: string;
		title?: string;
		description?: string;
		compactShell?: boolean;
		effective: SettingsEffectiveGraph;
		layers: SettingsLayerItem[];
		layerFiles?: Record<string, SettingsLayerFile>;
		layerContentById?: Record<string, string>;
		initialSelectedLayerId?: string | null;
		initialLayerContent?: string;
		onSelectLayer?: (layerId: string) => void;
		onLayerContentChange?: (content: string) => void;
		onRefreshLayers?: () => void;
		onLoadLayer?: (layerId: string) => void;
		onSaveLayer?: () => void;
	} = $props();

	let liveStatus = $state(status);
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
		currentFile = resolveLayerFile(layerId, currentFile?.content ?? initialLayerContent);
		selectedLayerId = layerId;
		liveStatus = `Loaded ${layerId}`;
		onLoadLayer?.(layerId);
	};

	const saveLayer = (): void => {
		liveStatus = `Saved ${selectedLayerId ?? 'layer'}`;
		onSaveLayer?.();
	};

	$effect(() => {
		liveStatus = status;
	});

	$effect(() => {
		const nextSelectedLayerId = initialSelectedLayerId ?? layers[0]?.layerId ?? null;
		selectedLayerId = nextSelectedLayerId;
		currentFile = resolveLayerFile(nextSelectedLayerId, initialLayerContent);
		liveStatus = status;
	});
</script>

<Tooltip.Provider delayDuration={0}>
	<div class={compactShell ? 'h-[860px] max-w-[40rem] p-6' : 'h-[860px] p-6'}>
		<WorkspaceSettingsPanel
			{disabled}
			{loading}
			{saving}
			status={liveStatus}
			{title}
			{description}
			{effective}
			{layers}
			{selectedLayerId}
			layerContent={currentFile?.content ?? ''}
			onSelectLayer={selectLayer}
			onLayerContentChange={(content) => {
				currentFile = currentFile
					? {
							...currentFile,
							content,
						}
					: null;
				onLayerContentChange?.(content);
			}}
			onRefreshLayers={() => {
				liveStatus = 'Refreshed';
				onRefreshLayers?.();
			}}
			onLoadLayer={loadLayer}
			onSaveLayer={saveLayer}
		/>
	</div>
</Tooltip.Provider>
