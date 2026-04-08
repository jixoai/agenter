<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';

	import { toPrettyJson, tryParseJson } from './settings-json-pointer';
	import SettingsSchemaView from './settings-schema-view.svelte';
	import SettingsSourceEditor from './settings-source-editor.svelte';
	import type { SettingsEffectiveGraph, SettingsLayerItem, SettingsPointerJumpTarget } from './settings-graph-types';

	let {
		disabled = false,
		loading = false,
		saving = false,
		status,
		title = 'Workspace settings',
		description = 'Inspect effective settings, per-layer sources, and provenance jumps without leaving the workspace settings workbench.',
		effective,
		layers,
		selectedLayerId,
		layerContent,
		detailMode = 'split',
		onSelectLayer,
		onLayerContentChange,
		onRefreshLayers,
		onLoadLayer,
		onSaveLayer,
	}: {
		disabled?: boolean;
		loading?: boolean;
		saving?: boolean;
		status: string;
		title?: string;
		description?: string;
		effective: SettingsEffectiveGraph;
		layers: SettingsLayerItem[];
		selectedLayerId: string | null;
		layerContent: string;
		detailMode?: 'split' | 'sheet';
		onSelectLayer: (layerId: string) => void;
		onLayerContentChange: (content: string) => void;
		onRefreshLayers: () => void;
		onLoadLayer: (layerId: string) => void;
		onSaveLayer: () => void;
	} = $props();

	let activeTab = $state<'effective' | 'layers'>('effective');
	let effectiveViewMode = $state<'source' | 'view'>('view');
	let layerViewMode = $state<'source' | 'view'>('source');
	let detailOpen = $state(false);
	let focusedLayerPointer = $state<string | null>(null);

	const selectedLayer = $derived(layers.find((layer) => layer.layerId === selectedLayerId) ?? null);
	const effectiveValue = $derived(effective.value ?? tryParseJson(effective.content) ?? {});
	const layerDraft = $derived(tryParseJson(layerContent));

	const openLayer = (layerId: string): void => {
		focusedLayerPointer = null;
		onSelectLayer(layerId);
		onLoadLayer(layerId);
		if (detailMode === 'sheet') {
			detailOpen = true;
		}
	};

	const jumpToLayer = (target: SettingsPointerJumpTarget): void => {
		if (!layers.some((layer) => layer.layerId === target.layerId)) {
			return;
		}
		activeTab = 'layers';
		layerViewMode = 'view';
		focusedLayerPointer = target.pointer;
		openLayer(target.layerId);
	};

	$effect(() => {
		if (activeTab !== 'layers' || detailMode !== 'sheet') {
			detailOpen = false;
			return;
		}
		if (selectedLayerId) {
			detailOpen = true;
		}
	});
</script>

