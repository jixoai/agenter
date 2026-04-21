<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import SearchIcon from '@lucide/svelte/icons/search';

	import { Input } from '$lib/components/ui/input/index.js';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import { cn } from '$lib/utils.js';

	import WorkspaceContentHeader from './workspace-content-header.svelte';
	import WorkspaceTree from './workspace-tree.svelte';
	import {
		buildWorkspaceTreeRows,
		type WorkspaceMode,
		type WorkspaceTreePages,
	} from './workspace-workbench-state';

	let {
		initialMode = 'explorer',
		frameClass = 'h-[58rem] w-[72rem] max-w-none',
	}: {
		initialMode?: WorkspaceMode;
		frameClass?: string;
	} = $props();

	const workspaces = [
		{ path: '/repo/agenter', favorite: true },
		{ path: '/repo/docs' },
		{ path: '~/' },
	];
	const avatars = [
		{ nickname: 'default', runtimeId: 'runtime-default' },
		{ nickname: 'reviewer', runtimeId: 'runtime-reviewer' },
	];
	const pages: WorkspaceTreePages = {
		'/': {
			rootPath: '/',
			total: 3,
			nextOffset: null,
			items: [
				{ path: '/src', name: 'src', kind: 'directory', sizeBytes: null, modifiedAtMs: 1, previewKind: 'directory', accessMode: 'rw' },
				{ path: '/README.md', name: 'README.md', kind: 'file', sizeBytes: 1280, modifiedAtMs: 1, previewKind: 'text', accessMode: 'ro' },
				{ path: '/logo.png', name: 'logo.png', kind: 'file', sizeBytes: 2048, modifiedAtMs: 1, previewKind: 'image', accessMode: 'ro' },
			],
		},
		'/src': {
			rootPath: '/src',
			total: 2,
			nextOffset: null,
			items: [
				{ path: '/src/app.ts', name: 'app.ts', kind: 'file', sizeBytes: 640, modifiedAtMs: 1, previewKind: 'text', accessMode: 'rw' },
				{ path: '/src/components', name: 'components', kind: 'directory', sizeBytes: null, modifiedAtMs: 1, previewKind: 'directory', accessMode: 'rw' },
			],
		},
	} satisfies WorkspaceTreePages;
	const workspaceModeTabItems = [
		{ value: 'explorer', label: 'explorer', title: 'Explorer' },
		{ value: 'rules', label: 'rules', title: 'Rules' },
		{ value: 'private', label: 'private', title: 'Private assets' },
	] as const satisfies WorkbenchPageTabItem[];

	let mode = $state<WorkspaceMode>('explorer');
	let selectedAvatar = $state('default');
	let expandedPaths = $state<Set<string>>(new Set(['/']));
	let selectedPath = $state<string | null>('/README.md');
	let detailCompact = $state(false);
	let detailOpen = $state(false);
	let searchQuery = $state('');

	const selectedWorkspace = $derived(workspaces[0] ?? null);
	const selectedAvatarEntry = $derived(avatars.find((avatar) => avatar.nickname === selectedAvatar) ?? avatars[0] ?? null);
	const rows = $derived(
		buildWorkspaceTreeRows({
			pages,
			expandedPaths,
			searchQuery: '',
		}),
	);

	$effect(() => {
		mode = initialMode;
	});

	const openDetailIfCompact = (): void => {
		if (detailCompact) {
			detailOpen = true;
		}
	};
</script>

