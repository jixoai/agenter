<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import FolderKanbanIcon from '@lucide/svelte/icons/folder-kanban';
	import MailPlusIcon from '@lucide/svelte/icons/mail-plus';
	import type { Component } from 'svelte';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import WorkbenchDetailDrawer from './workbench-detail-drawer.svelte';
	import WorkbenchPageContent from './workbench-page-content.svelte';
	import WorkbenchPageToolbar from './workbench-page-toolbar.svelte';
	import WorkbenchScaffold from './workbench-scaffold.svelte';
	import WorkbenchToolbar from './workbench-toolbar.svelte';
	import WorkbenchWindow from './workbench-window.svelte';
	import type { WorkbenchTabItem } from './workbench-tab-strip.svelte';

	interface StoryTabSeed {
		id: string;
		label: string;
		href: string;
		title: string;
		description: string;
		icon?: Component<{ class?: string }>;
	}

	let {
		compactSplitDetailDemo = false,
		overflowBodyDemo = false,
		fillNestedScrollDemo = false,
	}: {
		compactSplitDetailDemo?: boolean;
		overflowBodyDemo?: boolean;
		fillNestedScrollDemo?: boolean;
	} = $props();

	let activeTabId = $state('workspace');
	let detailCompact = $state(false);
	let detailOpen = $state(true);
	let selectedDetailId = $state('alpha');
	const tabSeeds: StoryTabSeed[] = [
		{
			id: 'workspace',
			label: 'Workspace',
			href: '/workspaces',
			title: 'Workspace',
			description: 'Primary workspace window surface.',
			icon: FolderKanbanIcon,
		},
		{
			id: 'new-room',
			label: 'New room',
			href: '/messages/new',
			title: 'Create room',
			description: 'Fixed new-room tab in the same shared window chrome.',
			icon: MailPlusIcon,
		},
	];

	const tabs = tabSeeds satisfies WorkbenchTabItem[];

	const selectDetail = (detailId: string): void => {
		selectedDetailId = detailId;
		detailOpen = true;
	};
</script>

