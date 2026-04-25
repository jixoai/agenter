<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import FolderRootIcon from '@lucide/svelte/icons/folder-root';
	import LayoutListIcon from '@lucide/svelte/icons/layout-list';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { ScrollView } from '@agenter/svelte-components';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbarToggle from '$lib/features/navigation/workbench-toolbar-toggle.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import { cn } from '$lib/utils.js';

	import { buildWorkspaceDetailHref, readWorkspaceAvatar } from './workspace-location';
	import {
		describeCompactWorkspace,
		resolveObjectiveWorkspacePath,
		sortWorkspacesForCatalog,
	} from './workspace-sorting';

	const controller = getAppControllerContext();

	let searchQuery = $state('');
	let selectedWorkspacePath = $state('');
	let compactMode = $state(false);
	let detailCompact = $state(false);
	let detailOpen = $state(true);

	const requestedAvatar = $derived(readWorkspaceAvatar(page.url.searchParams));
	const sortedWorkspaces = $derived(
		sortWorkspacesForCatalog(controller.runtimeState.workspaces, controller.runtimeState.recentWorkspaces),
	);
	const filteredWorkspaces = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			return sortedWorkspaces;
		}
		return sortedWorkspaces.filter((workspace) =>
			[
				workspace.path,
				resolveObjectiveWorkspacePath(workspace, sortedWorkspaces),
				describeCompactWorkspace(workspace.path),
			]
				.join('\n')
				.toLowerCase()
				.includes(query),
		);
	});
	const selectedWorkspace = $derived(
		filteredWorkspaces.find((workspace) => workspace.path === selectedWorkspacePath) ?? filteredWorkspaces[0] ?? null,
	);

	$effect(() => {
		if (!filteredWorkspaces.length) {
			selectedWorkspacePath = '';
			return;
		}
		if (!selectedWorkspacePath || !filteredWorkspaces.some((workspace) => workspace.path === selectedWorkspacePath)) {
			selectedWorkspacePath = filteredWorkspaces[0]!.path;
		}
	});

	const openWorkspace = async (workspacePath = selectedWorkspace?.path): Promise<void> => {
		if (!workspacePath) {
			return;
		}
		await goto(
			buildWorkspaceDetailHref({
				workspacePath,
				avatar: requestedAvatar,
			}),
		);
	};

	const handleSearchKeyDown = (e: KeyboardEvent): void => {
		if (e.key === 'Enter') {
			if (filteredWorkspaces.length === 1) {
				void openWorkspace(filteredWorkspaces[0].path);
			} else if (selectedWorkspace) {
				void openWorkspace(selectedWorkspace.path);
			}
		}
	};

	const revealDetail = (): void => {
		detailOpen = true;
	};

	const workspaceStartSubtitle = 'Choose one durable workspace root and open its dedicated detail surface.';
</script>

