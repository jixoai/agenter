<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { ScrollView } from '@agenter/svelte-components';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import { cn } from '$lib/utils.js';

	import { buildWorkspaceDetailHref, readWorkspaceAvatar } from './workspace-location';
	import {
		describeCompactWorkspace,
		describeWorkspace,
		resolveObjectiveWorkspacePath,
		sortWorkspacesForCatalog,
	} from './workspace-sorting';

	const controller = getAppControllerContext();

	let searchQuery = $state('');
	let selectedWorkspacePath = $state('');

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
</script>

<WorkbenchPageToolbar>
	<div class="flex h-full items-center justify-between gap-3 px-3 md:px-4">
		<div class="min-w-0">
			<div class="text-sm font-semibold">Choose workspace root</div>
			<div class="hidden text-xs text-muted-foreground md:block">
				Each workspace detail route binds one root. Come back here when you need another root.
			</div>
		</div>
		<div class="flex items-center gap-2">
			<SearchIcon class="size-4 text-muted-foreground" />
			<Input bind:value={searchQuery} class="h-8 w-44 bg-background/70 md:w-56" placeholder="Search roots" />
		</div>
	</div>
</WorkbenchPageToolbar>

<div
	class="grid h-full grid-rows-[minmax(0,1fr)] p-4 md:p-5"
	style="min-block-size: 0;"
	data-testid="workspace-start-route"
>
	<WorkbenchPageContent>
		{#snippet main()}
			<Card.Root style="min-block-size: 0;">
				<Card.Header class="border-b">
					<Card.Title>Workspace roots</Card.Title>
					<Card.Description>
						Choose one durable workspace resource first. Explorer, Rules, and Private stay inside that single-root detail page.
					</Card.Description>
				</Card.Header>
				<Card.Content class="p-0" style="min-block-size: 0;">
					<ScrollView class="h-full" contentClass="grid gap-2 p-3">
						{#if filteredWorkspaces.length === 0}
							<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
								No workspace roots matched this search.
							</div>
						{:else}
							{#each filteredWorkspaces as workspace (workspace.path)}
								<div
									class={cn(
										'grid gap-3 rounded-2xl border px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_auto] md:items-center',
										selectedWorkspace?.path === workspace.path ? 'border-primary bg-primary/5' : 'bg-card/70',
									)}
								>
									<button
										type="button"
										class="min-w-0 text-left"
										data-workspace-start-item={workspace.path}
										onclick={() => {
											selectedWorkspacePath = workspace.path;
										}}
									>
										<div class="flex items-start justify-between gap-3">
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<div class="truncate text-sm font-semibold">{describeCompactWorkspace(workspace.path)}</div>
													{#if workspace.favorite}
														<Badge variant="secondary">Favorite</Badge>
													{/if}
													{#if workspace.path === '~/'}
														<Badge variant="outline">Global</Badge>
													{/if}
												</div>
												<div class="mt-1 truncate text-xs text-muted-foreground">
													{resolveObjectiveWorkspacePath(workspace, sortedWorkspaces)}
												</div>
											</div>
											<div class="rounded-full border px-2 py-1 text-[11px]">
												{workspace.lastSessionActivityAt ?? 'Never started'}
											</div>
										</div>
									</button>
									<a
										href={buildWorkspaceDetailHref({
											workspacePath: workspace.path,
											avatar: requestedAvatar,
										})}
										class={cn(
											buttonVariants({
												variant: selectedWorkspace?.path === workspace.path ? 'secondary' : 'ghost',
												size: 'sm',
											}),
											'justify-self-start md:justify-self-end',
										)}
										data-workspace-start-open={workspace.path}
										aria-label={`Open ${describeCompactWorkspace(workspace.path)}`}
									>
										Open
									</a>
								</div>
							{/each}
						{/if}
					</ScrollView>
				</Card.Content>
			</Card.Root>
		{/snippet}

		{#snippet bottom()}
			<Card.Root>
				<Card.Content class="grid gap-3 pt-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
					<div class="grid gap-1">
						<div class="text-sm font-medium">Single-root law</div>
						<div class="text-xs text-muted-foreground">
							The detail surface no longer swaps roots inline. Choose the root here, then work inside one stable Explorer / Rules / Private shell.
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant="outline" class="bg-background/70">{filteredWorkspaces.length} visible</Badge>
						{#if requestedAvatar}
							<Badge variant="outline" class="bg-background/70">View as {requestedAvatar}</Badge>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		{/snippet}

		{#snippet drawer()}
			{#snippet workspaceStartSummary()}
				{#if selectedWorkspace}
					<div><span class="font-medium text-foreground">Stored path:</span> {selectedWorkspace.path}</div>
					<div><span class="font-medium text-foreground">Objective path:</span> {resolveObjectiveWorkspacePath(selectedWorkspace, sortedWorkspaces)}</div>
					<div><span class="font-medium text-foreground">Last activity:</span> {selectedWorkspace.lastSessionActivityAt ?? 'Never started'}</div>
				{:else}
					<div>Select a workspace root to continue.</div>
				{/if}
			{/snippet}

			<WorkbenchDetailDrawer
				title={selectedWorkspace ? describeCompactWorkspace(selectedWorkspace.path) : 'Workspace detail'}
				description="This drawer previews the root you are about to enter. The actual editor surface appears after you choose one root."
				summary={workspaceStartSummary}
			>
				{#if !selectedWorkspace}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						Select one workspace root from the list.
					</div>
				{:else}
					<div class="grid gap-4">
						<div class="rounded-2xl border px-4 py-4">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workspace root</div>
							<div class="mt-2 break-all text-sm font-medium">{describeWorkspace(selectedWorkspace.path)}</div>
						</div>
						<div class="rounded-2xl border px-4 py-4">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Objective path</div>
							<div class="mt-2 break-all text-sm font-medium">
								{resolveObjectiveWorkspacePath(selectedWorkspace, sortedWorkspaces)}
							</div>
						</div>
						<Button onclick={() => void openWorkspace()}>
							<ArrowUpRightIcon class="size-4" />
							Open workspace detail
						</Button>
					</div>
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</div>
