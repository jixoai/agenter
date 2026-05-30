<script lang="ts">
	import { goto } from '$app/navigation';

	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import type { RuntimeTabId, RuntimeTabItem } from './runtime-shell-state';

	let {
		sessionId,
		activeTab,
		tabs,
		toolbarState,
		class: className = '',
		onNavigate,
	}: {
		sessionId: string;
		activeTab: RuntimeTabId;
		tabs: RuntimeTabItem[];
		toolbarState: WorkbenchToolbarRenderState;
		class?: string;
		onNavigate?: (tab: RuntimeTabId) => void | Promise<void>;
	} = $props();

	const items = $derived(
		tabs.map(
			(tab) =>
				({
					value: tab.id,
					label: tab.label,
					badgeLabel: tab.badgeLabel,
					badgeTone: tab.badgeTone,
					badgeAnimated: tab.badgeAnimated,
				}) satisfies WorkbenchPageTabItem,
		),
	);
</script>

<WorkbenchPageTabs
	ariaLabel="Runtime sections"
	value={activeTab}
	{toolbarState}
	{items}
	class={className}
	onValueChange={(value) => {
		const nextValue = value as RuntimeTabId;
		if (onNavigate) {
			void onNavigate(nextValue);
			return;
		}
		void goto(`/avatars/runtime/${encodeURIComponent(sessionId)}/${nextValue}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	}}
/>
