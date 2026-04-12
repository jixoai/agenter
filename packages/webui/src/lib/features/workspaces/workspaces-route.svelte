<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SaveIcon from '@lucide/svelte/icons/save';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import { cn } from '$lib/utils.js';
	import WorkspaceTree from '$lib/features/workspaces/workspace-tree.svelte';
	import WorkspaceContentHeader from '$lib/features/workspaces/workspace-content-header.svelte';
	import {
		buildWorkspaceDetailHref,
		buildWorkspaceIndexHref,
		readWorkspaceAvatar,
		WORKSPACE_SEARCH_QUERY_PARAM,
	} from '$lib/features/workspaces/workspace-location';
	import {
		buildRuleDrafts,
		collectWorkspaceRuleMatchIds,
		buildWorkspaceTreeRows,
		collectWorkspaceTreeMatchPaths,
		normalizeWorkspaceMode,
		serializeRuleDrafts,
		toGrantRelativePath,
		type WorkspaceMode,
		type WorkspaceRuleDraft,
		type WorkspaceTreePages,
	} from '$lib/features/workspaces/workspace-workbench-state';
	import {
		describeCompactWorkspace,
		resolveObjectiveWorkspacePath,
		sortWorkspacesForCatalog,
	} from './workspace-sorting';

	let {
		workspacePath,
	}: {
		workspacePath: string;
	} = $props();

	const controller = getAppControllerContext();

	let selectedAvatar = $state(readWorkspaceAvatar(page.url.searchParams) ?? 'default');
	let mode = $state<WorkspaceMode>(normalizeWorkspaceMode(page.url.searchParams.get('mode')));
	let searchQuery = $state(page.url.searchParams.get(WORKSPACE_SEARCH_QUERY_PARAM) ?? '');
	let activeMatchIndex = $state(0);
	let routeSyncReady = $state(false);

	let explorerPages = $state<WorkspaceTreePages>({});
	let privatePages = $state<WorkspaceTreePages>({});
	let expandedExplorerPaths = $state<Set<string>>(new Set(['/']));
	let expandedPrivatePaths = $state<Set<string>>(new Set(['/']));
	let selectedExplorerPath = $state<string | null>('/');
	let selectedPrivatePath = $state<string | null>('/');
	let preview = $state<Awaited<ReturnType<typeof controller.runtimeStore.readWorkspaceWorkbenchPreview>> | null>(null);
	let previewLoading = $state(false);
	let assetRoots = $state<Awaited<ReturnType<typeof controller.runtimeStore.getRuntimeWorkspaceAssetRoots>> | null>(null);
	let rules = $state<WorkspaceRuleDraft[]>([]);
	let selectedRuleId = $state<string | null>(null);
	let rulesDirty = $state(false);
	let rulesSaving = $state(false);
	let quickRuleMode = $state<'ro' | 'rw'>('ro');
	let privateAssetName = $state('');
	let privateAssetKind = $state<'file' | 'directory'>('file');
	let privateAssetBusy = $state(false);

	const sortedWorkspaces = $derived(
		sortWorkspacesForCatalog(controller.runtimeState.workspaces, controller.runtimeState.recentWorkspaces),
	);
	const selectedWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path === workspacePath) ?? null,
	);
	const workspaceObjectivePath = $derived(
		selectedWorkspace
			? resolveObjectiveWorkspacePath(selectedWorkspace, sortedWorkspaces)
			: workspacePath.trim().length > 0
				? workspacePath
				: null,
	);
	const emptyCatalogState = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};
	const avatarCatalogState = $derived(
		selectedWorkspace ? controller.runtimeState.workspaceAvatarCatalogByPath[selectedWorkspace.path] ?? emptyCatalogState : emptyCatalogState,
	);
	const avatarOptions = $derived(avatarCatalogState.data);
	const selectedAvatarEntry = $derived(
		avatarOptions.find((entry) => entry.nickname === selectedAvatar) ?? avatarOptions[0] ?? null,
	);
	const runtimeId = $derived(selectedAvatarEntry?.runtimeId ?? null);
	const explorerRows = $derived(
		buildWorkspaceTreeRows({
			pages: explorerPages,
			expandedPaths: expandedExplorerPaths,
			searchQuery,
		}),
	);
	const privateRows = $derived(
		buildWorkspaceTreeRows({
			pages: privatePages,
			expandedPaths: expandedPrivatePaths,
			searchQuery,
		}),
	);
	const activeMatchIds = $derived(
		mode === 'private'
			? collectWorkspaceTreeMatchPaths(privatePages, searchQuery)
			: mode === 'explorer'
				? collectWorkspaceTreeMatchPaths(explorerPages, searchQuery)
				: collectWorkspaceRuleMatchIds(rules, searchQuery),
	);
	const activeMatchId = $derived(activeMatchIds[activeMatchIndex] ?? null);
	const activeSelectionPath = $derived(mode === 'private' ? selectedPrivatePath : selectedExplorerPath);
	const selectedRule = $derived(rules.find((rule) => rule.id === selectedRuleId) ?? rules[0] ?? null);
	const selectedRuleIndex = $derived(selectedRule ? rules.findIndex((rule) => rule.id === selectedRule.id) : -1);
	const selectedQuickRule = $derived(
		selectedExplorerPath ? rules.find((rule) => rule.relativePath === toGrantRelativePath(selectedExplorerPath)) ?? null : null,
	);
	const matchedRuleIdSet = $derived(new Set(collectWorkspaceRuleMatchIds(rules, searchQuery)));

	const listAncestorPaths = (path: string): string[] => {
		if (path === '/') {
			return ['/'];
		}
		const segments = path.split('/').filter(Boolean);
		const paths = ['/'];
		for (let index = 0; index < segments.length; index += 1) {
			paths.push(`/${segments.slice(0, index + 1).join('/')}`);
		}
		return paths;
	};

	const clearSearch = (): void => {
		searchQuery = '';
		activeMatchIndex = 0;
	};

	const revealTreePath = async (treeMode: 'explorer' | 'private', path: string): Promise<void> => {
		const nextExpandedPaths = new Set(treeMode === 'explorer' ? expandedExplorerPaths : expandedPrivatePaths);
		for (const directoryPath of listAncestorPaths(path).slice(0, -1)) {
			nextExpandedPaths.add(directoryPath);
			if (directoryPath === '/') {
				continue;
			}
			const pages = treeMode === 'explorer' ? explorerPages : privatePages;
			if (!pages[directoryPath]) {
				await loadTree(treeMode, directoryPath);
			}
		}
		if (treeMode === 'explorer') {
			expandedExplorerPaths = nextExpandedPaths;
			return;
		}
		expandedPrivatePaths = nextExpandedPaths;
	};

	const scrollActiveMatchIntoView = async (targetId: string): Promise<void> => {
		if (typeof document === 'undefined') {
			return;
		}
		await tick();
		const selector =
			mode === 'rules'
				? `[data-workspace-rule-id="${CSS.escape(targetId)}"]`
				: `[data-workspace-tree-path="${CSS.escape(targetId)}"]`;
		const element = document.querySelector<HTMLElement>(selector);
		element?.scrollIntoView({ block: 'nearest' });
	};

	const syncRoute = (): void => {
		if (!routeSyncReady || !selectedWorkspace) {
			return;
		}
		const nextHref = buildWorkspaceDetailHref({
			workspacePath: selectedWorkspace.path,
			avatar: selectedAvatarEntry?.nickname ?? selectedAvatar,
			mode,
			q: searchQuery.trim(),
		});
		const currentHref = `${page.url.pathname}${page.url.search}`;
		if (nextHref === currentHref) {
			return;
		}
		replaceState(nextHref, page.state);
	};

	const loadTree = async (
		treeMode: 'explorer' | 'private',
		path: string,
		offset = 0,
	): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry) {
			return;
		}
		const output = await controller.runtimeStore.listWorkspaceWorkbenchTree({
			workspacePath: selectedWorkspace.path,
			avatar: selectedAvatarEntry.nickname,
			mode: treeMode,
			path,
			offset,
		});
		if (treeMode === 'explorer') {
			explorerPages = { ...explorerPages, [output.rootPath]: output };
			return;
		}
		privatePages = { ...privatePages, [output.rootPath]: output };
	};

	const toggleExpandedPath = async (treeMode: 'explorer' | 'private', path: string): Promise<void> => {
		const current = treeMode === 'explorer' ? expandedExplorerPaths : expandedPrivatePaths;
		const next = new Set(current);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
			const pages = treeMode === 'explorer' ? explorerPages : privatePages;
			if (!pages[path]) {
				await loadTree(treeMode, path);
			}
		}
		if (treeMode === 'explorer') {
			expandedExplorerPaths = next;
			return;
		}
		expandedPrivatePaths = next;
	};

	const loadPreview = async (previewMode: 'explorer' | 'private', path: string | null): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry || !path) {
			preview = null;
			return;
		}
		previewLoading = true;
		try {
			preview = await controller.runtimeStore.readWorkspaceWorkbenchPreview({
				workspacePath: selectedWorkspace.path,
				avatar: selectedAvatarEntry.nickname,
				mode: previewMode,
				path,
			});
		} finally {
			previewLoading = false;
		}
	};

	const refreshWorkbenchContext = async (): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry || !runtimeId) {
			return;
		}
		const [nextGrants, nextRoots] = await Promise.all([
			controller.runtimeStore.listRuntimeWorkspaceGrants({
				runtimeId,
				workspacePath: selectedWorkspace.path,
			}),
			controller.runtimeStore.getRuntimeWorkspaceAssetRoots({
				workspacePath: selectedWorkspace.path,
				avatar: selectedAvatarEntry.nickname,
			}),
		]);
		const nextRules = buildRuleDrafts(nextGrants);
		rules = nextRules;
		selectedRuleId = nextRules[0]?.id ?? null;
		rulesDirty = false;
		assetRoots = nextRoots;
		explorerPages = {};
		privatePages = {};
		expandedExplorerPaths = new Set(['/']);
		expandedPrivatePaths = new Set(['/']);
		selectedExplorerPath = '/';
		selectedPrivatePath = '/';
		await Promise.all([loadTree('explorer', '/'), loadTree('private', '/')]);
		await loadPreview('explorer', '/');
	};

	const persistRules = async (): Promise<void> => {
		if (!selectedWorkspace || !runtimeId) {
			return;
		}
		rulesSaving = true;
		const currentSelectedRelativePath = selectedRule?.relativePath ?? null;
		try {
			const nextGrants = await controller.runtimeStore.grantRuntimeWorkspace({
				runtimeId,
				workspacePath: selectedWorkspace.path,
				grants: serializeRuleDrafts(rules),
			});
			const nextRules = buildRuleDrafts(nextGrants);
			rules = nextRules;
			selectedRuleId =
				(currentSelectedRelativePath
					? nextRules.find((rule) => rule.relativePath === currentSelectedRelativePath)?.id
					: null) ??
				nextRules[0]?.id ??
				null;
			rulesDirty = false;
			await loadTree('explorer', '/');
		} finally {
			rulesSaving = false;
		}
	};

	const addRule = (): void => {
		const nextRule: WorkspaceRuleDraft = {
			id: `draft-${crypto.randomUUID()}`,
			relativePath: selectedRule?.relativePath ?? selectedExplorerPath ?? '/',
			mode: selectedRule?.mode ?? quickRuleMode,
			enabled: true,
		};
		rules = [...rules, nextRule];
		selectedRuleId = nextRule.id;
		rulesDirty = true;
	};

	const stageQuickRule = (): void => {
		if (!selectedExplorerPath) {
			return;
		}
		const targetPath = toGrantRelativePath(selectedExplorerPath);
		const nextRules = rules.some((rule) => rule.relativePath === targetPath)
			? rules.map((rule) =>
					rule.relativePath === targetPath ? { ...rule, mode: quickRuleMode, enabled: true } : rule,
				)
			: [
					...rules,
					{
						id: `draft-${crypto.randomUUID()}`,
						relativePath: targetPath,
						mode: quickRuleMode,
						enabled: true,
					},
				];
		rules = nextRules;
		selectedRuleId = nextRules.find((rule) => rule.relativePath === targetPath)?.id ?? nextRules[0]?.id ?? null;
		rulesDirty = true;
	};

	const duplicateRule = (): void => {
		if (!selectedRule) {
			return;
		}
		const nextRule: WorkspaceRuleDraft = {
			...selectedRule,
			id: `draft-${crypto.randomUUID()}`,
			relativePath: `${selectedRule.relativePath}-copy`,
			enabled: false,
		};
		rules = [
			...rules,
			nextRule,
		];
		selectedRuleId = nextRule.id;
		rulesDirty = true;
	};

	const moveRule = (direction: -1 | 1): void => {
		if (selectedRuleIndex < 0) {
			return;
		}
		const nextIndex = selectedRuleIndex + direction;
		if (nextIndex < 0 || nextIndex >= rules.length) {
			return;
		}
		const nextRules = [...rules];
		const currentRule = nextRules[selectedRuleIndex]!;
		nextRules.splice(selectedRuleIndex, 1);
		nextRules.splice(nextIndex, 0, currentRule);
		rules = nextRules;
		rulesDirty = true;
	};

	const removeRule = (): void => {
		if (!selectedRule) {
			return;
		}
		const nextRules = rules.filter((rule) => rule.id !== selectedRule.id);
		rules = nextRules;
		selectedRuleId = nextRules[0]?.id ?? null;
		rulesDirty = true;
	};

	const createPrivateAsset = async (): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry || privateAssetName.trim().length === 0) {
			return;
		}
		privateAssetBusy = true;
		const parentPath = selectedPrivatePath ?? '/';
		try {
			const created = await controller.runtimeStore.createWorkspacePrivateAsset({
				workspacePath: selectedWorkspace.path,
				avatar: selectedAvatarEntry.nickname,
				parentPath,
				name: privateAssetName.trim(),
				kind: privateAssetKind,
			});
			privateAssetName = '';
			await loadTree('private', parentPath);
			selectedPrivatePath = created.path;
			await loadPreview('private', created.path);
		} finally {
			privateAssetBusy = false;
		}
	};

	const jumpToActiveMatch = async (direction: -1 | 1): Promise<void> => {
		if (activeMatchIds.length === 0) {
			return;
		}
		const nextIndex = (activeMatchIndex + direction + activeMatchIds.length) % activeMatchIds.length;
		activeMatchIndex = nextIndex;
		const nextTarget = activeMatchIds[nextIndex] ?? null;
		if (!nextTarget) {
			return;
		}
		if (mode === 'private') {
			await revealTreePath('private', nextTarget);
			selectedPrivatePath = nextTarget;
			await loadPreview('private', nextTarget);
			await scrollActiveMatchIntoView(nextTarget);
			return;
		}
		if (mode === 'explorer') {
			await revealTreePath('explorer', nextTarget);
			selectedExplorerPath = nextTarget;
			await loadPreview('explorer', nextTarget);
			await scrollActiveMatchIntoView(nextTarget);
			return;
		}
		selectedRuleId = nextTarget;
		await scrollActiveMatchIntoView(nextTarget);
	};

	$effect(() => {
		const workspacePath = selectedWorkspace?.path;
		if (!workspacePath) {
			return;
		}
		const release = controller.runtimeStore.retainWorkspaceAvatarCatalog(workspacePath);
		void controller.runtimeStore.hydrateWorkspaceAvatarCatalog(workspacePath);
		return () => {
			release();
		};
	});

	$effect(() => {
		if (!selectedAvatarEntry) {
			return;
		}
		selectedAvatar = selectedAvatarEntry.nickname;
	});

	$effect(() => {
		if (!selectedWorkspace || !selectedAvatarEntry || !runtimeId) {
			return;
		}
		void refreshWorkbenchContext();
	});

	$effect(() => {
		if (selectedQuickRule) {
			quickRuleMode = selectedQuickRule.mode;
		}
	});

	$effect(() => {
		if (activeMatchIds.length === 0) {
			activeMatchIndex = 0;
			return;
		}
		if (activeMatchIndex >= activeMatchIds.length) {
			activeMatchIndex = 0;
		}
	});

	$effect(() => {
		syncRoute();
	});

	onMount(() => {
		routeSyncReady = true;
	});
