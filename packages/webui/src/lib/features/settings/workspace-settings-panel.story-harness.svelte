<script lang="ts">
	import WorkspaceSettingsPanel from './workspace-settings-panel.svelte';
	import type { SettingsEffectiveGraph, SettingsLayerItem } from './settings-graph-types';

	let {
		disabled = false,
		loading = false,
		saving = false,
		status = 'layers refreshed',
		title = 'Workspace settings',
		description = 'Inspect effective settings and source layers.',
		detailMode = 'split',
		effective,
		layers,
		initialSelectedLayerId = null,
		initialLayerContent = '{}\n',
		layerContentById = {},
		onSelectLayer = () => undefined,
		onLayerContentChange = () => undefined,
		onRefreshLayers = () => undefined,
		onLoadLayer = () => undefined,
		onSaveLayer = () => undefined,
	}: {
		disabled?: boolean;
		loading?: boolean;
		saving?: boolean;
		status?: string;
		title?: string;
		description?: string;
		detailMode?: 'split' | 'sheet';
		effective: SettingsEffectiveGraph;
		layers: SettingsLayerItem[];
		initialSelectedLayerId?: string | null;
		initialLayerContent?: string;
		layerContentById?: Record<string, string>;
		onSelectLayer?: (layerId: string) => void;
		onLayerContentChange?: (content: string) => void;
		onRefreshLayers?: () => void;
		onLoadLayer?: (layerId: string) => void;
		onSaveLayer?: () => void;
	} = $props();

	let selectedLayerId = $state<string | null>(null);
	let layerContent = $state('');

	$effect(() => {
		if (selectedLayerId === null) {
			selectedLayerId = initialSelectedLayerId;
		}
		if (!layerContent) {
			layerContent = initialLayerContent;
		}
	});
</script>

<div class="h-[860px] p-6">
	<WorkspaceSettingsPanel
		{disabled}
		{loading}
		{saving}
		{status}
		{title}
		{description}
		{effective}
		{layers}
		{selectedLayerId}
		{layerContent}
		{detailMode}
		onSelectLayer={(layerId) => {
			selectedLayerId = layerId;
			onSelectLayer(layerId);
		}}
		onLayerContentChange={(content) => {
			layerContent = content;
			onLayerContentChange(content);
		}}
		onRefreshLayers={onRefreshLayers}
		onLoadLayer={(layerId) => {
			selectedLayerId = layerId;
			layerContent = layerContentById[layerId] ?? layerContent;
			onLoadLayer(layerId);
		}}
		onSaveLayer={onSaveLayer}
	/>
</div>
