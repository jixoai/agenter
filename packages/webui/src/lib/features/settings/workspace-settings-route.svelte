<script lang="ts">
	import { SplitView } from '@agenter/svelte-components';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import type { SettingsLayerFile } from './settings-graph-types';
	import type { ScopedSettingsOutput } from '@agenter/client-sdk';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import {
		describeCompactWorkspace,
		resolveObjectiveWorkspacePath,
		sortWorkspacesForCatalog,
	} from '$lib/features/workspaces/workspace-sorting';

	import WorkspaceSettingsPanel from './workspace-settings-panel.svelte';

	const controller = getAppControllerContext();

	let selectedWorkspacePath = $state(page.url.searchParams.get('path') ?? '');
	let detailMode = $state<'split' | 'sheet'>('split');
	let loading = $state(false);
	let saving = $state(false);
	let status = $state('Select a workspace to inspect settings.');
	let settingsGraph = $state<ScopedSettingsOutput | null>(null);
	let selectedLayerId = $state<string | null>(null);
	let layerFile = $state<SettingsLayerFile | null>(null);

	let graphLoadToken = 0;
	let layerLoadToken = 0;

	const sortedWorkspaces = $derived(
		sortWorkspacesForCatalog(controller.runtimeState.workspaces, controller.runtimeState.recentWorkspaces),
	);
	const preferredWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path !== '~/') ?? sortedWorkspaces[0] ?? null,
	);
	const selectedWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path === selectedWorkspacePath) ?? preferredWorkspace ?? null,
	);
	const describeObjectiveWorkspacePath = (workspacePath: string): string =>
		resolveObjectiveWorkspacePath(
			sortedWorkspaces.find((workspace) => workspace.path === workspacePath) ?? { path: workspacePath },
			sortedWorkspaces,
		);

	const scopeInputForWorkspace = (workspacePath: string): { scope: 'workspace' | 'global'; workspacePath?: string } =>
		workspacePath === '~/' ? { scope: 'global' } : { scope: 'workspace', workspacePath };

	const syncWorkspaceSelection = async (workspacePath: string): Promise<void> => {
		selectedWorkspacePath = workspacePath;
		await goto(`/avatars/settings?path=${encodeURIComponent(workspacePath)}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const loadLayer = async (layerId: string, workspacePath = selectedWorkspace?.path ?? ''): Promise<void> => {
		if (!workspacePath) {
			return;
		}
		const token = ++layerLoadToken;
		status = `Loading ${layerId}…`;
		const nextLayerFile = (await controller.runtimeStore.readScopedSettingsLayer({
			...scopeInputForWorkspace(workspacePath),
			layerId,
		})) satisfies SettingsLayerFile;
		if (token !== layerLoadToken) {
			return;
		}
		layerFile = nextLayerFile;
		selectedLayerId = nextLayerFile.layer.layerId;
		status = `Loaded ${nextLayerFile.layer.sourceId}.`;
	};

	const loadSettingsGraph = async (workspacePath: string, preserveLayerId?: string | null): Promise<void> => {
		const token = ++graphLoadToken;
		loading = true;
		status = `Loading settings for ${describeObjectiveWorkspacePath(workspacePath)}…`;
		try {
			const nextGraph = await controller.runtimeStore.listScopedSettings(scopeInputForWorkspace(workspacePath));
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
				await loadLayer(nextLayerId, workspacePath);
			} else {
				layerFile = null;
				status = 'No settings layers discovered.';
			}
		} catch (error) {
			if (token !== graphLoadToken) {
				return;
			}
			settingsGraph = null;
			layerFile = null;
			selectedLayerId = null;
			status = error instanceof Error ? error.message : 'Failed to load workspace settings.';
		} finally {
			if (token === graphLoadToken) {
				loading = false;
			}
		}
	};

	const saveLayer = async (): Promise<void> => {
		const workspacePath = selectedWorkspace?.path;
		if (!workspacePath || !selectedLayerId || !layerFile) {
			return;
		}
		saving = true;
		status = `Saving ${layerFile.layer.sourceId}…`;
		try {
			const result = await controller.runtimeStore.saveScopedSettingsLayer({
				...scopeInputForWorkspace(workspacePath),
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
					layerFile = result.latest satisfies SettingsLayerFile;
				}
				return;
			}
			layerFile = result.file satisfies SettingsLayerFile;
			await loadSettingsGraph(workspacePath, result.file.layer.layerId);
			status = `Saved ${result.file.layer.sourceId}.`;
		} catch (error) {
			status = error instanceof Error ? error.message : 'Failed to save layer.';
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
		if (!sortedWorkspaces.length) {
			return;
		}
		if (!selectedWorkspacePath || !sortedWorkspaces.some((workspace) => workspace.path === selectedWorkspacePath)) {
			void syncWorkspaceSelection(preferredWorkspace?.path ?? sortedWorkspaces[0]!.path);
		}
	});

	$effect(() => {
		if (!selectedWorkspace?.path) {
			return;
		}
		void loadSettingsGraph(selectedWorkspace.path, selectedLayerId);
	});
</script>

<SplitView.Root variant="sidebar-content" data-testid="workspace-settings-route">
	<SplitView.Sidebar>
		<WorkbenchScaffold tone="pane" body="scroll" contentClass="divide-y px-0 py-0">
			{#snippet header()}
				<h1 class="text-base font-semibold">Workspaces</h1>
			{/snippet}

			{#if sortedWorkspaces.length === 0}
				<div class="px-4 py-4 text-sm text-muted-foreground">No workspaces discovered yet.</div>
			{:else}
				{#each sortedWorkspaces as workspace (workspace.path)}
					<button
						type="button"
						class={`grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/35 ${
							selectedWorkspace?.path === workspace.path ? 'bg-primary/5' : ''
						}`}
						onclick={() => void syncWorkspaceSelection(workspace.path)}
					>
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<div class="truncate text-sm font-semibold">{describeCompactWorkspace(workspace.path)}</div>
							</div>
							{#if workspace.favorite}
								<div class="rounded-full border px-2 py-1 text-[11px]">Favorite</div>
							{/if}
						</div>
					</button>
				{/each}
			{/if}
		</WorkbenchScaffold>
	</SplitView.Sidebar>

	<SplitView.Content>
		<div class="grid h-full">
			<WorkspaceSettingsPanel
				disabled={saving}
				{loading}
				{saving}
				{status}
				title={selectedWorkspace ? describeObjectiveWorkspacePath(selectedWorkspace.path) : 'Workspace settings'}
				description={
					selectedWorkspace
						? `Inspect source layers, inherited values, and effective settings for ${describeObjectiveWorkspacePath(selectedWorkspace.path)}.`
						: 'Select a workspace to inspect source layers and effective settings.'
				}
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
					if (selectedWorkspace?.path) {
						void loadSettingsGraph(selectedWorkspace.path, selectedLayerId);
					}
				}}
				onLoadLayer={(layerId) => {
					if (selectedWorkspace?.path) {
						void loadLayer(layerId, selectedWorkspace.path);
					}
				}}
				onSaveLayer={() => void saveLayer()}
			/>
		</div>
	</SplitView.Content>
</SplitView.Root>