{#snippet workspaceStartToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<FolderRootIcon class="size-4 text-muted-foreground" />
{/snippet}

{#snippet workspaceStartToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="inline-flex min-w-0 items-center gap-2">
		<span class="truncate">
			<span class="sm:hidden">Roots</span>
			<span class="hidden sm:inline">Workspace roots</span>
		</span>
		<HelpHint textContext="The Workspaces start page chooses one durable root at a time. Each root opens a dedicated single-root detail surface instead of swapping unrelated roots inline.">
			<p>Choose one durable workspace resource. Each root opens a dedicated single-root detail surface.</p>
		</HelpHint>
	</span>
{/snippet}

{#snippet workspaceStartToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">{workspaceStartSubtitle}</span>
{/snippet}

{#snippet workspaceStartToolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class={cn(
			'flex min-w-0 flex-wrap items-center gap-1',
			toolbarState.placement === 'overflow' ? 'justify-start' : 'justify-end',
		)}
	>
		<WorkbenchToolbarStatus
			placement={toolbarState.placement}
			label={`${filteredWorkspaces.length} roots`}
			title={`${filteredWorkspaces.length} roots`}
		/>
		{#if requestedAvatar}
			<WorkbenchToolbarStatus
				placement={toolbarState.placement}
				label={`@${requestedAvatar}`}
				title={`Avatar filter: ${requestedAvatar}`}
				tone="accent"
			/>
		{/if}
	</div>
{/snippet}

{#snippet workspaceStartToolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class={cn(
			'flex min-w-0 items-center gap-1 md:gap-1.5',
			toolbarState.placement === 'overflow' && 'grid gap-2',
		)}
	>
		{#if detailCompact}
			<WorkbenchToolbarAction
				placement={toolbarState.placement}
				label="Open detail panel"
				title="Open detail panel"
				disabled={!selectedWorkspace}
				onclick={() => {
					detailOpen = true;
				}}
			>
				<PanelRightOpenIcon class="size-4" />
			</WorkbenchToolbarAction>
		{/if}

		<WorkbenchToolbarToggle
			placement={toolbarState.placement}
			label="Compact view"
			title={compactMode ? 'Switch to comfortable view' : 'Switch to compact view'}
			pressed={compactMode}
			inlineTone="active"
			onPressedChange={(pressed) => {
				compactMode = pressed;
			}}
		>
			<LayoutListIcon class="size-4" />
		</WorkbenchToolbarToggle>

		<div
			class={cn(
				'flex min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5',
				toolbarState.placement === 'overflow'
					? 'h-9 rounded-xl px-3'
					: 'h-6 gap-1 px-1.5',
			)}
		>
			<SearchIcon class="size-3.5 shrink-0 text-muted-foreground" />
			<Input
				bind:value={searchQuery}
				onkeydown={handleSearchKeyDown}
				class={cn(
					'h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0',
					toolbarState.placement === 'overflow'
						? 'w-full min-w-[14rem] text-sm'
						: 'w-20 text-[11px] sm:w-28 md:w-44 md:text-xs',
				)}
				placeholder="Search roots"
			/>
		</div>
	</div>
{/snippet}

<WorkbenchPageToolbar>
	<WorkbenchToolbar
		identityLeading={workspaceStartToolbarIdentityLeading}
		identityTitle={workspaceStartToolbarIdentityTitle}
		identitySubtitle={workspaceStartToolbarIdentitySubtitle}
		status={workspaceStartToolbarStatus}
		actions={workspaceStartToolbarActions}
		overflowLabel="Open workspace toolbar details"
	/>
</WorkbenchPageToolbar>

<div class="h-full" data-testid="workspace-start-route">
	<WorkbenchPageContent
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		class="h-full"
		mainClass="h-full"
		drawerClass="h-full"
		detailRatioPersistence="workspace-start:detail"
		>
			{#snippet main()}
				<ScrollView class="h-full" contentClass="grid gap-0 px-0 py-1 md:px-1.5 md:py-2">
					{#if filteredWorkspaces.length === 0}
						<div class="flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
							<div>No workspace roots matched this search.</div>
						{#if searchQuery}
							<Button variant="link" class="mt-2 h-auto p-0" onclick={() => (searchQuery = '')}>Clear search</Button>
						{/if}
					</div>
					{:else}
						<div class="grid gap-0 border-y border-border/50">
							{#each filteredWorkspaces as workspace (workspace.path)}
								<div
									class={cn(
									'border-b border-border/45 last:border-b-0 transition-colors',
									selectedWorkspace?.path === workspace.path
										? 'bg-[color-mix(in_srgb,var(--accent),transparent_72%)]'
										: 'hover:bg-muted/20',
								)}
							>
									<button
										type="button"
										class={cn(
											'grid w-full gap-1.5 px-2 py-2 text-left md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-2 md:px-3 md:py-2.5',
											compactMode && 'gap-1 py-1.5',
										)}
										data-workspace-start-item={workspace.path}
										ondblclick={() => void openWorkspace(workspace.path)}
									onclick={() => {
										selectedWorkspacePath = workspace.path;
										revealDetail();
									}}
									onkeydown={(e) => e.key === 'Enter' && void openWorkspace(workspace.path)}
									>
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-1.5">
												<div class={cn('truncate text-[13px] font-semibold leading-tight md:text-sm', compactMode && 'text-[12px]')}>
													{describeCompactWorkspace(workspace.path)}
												</div>
												{#if workspace.favorite}
													<Badge
														variant="secondary"
														class={cn('h-4 px-1 text-[9px]', compactMode && 'h-3.5')}
													>
														Fav
													</Badge>
												{/if}
												{#if workspace.path === '~/'}
													<Badge
														variant="outline"
														class={cn('h-4 px-1 text-[9px]', compactMode && 'h-3.5')}
													>
														Global
													</Badge>
												{/if}
											</div>
											{#if !compactMode}
												<div class="mt-0.5 truncate text-[10px] leading-4 text-muted-foreground md:text-[11px]">
													{resolveObjectiveWorkspacePath(workspace, sortedWorkspaces)}
												</div>
											{/if}
										</div>
										<div class="flex items-center justify-between gap-2 md:ml-4">
											{#if !compactMode}
												<div class="truncate text-[9px] text-muted-foreground md:text-[10px]">
													{workspace.lastSessionActivityAt ?? 'Never started'}
												</div>
											{/if}
											<a
												href={buildWorkspaceDetailHref({ workspacePath: workspace.path, avatar: requestedAvatar })}
											class={cn(
												buttonVariants({
													variant: selectedWorkspace?.path === workspace.path ? 'secondary' : 'ghost',
													size: 'sm',
												}),
												'hidden h-7 px-3 text-[11px] md:inline-flex',
												compactMode && 'h-6 px-2',
											)}
											data-workspace-start-open={workspace.path}
											aria-label={`Open ${describeCompactWorkspace(workspace.path)}`}
										>
											Open
										</a>
									</div>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</ScrollView>
		{/snippet}

			{#snippet drawer()}
				{#snippet workspaceStartSummary()}
					{#if selectedWorkspace}
						<div>{selectedWorkspace.lastSessionActivityAt ?? 'No sessions started yet.'}</div>
					{:else}
						<div>Select one workspace root from the list.</div>
					{/if}
				{/snippet}

			<WorkbenchDetailDrawer
				tone={detailCompact ? 'page' : 'pane'}
				title={selectedWorkspace ? describeCompactWorkspace(selectedWorkspace.path) : 'Detail'}
				description="Preview before entry."
				summary={workspaceStartSummary}
				>
					{#if selectedWorkspace}
						<div class="grid gap-3">
							<div class="grid gap-2.5">
								<div class="grid gap-1">
									<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Stored path</div>
									<div class="break-all text-sm font-medium leading-5">{selectedWorkspace.path}</div>
								</div>
								<div class="grid gap-1 border-t border-border/45 pt-2.5">
									<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Objective path</div>
									<div class="break-all text-xs leading-5 text-muted-foreground">
										{resolveObjectiveWorkspacePath(selectedWorkspace, sortedWorkspaces)}
									</div>
								</div>
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<span>Single-root detail tab.</span>
									<HelpHint textContext="Workspace detail stays bound to one root. Explorer, Rules, and Private operate inside that chosen root rather than swapping to another path inline.">
										<p>Explorer, Rules, and Private stay bound to this one root after entry.</p>
									</HelpHint>
								</div>
							</div>
							<Button class="w-full" onclick={() => void openWorkspace()}>
								<ArrowUpRightIcon class="size-3.5" />
								Open workspace detail
							</Button>
					</div>
				{:else}
					<div class="text-sm text-muted-foreground">Select one workspace root to preview it here.</div>
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</div>
