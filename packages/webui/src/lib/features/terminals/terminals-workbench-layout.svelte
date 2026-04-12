<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';

	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import {
		dismissWorkbenchTabId,
		filterDismissedWorkbenchTabs,
		readDismissedWorkbenchTabIds,
		resolveAdjacentWorkbenchTab,
		restoreWorkbenchTabId,
	} from '$lib/features/navigation/workbench-tab-state';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let dismissedTerminalIds = $state<string[]>(readDismissedWorkbenchTabIds('terminals'));

	const activeTerminalId = $derived.by(() => {
		const match = /^\/terminals\/([^/]+)$/u.exec(page.url.pathname);
		return match ? decodeURIComponent(match[1] ?? '') : null;
	});

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalTerminals();
		void controller.runtimeStore.hydrateGlobalTerminals();
		return () => {
			release();
		};
	});

	$effect(() => {
		if (!activeTerminalId) {
			return;
		}
		dismissedTerminalIds = restoreWorkbenchTabId('terminals', dismissedTerminalIds, activeTerminalId);
	});

	const visibleTerminals = $derived(
		filterDismissedWorkbenchTabs(
			controller.runtimeState.globalTerminals.data,
			(terminal) => terminal.terminalId,
			dismissedTerminalIds,
		),
	);

	const copyToClipboard = async (value: string): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
			return;
		}
		await navigator.clipboard.writeText(value);
	};

	const closeTerminalTab = async (terminalId: string): Promise<void> => {
		const nextTerminal = resolveAdjacentWorkbenchTab(visibleTerminals, (terminal) => terminal.terminalId, terminalId);
		dismissedTerminalIds = dismissWorkbenchTabId('terminals', dismissedTerminalIds, terminalId);
		if (activeTerminalId !== terminalId) {
			return;
		}
		await goto(nextTerminal ? `/terminals/${encodeURIComponent(nextTerminal.terminalId)}` : '/terminals/new', {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const tabs = $derived.by(() => {
		const terminalTabs = visibleTerminals.map((terminal) => ({
			id: terminal.terminalId,
			href: `/terminals/${encodeURIComponent(terminal.terminalId)}`,
			label: terminal.title || terminal.terminalId,
			title: terminal.cwd,
			description: terminal.cwd,
			closable: true,
			onClose: () => void closeTerminalTab(terminal.terminalId),
			menuItems: [
				{
					id: `copy:${terminal.terminalId}`,
					label: 'Copy terminal id',
					onSelect: () => void copyToClipboard(terminal.terminalId),
				},
				{
					id: `copy-cwd:${terminal.terminalId}`,
					label: 'Copy cwd',
					onSelect: () => void copyToClipboard(terminal.cwd),
				},
				{
					id: `close:${terminal.terminalId}`,
					label: 'Close tab',
					danger: true,
					onSelect: () => void closeTerminalTab(terminal.terminalId),
				},
			],
		})) satisfies WorkbenchTabItem[];

		return [
			...terminalTabs,
			{
				id: 'new-terminal',
				href: '/terminals/new',
				label: 'New terminal',
				icon: PlusIcon,
				title: 'Create terminal',
				description: 'Create a new shared terminal from a dedicated browser-style tab.',
			},
		] satisfies WorkbenchTabItem[];
	});
</script>

{#snippet terminalsToolbarMeta(_toolbarState: WorkbenchToolbarRenderState)}
	<Badge variant="outline" class="bg-background/70">{visibleTerminals.length} open tabs</Badge>
	<Badge variant="outline" class="bg-background/70">
		{controller.runtimeState.globalTerminals.data.length} total terminals
	</Badge>
	{#if dismissedTerminalIds.length > 0}
		<Badge variant="outline" class="bg-background/70">{dismissedTerminalIds.length} hidden tabs</Badge>
	{/if}
{/snippet}

{#snippet terminalsToolbar()}
	<WorkbenchToolbar meta={terminalsToolbarMeta} />
{/snippet}

<div class="h-full" data-testid="terminals-workbench">
	<WorkbenchWindow
		ariaLabel="Terminal tabs"
		value={activeTerminalId ?? 'new-terminal'}
		{tabs}
		toolbar={terminalsToolbar}
	>
		<div class="h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
