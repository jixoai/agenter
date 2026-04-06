<script lang="ts">
	import FolderKanbanIcon from '@lucide/svelte/icons/folder-kanban';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import type { Component } from 'svelte';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import WorkbenchTabStrip, {
		type WorkbenchTabItem,
		type WorkbenchTabMenuItem,
	} from './workbench-tab-strip.svelte';
	import { resolveAdjacentWorkbenchTab } from './workbench-tab-state';
	import WorkbenchToolbar from './workbench-toolbar.svelte';

	interface StoryTabSeed {
		id: string;
		label: string;
		href: string;
		title: string;
		description: string;
		icon?: Component<{ class?: string }>;
		avatarLabel?: string;
		avatarUrl?: string | null;
		badgeLabel?: string;
		badgeClassName?: string;
		loading?: boolean;
		closable?: boolean;
		menuItems?: Array<{
			id: string;
			label: string;
			danger?: boolean;
		}>;
	}

	let {
		initialValue = 'session-reviewer',
	}: {
		initialValue?: string;
	} = $props();

	let activeTabId = $state('');
	let eventLog = $state('idle');
	let tabSeeds = $state<StoryTabSeed[]>([
		{
			id: 'workspace',
			label: 'Workspace',
			href: '/avatars/workspace',
			title: 'Workspace',
			description: 'Browse avatars, launch sessions, and inspect the workspace catalog.',
			icon: FolderKanbanIcon,
		},
		{
			id: 'history',
			label: 'History',
			href: '/avatars/history',
			title: 'History',
			description: 'Inspect recent workspace and avatar activity across prior sessions.',
			icon: HistoryIcon,
		},
		{
			id: 'session-reviewer',
			label: 'reviewer · workspace alpha pending tools',
			href: '/avatars/runtime/session-reviewer/attention',
			title: 'reviewer · alpha workspace',
			description: 'Workspace alpha · attention pending and 2 unread tool results.',
			avatarLabel: 'reviewer',
			avatarUrl: null,
			badgeLabel: '2',
			badgeClassName: 'bg-emerald-600 text-white',
			loading: true,
			closable: true,
			menuItems: [
				{
					id: 'copy-session-id',
					label: 'Copy session id',
				},
				{
					id: 'close-tab',
					label: 'Close tab',
					danger: true,
				},
			],
		},
	]);

	$effect(() => {
		if (!activeTabId) {
			activeTabId = initialValue;
		}
	});

	const handleTabClose = (tabId: string): void => {
		const nextTab = resolveAdjacentWorkbenchTab(tabSeeds, (tab) => tab.id, tabId);
		tabSeeds = tabSeeds.filter((tab) => tab.id !== tabId);
		eventLog = `close:${tabId}`;
		if (activeTabId === tabId) {
			activeTabId = nextTab?.id ?? tabSeeds[0]?.id ?? '';
		}
	};

	const handleMenuSelect = (tabId: string, itemId: string): void => {
		eventLog = `menu:${tabId}:${itemId}`;
		if (itemId === 'close-tab') {
			handleTabClose(tabId);
		}
	};

	const tabs = $derived.by(
		() =>
			tabSeeds.map(
				(tab): WorkbenchTabItem => ({
					...tab,
					onClose: tab.closable ? () => handleTabClose(tab.id) : undefined,
					menuItems: tab.menuItems?.map(
						(item): WorkbenchTabMenuItem => ({
							...item,
							onSelect: () => handleMenuSelect(tab.id, item.id),
						}),
					),
				}),
			),
	);
</script>

{#snippet toolbar()}
	<WorkbenchToolbar>
		{#snippet primary()}
			<div class="grid gap-1">
				<h1 class="text-sm font-semibold tracking-tight text-foreground">Avatar workbench</h1>
				<p class="max-w-2xl text-xs leading-5 text-muted-foreground">
					Story harness for the shared tabs plus toolbar chrome law.
				</p>
			</div>
		{/snippet}
		{#snippet actions()}
			<Button size="sm" variant="outline" onclick={() => (eventLog = 'toolbar:inspect-state')}>
				Inspect state
			</Button>
			<Button size="sm" variant="ghost" onclick={() => (eventLog = 'toolbar:reopen-last')}>
				Reopen last
			</Button>
		{/snippet}
		{#snippet meta()}
			<Badge variant="outline" class="bg-background/70">{tabSeeds.length} tabs visible</Badge>
			<Badge variant="outline" class="bg-background/70">2 unread tool results</Badge>
		{/snippet}
	</WorkbenchToolbar>
{/snippet}

<div class="grid gap-3">
	<div class="grid gap-0">
		<WorkbenchTabStrip
			ariaLabel="Workbench tabs story"
			value={activeTabId}
			{tabs}
			fusedBelow
			onValueChange={(nextValue) => {
				activeTabId = nextValue;
				eventLog = `select:${nextValue}`;
			}}
		/>

		<div
			class="rounded-b-[1.35rem] border-x border-b border-border/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_14%)_0%,color-mix(in_srgb,var(--card),white_5%)_58%,color-mix(in_srgb,var(--background),transparent_8%)_100%)] px-4 py-3 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_56%),0_22px_44px_-40px_color-mix(in_srgb,var(--foreground),transparent_16%)]"
			data-workbench-page-toolbar
		>
			{@render toolbar()}
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
		<div class="rounded-full border px-2 py-1">
			Active:
			<span class="font-medium text-foreground" data-testid="workbench-tab-state">{activeTabId}</span>
		</div>
		<div class="rounded-full border px-2 py-1">
			Event:
			<span class="font-medium text-foreground" data-testid="workbench-tab-event-log">{eventLog}</span>
		</div>
	</div>
</div>