{#snippet workspaceShellToolbarPageTabs(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchPageTabs
		ariaLabel="Workspace modes"
		value={mode}
		items={workspaceModeTabItems}
		toolbarState={toolbarState}
		onValueChange={(value) => {
			mode = value as WorkspaceMode;
		}}
	/>
{/snippet}

{#snippet workspaceShellToolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class={cn(
			'flex min-w-0 items-center gap-1 md:gap-1.5',
			toolbarState.placement === 'overflow' && 'grid justify-items-start gap-2',
		)}
	>
		<WorkbenchToolbarAction
			placement={toolbarState.placement}
			label="Manage"
			title="Manage workspace mounts"
			inlineLabel
			onclick={() => undefined}
		/>

		{#if detailCompact}
			<WorkbenchToolbarAction
				placement={toolbarState.placement}
				label="Open detail panel"
				title="Open detail panel"
				onclick={() => {
					detailOpen = true;
				}}
			>
				<PanelRightOpenIcon class="size-4" />
			</WorkbenchToolbarAction>
		{/if}

		<div
			class={cn(
				'min-w-0 border border-border/60 bg-background/70',
				toolbarState.placement === 'overflow'
					? 'grid w-full max-w-[18rem] gap-2 rounded-2xl px-3 py-2'
					: 'flex h-6 min-w-[11rem] max-w-[15rem] items-center gap-1 rounded-full px-1.5 md:min-w-[12rem] md:max-w-[17rem]',
			)}
		>
			<SearchIcon class="size-3.5 shrink-0 text-muted-foreground" />
			<Input
				bind:value={searchQuery}
				class={cn(
					'h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0',
					toolbarState.placement === 'overflow'
						? 'w-full min-w-[14rem] text-sm'
						: 'min-w-0 flex-1 text-[11px] md:text-xs',
				)}
				placeholder={mode === 'rules' ? 'Search rules' : 'Search loaded tree'}
			/>
		</div>
	</div>
{/snippet}

<div
	class={cn('grid grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-[1.1rem] border p-3', frameClass)}
	data-testid="workspace-shell-story"
>
	<div
		class="rounded-[0.95rem] border border-border/60 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background),white_12%)_0%,color-mix(in_srgb,var(--card),var(--background)_74%)_100%)]"
		data-workbench-page-toolbar
	>
		<WorkbenchToolbar
			pageTabs={workspaceShellToolbarPageTabs}
			actions={workspaceShellToolbarActions}
			overflowLabel="Open workspace toolbar details"
		/>
	</div>

	<WorkspaceContentHeader
		objectivePath={selectedWorkspace?.path ?? null}
		{selectedWorkspace}
		selectedAvatar={selectedAvatar}
		{selectedAvatarEntry}
		avatars={avatars}
		onAvatarChange={(avatar) => {
			selectedAvatar = avatar;
		}}
	/>

	<WorkbenchPageContent
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		detailRatioPersistence="workspace-shell-story:detail"
		>
			{#snippet main()}
				<Card.Root class="h-full">
					<Card.Header class="gap-1 border-b px-4 py-4">
						<Card.Title>{mode === 'explorer' ? 'Explorer' : mode === 'rules' ? 'Rules' : 'Private assets'}</Card.Title>
						<Card.Description class="text-xs">
							{mode === 'explorer'
								? 'Primary tree first. Quick rule actions stay below.'
								: mode === 'rules'
									? 'Rule catalog remains primary. Editing stays docked below.'
									: 'Private assets reuse the same tree model without permission chrome.'}
						</Card.Description>
					</Card.Header>
					<Card.Content class="flex-1 p-0">
					{#if mode === 'explorer'}
						<WorkspaceTree
							rows={rows}
							selectedPath={selectedPath}
							expandedPaths={expandedPaths}
							matchPaths={[]}
							showAccessBadges
							viewportTestId="workspace-shell-story-tree"
							onSelect={(path) => {
								selectedPath = path;
								openDetailIfCompact();
							}}
							onToggleDirectory={(path) => {
								const next = new Set(expandedPaths);
								if (next.has(path)) {
									next.delete(path);
								} else {
									next.add(path);
								}
								expandedPaths = next;
							}}
							onLoadMore={() => {}}
						/>
						{:else if mode === 'rules'}
							<div class="grid gap-2 p-3">
								<div class="rounded-xl border px-4 py-3 text-sm font-medium">Rule priority follows row order.</div>
								<div class="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
									Rules stay in the main catalog. Editing belongs in the bottom area.
								</div>
							</div>
						{:else}
							<div class="grid gap-2 p-3">
								<div class="rounded-xl border px-4 py-3 text-sm font-medium">Private assets reuse the same tree mental model.</div>
								<div class="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
									Permission badges disappear because the avatar lens already implies authority.
								</div>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/snippet}

		{#snippet bottom()}
			<Card.Root class="border-dashed">
				<Card.Content class="grid gap-1.5 px-4 pb-4 pt-4">
					<div class="text-sm font-medium">Bottom area</div>
					<div class="text-xs text-muted-foreground">
						{mode === 'explorer'
							? 'Quick rule staging stays here.'
							: mode === 'rules'
								? 'Rule editing stays docked here.'
								: 'Private asset actions stay docked here.'}
					</div>
				</Card.Content>
			</Card.Root>
		{/snippet}

		{#snippet drawer()}
			{#snippet drawerSummary()}
				<div><span class="font-medium text-foreground">Mode:</span> {mode}</div>
				<div><span class="font-medium text-foreground">Selected path:</span> {selectedPath ?? 'none'}</div>
			{/snippet}

			<WorkbenchDetailDrawer
				title="Preview"
				description="The same detail drawer persists while the body swaps by mode."
				summary={drawerSummary}
			>
				<div class="rounded-xl border px-4 py-3 text-sm font-medium">
					{mode === 'explorer' ? 'Explorer preview' : mode === 'rules' ? 'Rule detail stays informational' : 'Private preview'}
				</div>
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</div>
