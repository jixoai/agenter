<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';

	import WorkspaceContentHeader from './workspace-content-header.svelte';
	import WorkspaceTree from './workspace-tree.svelte';
	import {
		buildWorkspaceTreeRows,
		type WorkspaceMode,
		type WorkspaceTreePages,
	} from './workspace-workbench-state';

	let {
		initialMode = 'explorer',
	}: {
		initialMode?: WorkspaceMode;
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

	let mode = $state<WorkspaceMode>('explorer');
	let selectedAvatar = $state('default');
	let expandedPaths = $state<Set<string>>(new Set(['/']));
	let selectedPath = $state<string | null>('/README.md');

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
</script>

<div class="grid h-[58rem] gap-4 rounded-[1.35rem] border p-4" data-testid="workspace-shell-story">
	<div class="flex flex-wrap items-center gap-2">
		{#each ['explorer', 'rules', 'private'] as modeOption}
			<Button
				size="sm"
				variant={mode === modeOption ? 'secondary' : 'ghost'}
				data-testid={`workspace-mode-${modeOption}`}
				onclick={() => {
					mode = modeOption as WorkspaceMode;
				}}
			>
				{modeOption}
			</Button>
		{/each}
		<Badge variant="outline">{selectedWorkspace?.path}</Badge>
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

	<WorkbenchPageContent>
		{#snippet main()}
			<Card.Root class="h-full">
				<Card.Header class="border-b">
					<Card.Title>{mode === 'explorer' ? 'Explorer' : mode === 'rules' ? 'Rules' : 'Private assets'}</Card.Title>
				</Card.Header>
				<Card.Content class="h-full p-0">
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
						<div class="grid gap-3 p-4">
							<div class="rounded-xl border px-4 py-3 text-sm font-medium">Rule priority follows row order.</div>
							<div class="rounded-xl border px-4 py-3 text-sm text-muted-foreground">Rules stay in the main catalog. Editing belongs in the bottom area.</div>
						</div>
					{:else}
						<div class="grid gap-3 p-4">
							<div class="rounded-xl border px-4 py-3 text-sm font-medium">Private assets reuse the same tree mental model.</div>
							<div class="rounded-xl border px-4 py-3 text-sm text-muted-foreground">Permission badges disappear because the avatar lens already implies authority.</div>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{/snippet}

		{#snippet bottom()}
			<Card.Root>
				<Card.Content class="grid gap-2 pt-6">
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
