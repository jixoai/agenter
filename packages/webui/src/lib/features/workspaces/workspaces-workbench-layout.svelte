<script lang="ts">
	import FolderKanbanIcon from '@lucide/svelte/icons/folder-kanban';
	import FolderRootIcon from '@lucide/svelte/icons/folder-root';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import { resolveAdjacentWorkbenchTab } from '$lib/features/navigation/workbench-tab-state';

	import {
		WORKSPACE_TABS_CHANGE_EVENT,
		readWorkspaceWorkbenchTabs,
		removeWorkspaceWorkbenchTab,
		upsertWorkspaceWorkbenchTab,
	} from './workspace-tabs-state';
	import { describeCompactWorkspace, resolveObjectiveWorkspacePath, sortWorkspacesForCatalog } from './workspace-sorting';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let workspaceTabs = $state(readWorkspaceWorkbenchTabs());
	const sortedWorkspaces = $derived(
		sortWorkspacesForCatalog(controller.runtimeState.workspaces, controller.runtimeState.recentWorkspaces),
	);
	const activeWorkspacePath = $derived.by(() => {
		const match = /^\/workspaces\/root\/([^/]+)$/u.exec(page.url.pathname);
		return match ? decodeURIComponent(match[1] ?? '') : null;
	});
	const activeWorkspaceHref = $derived.by(() =>
		activeWorkspacePath ? `${page.url.pathname}${page.url.search}` : null,
	);

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const syncWorkspaceTabs = (): void => {
			workspaceTabs = readWorkspaceWorkbenchTabs();
		};
		window.addEventListener(WORKSPACE_TABS_CHANGE_EVENT, syncWorkspaceTabs);
		window.addEventListener('storage', syncWorkspaceTabs);
		return () => {
			window.removeEventListener(WORKSPACE_TABS_CHANGE_EVENT, syncWorkspaceTabs);
			window.removeEventListener('storage', syncWorkspaceTabs);
		};
	});

	$effect(() => {
		if (!activeWorkspacePath || !activeWorkspaceHref) {
			return;
		}
		workspaceTabs = upsertWorkspaceWorkbenchTab(workspaceTabs, {
			workspacePath: activeWorkspacePath,
			href: activeWorkspaceHref,
		});
	});

	const copyToClipboard = async (value: string): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
			return;
		}
		await navigator.clipboard.writeText(value);
	};

	const closeWorkspaceTab = async (workspacePath: string): Promise<void> => {
		const nextTab = resolveAdjacentWorkbenchTab(workspaceTabs, (tab) => tab.workspacePath, workspacePath);
		workspaceTabs = removeWorkspaceWorkbenchTab(workspaceTabs, workspacePath);
		if (activeWorkspacePath !== workspacePath) {
			return;
		}
		await goto(nextTab?.href ?? '/workspaces', {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const tabs = $derived.by(() => {
		const fixedTabs = [
			{
				id: 'catalog',
				href: '/workspaces',
				label: 'Start',
				icon: FolderKanbanIcon,
				title: 'Workspace start page',
				description: 'Choose a workspace root, then open its dedicated workbench tab.',
			},
		] satisfies WorkbenchTabItem[];

		const detailTabs = workspaceTabs.map((tab) => {
			const workspace = sortedWorkspaces.find((entry) => entry.path === tab.workspacePath) ?? null;
			return {
				id: tab.workspacePath,
				href: tab.href,
				label: describeCompactWorkspace(tab.workspacePath),
				icon: FolderRootIcon,
				title: workspace ? resolveObjectiveWorkspacePath(workspace, sortedWorkspaces) : tab.workspacePath,
				description: tab.workspacePath,
				closable: true,
				onClose: () => void closeWorkspaceTab(tab.workspacePath),
				menuItems: [
					{
						id: `copy:${tab.workspacePath}`,
						label: 'Copy workspace path',
						onSelect: () => void copyToClipboard(tab.workspacePath),
					},
					{
						id: `close:${tab.workspacePath}`,
						label: 'Close tab',
						danger: true,
						onSelect: () => void closeWorkspaceTab(tab.workspacePath),
					},
				],
			} satisfies WorkbenchTabItem;
		});

		return [...fixedTabs, ...detailTabs];
	});

	const activeTabValue = $derived(activeWorkspacePath ?? 'catalog');
</script>

{#snippet workspacesToolbarMeta(_toolbarState: WorkbenchToolbarRenderState)}
	<Badge variant="outline" class="bg-background/70">{controller.runtimeState.workspaces.length} workspaces</Badge>
	<Badge variant="outline" class="bg-background/70">
		{controller.runtimeState.workspaces.filter((entry) => entry.favorite).length} favorites
	</Badge>
{/snippet}

{#snippet workspacesToolbar()}
	<WorkbenchToolbar meta={workspacesToolbarMeta} />
{/snippet}

<div class="h-full" data-testid="workspaces-workbench">
	<WorkbenchWindow ariaLabel="Workspace tabs" value={activeTabValue} {tabs} toolbar={workspacesToolbar}>
		<div class="min-h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
