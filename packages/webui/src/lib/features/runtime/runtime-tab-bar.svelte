<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import { goto } from '$app/navigation';

	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { cn } from '$lib/utils.js';
	import type { RuntimeTabId, RuntimeTabItem } from './runtime-shell-state';

	let {
		sessionId,
		activeTab,
		tabs,
		class: className = '',
		listClass = '',
		triggerClass = '',
		onNavigate,
	}: {
		sessionId: string;
		activeTab: RuntimeTabId;
		tabs: RuntimeTabItem[];
		class?: string;
		listClass?: string;
		triggerClass?: string;
		onNavigate?: (tab: RuntimeTabId) => void | Promise<void>;
	} = $props();
</script>

<Tabs.Root
	value={activeTab}
	onValueChange={(value) => {
		if (onNavigate) {
			void onNavigate(value as RuntimeTabId);
			return;
		}
		void goto(`/avatars/runtime/${encodeURIComponent(sessionId)}/${value}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	}}
>
	<ScrollView class={cn('w-full', className)} orientation="horizontal" contentClass="min-w-max">
		<Tabs.List class={cn('w-max min-w-full', listClass)}>
			{#each tabs as tab (tab.id)}
				<Tabs.Trigger value={tab.id} class={cn('gap-2', triggerClass)} data-runtime-tab={tab.id}>
					<span>{tab.label}</span>
					{#if tab.badgeLabel}
						<span
							class={cn(
								'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
								tab.badgeClassName ?? 'bg-muted text-muted-foreground',
								tab.badgeAnimated && 'animate-pulse',
							)}
						>
							{tab.badgeLabel}
						</span>
					{/if}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
	</ScrollView>
</Tabs.Root>