</script>

<WorkbenchPageToolbar>
	<div class="flex h-full items-center justify-end gap-3 px-3 md:px-4">
		<div class="hidden min-w-0 flex-1 md:block">
			<div class="truncate text-sm font-semibold">{selectedWorkspace ? describeCompactWorkspace(selectedWorkspace.path) : 'Workspaces'}</div>
		</div>
		<div class="flex items-center gap-1 rounded-full border bg-background/70 p-1">
			{#each ['explorer', 'rules', 'private'] as modeOption}
				<button
					type="button"
					class={cn(
						buttonVariants({
							size: 'sm',
							variant: mode === modeOption ? 'secondary' : 'ghost',
						}),
						'rounded-full',
					)}
					onclick={() => {
						mode = modeOption as WorkspaceMode;
					}}
				>
					{modeOption}
				</button>
			{/each}
		</div>
		<div class="hidden items-center gap-2 md:flex">
			<SearchIcon class="size-4 text-muted-foreground" />
			<Input
				bind:value={searchQuery}
				class="h-8 w-44 bg-background/70"
				placeholder={mode === 'rules' ? 'Search rules' : 'Search loaded tree'}
			/>
			{#if activeMatchIds.length > 0}
				<Badge variant="outline" class="bg-background/70">
					{activeMatchIndex + 1}/{activeMatchIds.length}
				</Badge>
				<button
					type="button"
					class={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
					onclick={() => void jumpToActiveMatch(-1)}
				>
					<ArrowUpIcon class="size-4" />
				</button>
				<button
					type="button"
					class={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
					onclick={() => void jumpToActiveMatch(1)}
				>
					<ArrowDownIcon class="size-4" />
				</button>
				<button
					type="button"
					class={buttonVariants({ size: 'sm', variant: 'ghost' })}
					onclick={clearSearch}
				>
					Cancel
				</button>
			{/if}
		</div>
	</div>
</WorkbenchPageToolbar>

<div
	class="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4 p-4 md:p-5"
	style="min-block-size: 0;"
	data-testid="workspaces-route"
>
	{#if !selectedWorkspace}
		<Card.Root class="h-full">
			<Card.Content class="grid h-full place-items-center p-6">
				<div class="grid max-w-md gap-4 text-center">
					<div class="text-lg font-semibold">Workspace root not found</div>
					<div class="text-sm text-muted-foreground">
						This detail route is bound to one workspace root. Go back to the start page and choose a valid root.
					</div>
					<div class="flex justify-center">
						<Button variant="outline" onclick={() => void goto(buildWorkspaceIndexHref({ avatar: selectedAvatar }))}>
							Back to start page
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{:else}
	<WorkspaceContentHeader
		objectivePath={workspaceObjectivePath}
		{selectedWorkspace}
		selectedAvatar={selectedAvatar}
		{selectedAvatarEntry}
		avatars={avatarOptions}
		onAvatarChange={(avatar) => {
			selectedAvatar = avatar;
		}}
	/>

	<WorkbenchPageContent>
		{#snippet main()}
			<Card.Root class="h-full">
				<Card.Header class="border-b">
					<Card.Title>{mode === 'rules' ? 'Rules' : mode === 'private' ? 'Private assets' : 'Explorer'}</Card.Title>
					<Card.Description>
						{#if mode === 'rules'}
							Rule order maps directly to runtime grant priority for the selected avatar lens.
						{:else if mode === 'private'}
							Avatar-private assets reuse the tree model without workspace permission badges.
						{:else}
							Folders toggle inline and loaded tree search stays inside the same hierarchy.
						{/if}
					</Card.Description>
				</Card.Header>
				<Card.Content class="h-full p-0">
					{#if mode === 'rules'}
						<div class="grid gap-2 p-3">
							{#if rules.length === 0}
								<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
									No explicit rules are configured for this workspace/avatar pair.
								</div>
							{:else}
								{#each rules as rule, index (rule.id)}
									{@const matched = matchedRuleIdSet.has(rule.id)}
									{@const activeMatched = activeMatchId === rule.id}
									<button
										type="button"
										data-workspace-rule-id={rule.id}
										class={cn(
											'grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-muted/40',
											selectedRule?.id === rule.id ? 'border-primary bg-primary/5' : 'bg-card/70',
											matched && 'bg-amber-500/10',
											activeMatched && 'ring-2 ring-amber-500/60',
										)}
										onclick={() => {
											selectedRuleId = rule.id;
										}}
									>
										<div class="min-w-0">
											<div class="truncate text-sm font-semibold">{rule.relativePath}</div>
											<div class="text-[11px] text-muted-foreground">Priority {index + 1}</div>
										</div>
										<div class="flex items-center gap-2">
											<Badge variant={rule.enabled ? 'secondary' : 'outline'}>
												{rule.enabled ? 'enabled' : 'disabled'}
											</Badge>
											<Badge variant="outline">{rule.mode}</Badge>
										</div>
									</button>
								{/each}
							{/if}
						</div>
					{:else}
						<WorkspaceTree
							rows={mode === 'private' ? privateRows : explorerRows}
							selectedPath={activeSelectionPath}
							activeMatchPath={activeMatchId}
							expandedPaths={mode === 'private' ? expandedPrivatePaths : expandedExplorerPaths}
							matchPaths={activeMatchIds}
							showAccessBadges={mode === 'explorer'}
							viewportTestId={mode === 'private' ? 'workspace-private-tree' : 'workspace-explorer-tree'}
							onSelect={async (path) => {
								if (mode === 'private') {
									selectedPrivatePath = path;
									await loadPreview('private', path);
									return;
								}
								selectedExplorerPath = path;
								await loadPreview('explorer', path);
							}}
							onToggleDirectory={async (path) => {
								await toggleExpandedPath(mode === 'private' ? 'private' : 'explorer', path);
							}}
							onLoadMore={async (path) => {
								const pages = mode === 'private' ? privatePages : explorerPages;
								const nextOffset = pages[path]?.nextOffset ?? 0;
								await loadTree(mode === 'private' ? 'private' : 'explorer', path, nextOffset);
							}}
						/>
					{/if}
				</Card.Content>
			</Card.Root>
		{/snippet}

		{#snippet bottom()}
			<Card.Root>
				<Card.Content class="grid gap-4 pt-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
					{#if mode === 'rules'}
						<div class="grid gap-3 md:grid-cols-3">
							<Input
								value={selectedRule?.relativePath ?? '/'}
								oninput={(event) => {
									const value = (event.currentTarget as HTMLInputElement).value;
									if (!selectedRule) {
										return;
									}
									rules = rules.map((rule) => (rule.id === selectedRule.id ? { ...rule, relativePath: value } : rule));
									rulesDirty = true;
								}}
							/>
							<NativeSelect.NativeSelect
								value={selectedRule?.mode ?? 'ro'}
								onchange={(event) => {
									const value = (event.currentTarget as HTMLSelectElement).value as 'ro' | 'rw';
									if (!selectedRule) {
										return;
									}
									rules = rules.map((rule) => (rule.id === selectedRule.id ? { ...rule, mode: value } : rule));
									rulesDirty = true;
								}}
							>
								<option value="ro">Read only</option>
								<option value="rw">Read write</option>
							</NativeSelect.NativeSelect>
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={selectedRule?.enabled ?? false}
									onchange={(event) => {
										const checked = (event.currentTarget as HTMLInputElement).checked;
										if (!selectedRule) {
											return;
										}
										rules = rules.map((rule) => (rule.id === selectedRule.id ? { ...rule, enabled: checked } : rule));
										rulesDirty = true;
									}}
								/>
								Enabled
							</label>
						</div>
						<div class="flex flex-wrap gap-2">
							<Button variant="outline" onclick={addRule}>
								<PlusIcon class="size-4" />
								Add rule
							</Button>
							<Button variant="outline" onclick={duplicateRule}>
								<PlusIcon class="size-4" />
								Duplicate
							</Button>
							<Button variant="outline" onclick={() => moveRule(-1)}>
								<ArrowUpIcon class="size-4" />
								Move up
							</Button>
							<Button variant="outline" onclick={() => moveRule(1)}>
								<ArrowDownIcon class="size-4" />
								Move down
							</Button>
							<Button variant="outline" onclick={removeRule}>
								<Trash2Icon class="size-4" />
								Delete
							</Button>
							<Button disabled={!rulesDirty || rulesSaving} onclick={() => void persistRules()}>
								<SaveIcon class="size-4" />
								{rulesSaving ? 'Applying…' : 'Apply rules'}
							</Button>
						</div>
					{:else if mode === 'private'}
						<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
							<Input bind:value={privateAssetName} placeholder="New private asset name" />
							<NativeSelect.NativeSelect bind:value={privateAssetKind}>
								<option value="file">File</option>
								<option value="directory">Directory</option>
							</NativeSelect.NativeSelect>
						</div>
						<div class="flex flex-wrap gap-2">
							<Button disabled={privateAssetBusy || privateAssetName.trim().length === 0} onclick={() => void createPrivateAsset()}>
								<FolderPlusIcon class="size-4" />
								{privateAssetBusy ? 'Creating…' : 'Create private asset'}
							</Button>
							{#if assetRoots}
								<Badge variant="outline" class="bg-background/70">{assetRoots.privateRoots.memory}</Badge>
							{/if}
						</div>
					{:else}
						<div class="grid gap-2">
							<div class="text-sm font-medium">
								{selectedExplorerPath ? `Selected path: ${selectedExplorerPath}` : 'Select one path to stage a quick rule.'}
							</div>
							<div class="text-xs text-muted-foreground">
								Quick edit only stages one rule; the full catalog lives in Rules mode.
							</div>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<NativeSelect.NativeSelect bind:value={quickRuleMode} class="min-w-36">
								<option value="ro">Read only</option>
								<option value="rw">Read write</option>
							</NativeSelect.NativeSelect>
							<Button variant="outline" onclick={stageQuickRule}>
								<PlusIcon class="size-4" />
								Stage rule
							</Button>
							<Button disabled={!rulesDirty || rulesSaving} onclick={() => void persistRules()}>
								<SaveIcon class="size-4" />
								{rulesSaving ? 'Applying…' : 'Apply rules'}
							</Button>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{/snippet}

		{#snippet drawer()}
			{#snippet workspaceDrawerSummary()}
				{#if mode !== 'rules' && preview}
					<div class="break-all"><span class="font-medium text-foreground">Path:</span> {preview.path}</div>
					<div><span class="font-medium text-foreground">Kind:</span> {preview.previewKind}</div>
					<div><span class="font-medium text-foreground">Size:</span> {preview.sizeBytes} bytes</div>
					{#if preview.note}
						<div>{preview.note}</div>
					{/if}
				{:else if selectedRule}
					<div><span class="font-medium text-foreground">Priority:</span> {selectedRuleIndex + 1}</div>
					<div><span class="font-medium text-foreground">Access:</span> {selectedRule.mode}</div>
				{:else}
					<div>No secondary facts are available yet.</div>
				{/if}
			{/snippet}

			<WorkbenchDetailDrawer
				title={mode === 'rules' ? 'Rule detail' : 'Preview'}
				description={
					mode === 'rules'
						? 'Rules keeps the drawer informational; editing stays in the bottom area.'
						: 'Preview stays dominant and metadata remains docked near the bottom.'
				}
				summary={workspaceDrawerSummary}
			>
				{#if mode === 'rules'}
					<div class="rounded-xl border px-4 py-4 text-sm">
						{#if selectedRule}
							<div class="font-semibold">{selectedRule.relativePath}</div>
							<div class="mt-2 text-muted-foreground">
								{selectedRule.enabled ? 'Enabled' : 'Disabled'} · {selectedRule.mode}
							</div>
						{:else}
							No rule selected.
						{/if}
					</div>
				{:else if previewLoading}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">Loading preview…</div>
				{:else if !preview}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">Select one entry to inspect its preview.</div>
				{:else if preview.previewKind === 'text'}
					<ScrollView
						class="max-h-[28rem] rounded-xl border bg-muted/30"
						contentClass="min-w-full"
					>
						<pre class="p-4 text-xs leading-6">{preview.textContent}</pre>
					</ScrollView>
				{:else if preview.previewKind === 'image' && preview.mediaDataUrl}
					<img src={preview.mediaDataUrl} alt={preview.name} class="max-h-full w-full rounded-xl border object-contain" />
				{:else if preview.previewKind === 'audio' && preview.mediaDataUrl}
					<audio controls src={preview.mediaDataUrl} class="w-full"></audio>
				{:else if preview.previewKind === 'video' && preview.mediaDataUrl}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video controls src={preview.mediaDataUrl} class="max-h-full w-full rounded-xl border"></video>
				{:else}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						{preview.note ?? 'No preview is available for this selection.'}
					</div>
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
	{/if}
</div>