{#snippet toolbar()}
	<WorkbenchToolbar>
		{#snippet content()}
			<div class="flex h-full items-center justify-between gap-3 px-3">
				<div class="min-w-0">
					<h1 class="truncate text-sm font-semibold tracking-tight text-foreground">Window shell</h1>
				</div>
				<Badge variant="outline" class="bg-background/70">Chrome window</Badge>
			</div>
		{/snippet}
	</WorkbenchToolbar>
{/snippet}

<Tooltip.Provider delayDuration={0}>
	<div class={compactSplitDetailDemo ? 'h-[42rem] w-full max-w-[40rem] p-4' : 'h-[42rem] w-full max-w-5xl p-4'}>
		<WorkbenchWindow
			ariaLabel="Workbench window story"
			value={activeTabId}
			{tabs}
			{toolbar}
			bodyMode={fillNestedScrollDemo ? 'fill' : 'scroll'}
		>
			{#if compactSplitDetailDemo}
				<WorkbenchPageToolbar>
					<div class="flex h-full items-center justify-between gap-3 px-3">
						<div class="text-sm font-medium" data-testid="workbench-window-route-toolbar">Route toolbar</div>
						<Button
							variant="ghost"
							size="sm"
							disabled={!detailCompact}
							onclick={() => {
								detailOpen = true;
							}}
						>
							Open detail
						</Button>
					</div>
				</WorkbenchPageToolbar>

				<WorkbenchScaffold tone="page" data-testid="workbench-window-story-page">
					{#snippet header()}
						<div class="grid gap-1">
							<h2 class="text-sm font-semibold text-foreground">Compact Split Detail</h2>
							<p class="text-sm text-muted-foreground">
								The shared toolbar should take over close ownership while the right detail sheet is open.
							</p>
						</div>
					{/snippet}

					<WorkbenchPageContent
						class="h-full"
						detailLayout="split-detail"
						bind:detailCompact
						bind:detailOpen
						detailRatioPersistence="workbench-window-story:detail"
						data-testid="workbench-window-detail-demo"
					>
						{#snippet main()}
							<div class="grid gap-3 px-5 py-6 md:px-7">
								{#each ['alpha', 'beta', 'gamma'] as detailId}
									<Button
										variant={selectedDetailId === detailId ? 'secondary' : 'outline'}
										onclick={() => {
											selectDetail(detailId);
										}}
									>
										Open {detailId}
									</Button>
								{/each}
							</div>
						{/snippet}

						{#snippet drawer()}
							<WorkbenchDetailDrawer
								title="Preview"
								description="Compact detail should remain dismissible from the toolbar position."
							>
								<div class="rounded-xl border px-4 py-3 text-sm font-medium">
									Selected detail: {selectedDetailId}
								</div>
							</WorkbenchDetailDrawer>
						{/snippet}
					</WorkbenchPageContent>
				</WorkbenchScaffold>
			{:else if overflowBodyDemo}
				<WorkbenchScaffold tone="page" data-testid="workbench-window-story-page">
					{#snippet header()}
						<div class="grid gap-1">
							<h2 class="text-sm font-semibold text-foreground">Overflow Body Surface</h2>
							<p class="text-sm text-muted-foreground">
								The shared window body should own page-level scrolling when route content exceeds the available height.
							</p>
						</div>
					{/snippet}

					<div class="grid gap-4 px-5 py-6 md:px-7">
						{#each Array.from({ length: 14 }, (_, index) => index + 1) as sectionId}
							<div
								class="grid gap-2 rounded-[1rem] border border-border/60 bg-background/55 p-5"
								data-testid={`workbench-window-overflow-card-${sectionId}`}
							>
								<div class="text-sm font-semibold text-foreground">Section {sectionId}</div>
								<p class="text-sm leading-6 text-muted-foreground">
									This intentionally tall route section exists to verify that the shared chrome body scrolls as one band instead of clipping page content under the window frame.
								</p>
							</div>
						{/each}
					</div>
				</WorkbenchScaffold>
			{:else if fillNestedScrollDemo}
				<div class="h-full" data-testid="workbench-window-fill-demo-route">
					<ScrollView
						class="h-full"
						viewportTestId="workbench-window-fill-nested-scroll-viewport"
						contentClass="grid gap-4 px-5 py-6 md:px-7"
					>
						{#each Array.from({ length: 18 }, (_, index) => index + 1) as sectionId}
							<div
								class="grid gap-2 rounded-[1rem] border border-border/60 bg-background/55 p-5"
								data-testid={`workbench-window-fill-card-${sectionId}`}
							>
								<div class="text-sm font-semibold text-foreground">Fill Section {sectionId}</div>
								<p class="text-sm leading-6 text-muted-foreground">
									This route intentionally wraps its own scroll owner in a plain h-full shell so fill-mode can prove it preserves nested scroll ownership.
								</p>
							</div>
						{/each}
					</ScrollView>
				</div>
			{:else}
				<WorkbenchScaffold tone="page" data-testid="workbench-window-story-page">
					{#snippet header()}
						<div class="grid gap-1">
							<h2 class="text-sm font-semibold text-foreground">Body Surface</h2>
							<p class="text-sm text-muted-foreground">
								This body lives inside the same shared window surface as the tabs and toolbar.
							</p>
						</div>
					{/snippet}

					<div class="grid h-full place-items-center px-5 py-6 md:px-7">
						<div class="w-full max-w-3xl rounded-[1rem] border border-dashed border-border/70 bg-background/55 p-5">
							<p class="text-sm text-muted-foreground">
								The route shell is integrated into the window instead of creating a second detached card.
							</p>
						</div>
					</div>
				</WorkbenchScaffold>
			{/if}
		</WorkbenchWindow>
	</div>
	</Tooltip.Provider>
