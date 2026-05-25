<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';

	import { page } from '$app/state';
	import type { Snippet } from 'svelte';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';
	import {
		dismissWorkbenchTabId,
		filterDismissedWorkbenchTabs,
		readDismissedWorkbenchTabIds,
		resolveAdjacentWorkbenchTab,
		restoreWorkbenchTabId,
	} from '$lib/features/navigation/workbench-tab-state';
	import {
		resolveTerminalIdentitySubtitle,
		resolveTerminalInstanceName,
		resolveTerminalLifecycleFacts,
	} from './terminal-display';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const controller = getAppControllerContext();
	let dismissedTerminalIds = $state<string[]>(readDismissedWorkbenchTabIds('terminals'));

	const activeWorkbenchTabId = $derived.by(() => {
		if (page.url.pathname === '/terminals/new') {
			return 'new-terminal';
		}
		if (page.url.pathname === '/terminals/history') {
			return 'terminal-history';
		}
		if (page.url.pathname === '/terminals/archive') {
			return 'terminal-archive';
		}
		const match = /^\/terminals\/([^/]+)$/u.exec(page.url.pathname);
		return match ? decodeURIComponent(match[1] ?? '') : null;
	});

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalTerminals();
		const releaseHistory = controller.runtimeStore.retainGlobalTerminalHistory();
		const releaseArchive = controller.runtimeStore.retainGlobalTerminalArchive();
		void controller.runtimeStore.hydrateGlobalTerminals().catch(() => undefined);
		void controller.runtimeStore.hydrateGlobalTerminalHistory().catch(() => undefined);
		void controller.runtimeStore.hydrateGlobalTerminalArchive().catch(() => undefined);
		return () => {
			releaseArchive();
			releaseHistory();
			release();
		};
	});

	$effect(() => {
		if (
			!activeWorkbenchTabId ||
			activeWorkbenchTabId === 'new-terminal' ||
			activeWorkbenchTabId === 'terminal-history' ||
			activeWorkbenchTabId === 'terminal-archive'
		) {
			return;
		}
		dismissedTerminalIds = restoreWorkbenchTabId('terminals', dismissedTerminalIds, activeWorkbenchTabId);
	});

	const visibleTerminals = $derived(
		filterDismissedWorkbenchTabs(
			controller.runtimeState.globalTerminals.data,
			(terminal) => terminal.terminalId,
			dismissedTerminalIds,
		),
	);
	const historyTerminals = $derived(controller.runtimeState.globalTerminalHistory.data);
	const archivedTerminals = $derived(controller.runtimeState.globalTerminalArchive.data);

	const copyToClipboard = async (value: string): Promise<void> => {
		if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
			return;
		}
		await navigator.clipboard.writeText(value);
	};

	const closeTerminalTab = async (terminalId: string): Promise<void> => {
		const nextTerminal = resolveAdjacentWorkbenchTab(visibleTerminals, (terminal) => terminal.terminalId, terminalId);
		dismissedTerminalIds = dismissWorkbenchTabId('terminals', dismissedTerminalIds, terminalId);
		if (activeWorkbenchTabId !== terminalId) {
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
			label: resolveTerminalInstanceName(terminal),
			title: resolveTerminalLifecycleFacts(terminal)
				.map((fact) => fact.label)
				.join(' · '),
			description: resolveTerminalIdentitySubtitle(terminal),
			closable: true,
			onClose: () => void closeTerminalTab(terminal.terminalId),
			menuItems: [
				{
					id: `copy:${terminal.terminalId}`,
					label: 'Copy terminal id',
					onSelect: () => void copyToClipboard(terminal.terminalId),
				},
				{
					id: `copy-path:${terminal.terminalId}`,
					label: terminal.currentPath ? 'Copy current path' : 'Copy launch cwd',
					onSelect: () => void copyToClipboard(terminal.currentPath ?? terminal.launchCwd),
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
			...(historyTerminals.length > 0
				? [
						{
							id: 'terminal-history',
							href: '/terminals/history',
							label: 'Index',
							title: 'All terminals',
							description: 'Live terminals appear first, then killed terminals in reverse stop order.',
							badgeLabel: String(historyTerminals.length),
						} satisfies WorkbenchTabItem,
					]
				: []),
			...(archivedTerminals.length > 0
				? [
						{
							id: 'terminal-archive',
							href: '/terminals/archive',
							label: 'Archive',
							title: 'Archived terminals',
							description: 'Review terminals that were removed from the default history queue.',
							badgeLabel: String(archivedTerminals.length),
						} satisfies WorkbenchTabItem,
					]
				: []),
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

<div class="h-full" data-testid="terminals-workbench">
	<WorkbenchWindow
		ariaLabel="Terminal tabs"
		value={activeWorkbenchTabId ?? 'new-terminal'}
		{tabs}
		bodyMode="fill"
		bodyClass="rounded-none border-0 bg-transparent shadow-none"
	>
		<div class="min-h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