<WorkbenchScaffold tone="pane" bodyClass="h-full p-4" data-testid="workspace-settings-panel">
	{#snippet header()}
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="grid gap-1">
				<h2 class="text-base font-semibold">{title}</h2>
				<p class="text-sm text-muted-foreground">{description}</p>
			</div>
			<Badge variant="outline">{saving ? 'Saving…' : status}</Badge>
		</div>

		<Tabs.Root value={activeTab} onValueChange={(value) => (activeTab = value as 'effective' | 'layers')}>
			<Tabs.List>
				<Tabs.Trigger value="effective">Effective</Tabs.Trigger>
				<Tabs.Trigger value="layers">Layer Sources</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>
	{/snippet}

	{#if loading}
		<div class="flex h-full items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
			Loading workspace settings…
		</div>
	{:else if activeTab === 'effective'}
		<div class="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3">
			<Tabs.Root
				value={effectiveViewMode}
				onValueChange={(value) => (effectiveViewMode = value as 'source' | 'view')}
			>
				<Tabs.List>
					<Tabs.Trigger value="view">View</Tabs.Trigger>
					<Tabs.Trigger value="source">Source</Tabs.Trigger>
				</Tabs.List>
			</Tabs.Root>

			{#if effectiveViewMode === 'source'}
				<SettingsSourceEditor value={effective.content} readOnly testId="settings-effective-source-editor" class="h-full" />
			{:else}
				<ScrollView class="h-full" viewportTestId="settings-effective-view-viewport" contentClass="grid gap-2 pr-2">
					<SettingsSchemaView
						schema={effective.schema}
						value={effectiveValue}
						mode="readonly"
						provenance={effective.provenance}
						onJumpToSource={jumpToLayer}
					/>
				</ScrollView>
			{/if}
		</div>
	{:else}
		<div class={detailMode === 'split' ? 'grid h-full gap-3 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]' : 'grid h-full'}>
			<section class="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-border/70 bg-background/50 p-2">
				<header class="mb-2 flex items-center justify-between gap-2">
					<div class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Layer files</div>
					<Button size="sm" variant="outline" onclick={onRefreshLayers} disabled={disabled}>
						Refresh
					</Button>
				</header>

				<ScrollView class="h-full" viewportTestId="settings-sources-scroll-viewport" contentClass="grid gap-1 pr-1">
					{#if layers.length === 0}
						<div class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
							No settings layers discovered for this workspace.
						</div>
					{:else}
						{#each layers as layer (layer.layerId)}
							<button
								type="button"
								class={`rounded-lg border px-3 py-3 text-left transition-colors ${
									layer.layerId === selectedLayerId
										? 'border-primary/40 bg-primary/5'
										: 'border-border/70 bg-card hover:bg-muted/50'
								}`}
								onclick={() => openLayer(layer.layerId)}
							>
								<div class="mb-2 flex flex-wrap items-center gap-1">
									<Badge variant="secondary">{layer.kind}</Badge>
									<Badge variant={layer.editable ? 'outline' : 'destructive'}>
										{layer.editable ? 'editable' : 'readonly'}
									</Badge>
								</div>
								<div class="text-sm font-medium">{layer.sourceId}</div>
								<div class="mt-1 break-all text-xs text-muted-foreground">{layer.path}</div>
								{#if layer.readonlyReason}
									<div class="mt-1 text-[11px] text-destructive">{layer.readonlyReason}</div>
								{/if}
							</button>
						{/each}
					{/if}
				</ScrollView>
			</section>

			{#if detailMode === 'split'}
				<section class="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-xl border border-border/70 bg-background/50 p-3">
					<header class="flex flex-wrap items-start justify-between gap-2">
						<div class="grid gap-1">
							<h3 class="text-sm font-semibold">Layer Detail</h3>
							<div class="break-all text-xs text-muted-foreground">
								{selectedLayer?.path ?? 'Select a source layer'}
							</div>
						</div>
						<div class="flex items-center gap-2">
							<Button
								size="sm"
								variant="outline"
								disabled={!selectedLayerId || disabled}
								onclick={() => selectedLayerId && onLoadLayer(selectedLayerId)}
							>
								Reload
							</Button>
							<Button size="sm" disabled={!selectedLayer?.editable || disabled} onclick={onSaveLayer}>
								Save
							</Button>
						</div>
					</header>

					<Tabs.Root value={layerViewMode} onValueChange={(value) => (layerViewMode = value as 'source' | 'view')}>
						<Tabs.List>
							<Tabs.Trigger value="source">Source</Tabs.Trigger>
							<Tabs.Trigger value="view">View</Tabs.Trigger>
						</Tabs.List>
					</Tabs.Root>

					{#if layerViewMode === 'source'}
						<SettingsSourceEditor
							value={layerContent}
							onValueChange={(nextContent: string) => onLayerContentChange(nextContent)}
							readOnly={selectedLayer?.editable !== true}
							testId="settings-layer-source-editor"
							class="h-full"
						/>
					{:else if layerDraft}
						<ScrollView class="h-full" viewportTestId="settings-layer-view-viewport" contentClass="grid gap-2 pr-2">
							<SettingsSchemaView
								schema={effective.schema}
								value={layerDraft}
								mode={selectedLayer?.editable ? 'editable' : 'readonly'}
								focusPointer={focusedLayerPointer}
								onValueChange={(nextValue) => onLayerContentChange(toPrettyJson(nextValue))}
							/>
						</ScrollView>
					{:else}
						<div class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
							Layer source is not valid JSON. Switch to <code>Source</code> to repair it.
						</div>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</WorkbenchScaffold>

{#if detailMode === 'sheet' && activeTab === 'layers'}
	<Sheet.Root bind:open={detailOpen}>
		<Sheet.Content side="right" class="w-[min(40rem,calc(100vw-1rem))] p-0">
			<Sheet.Header class="border-b px-6 py-4">
				<Sheet.Title>Layer Detail</Sheet.Title>
				<Sheet.Description>{selectedLayer?.path ?? 'Select a source layer'}</Sheet.Description>
			</Sheet.Header>
			<div class="grid h-full min-h-[45dvh] grid-rows-[auto_minmax(0,1fr)] gap-3 p-4">
				<div class="flex items-center justify-end gap-2">
					<Button
						size="sm"
						variant="outline"
						disabled={!selectedLayerId || disabled}
						onclick={() => selectedLayerId && onLoadLayer(selectedLayerId)}
					>
						Reload
					</Button>
					<Button size="sm" disabled={!selectedLayer?.editable || disabled} onclick={onSaveLayer}>
						Save
					</Button>
				</div>

				<div class="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3">
					<Tabs.Root value={layerViewMode} onValueChange={(value) => (layerViewMode = value as 'source' | 'view')}>
						<Tabs.List>
							<Tabs.Trigger value="source">Source</Tabs.Trigger>
							<Tabs.Trigger value="view">View</Tabs.Trigger>
						</Tabs.List>
					</Tabs.Root>

					{#if layerViewMode === 'source'}
						<SettingsSourceEditor
							value={layerContent}
							onValueChange={(nextContent: string) => onLayerContentChange(nextContent)}
							readOnly={selectedLayer?.editable !== true}
							testId="settings-layer-source-editor"
							class="h-full"
						/>
					{:else if layerDraft}
						<ScrollView class="h-full" viewportTestId="settings-layer-view-viewport" contentClass="grid gap-2 pr-2">
							<SettingsSchemaView
								schema={effective.schema}
								value={layerDraft}
								mode={selectedLayer?.editable ? 'editable' : 'readonly'}
								focusPointer={focusedLayerPointer}
								onValueChange={(nextValue) => onLayerContentChange(toPrettyJson(nextValue))}
							/>
						</ScrollView>
					{:else}
						<div class="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
							Layer source is not valid JSON. Switch to <code>Source</code> to repair it.
						</div>
					{/if}
				</div>
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
