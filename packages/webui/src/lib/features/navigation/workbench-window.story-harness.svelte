<script lang="ts">
	import FolderKanbanIcon from '@lucide/svelte/icons/folder-kanban';
	import MailPlusIcon from '@lucide/svelte/icons/mail-plus';
	import type { Component } from 'svelte';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
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

	let activeTabId = $state('workspace');
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
	<div class="h-[42rem] w-full max-w-5xl p-4">
		<WorkbenchWindow ariaLabel="Workbench window story" value={activeTabId} {tabs} {toolbar}>
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
		</WorkbenchWindow>
	</div>
	</Tooltip.Provider>
