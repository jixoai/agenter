<script lang="ts">
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import PlayIcon from '@lucide/svelte/icons/play';
	import StopCircleIcon from '@lucide/svelte/icons/stop-circle';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import { cn } from '$lib/utils.js';

	import RuntimeTabBar from './runtime-tab-bar.svelte';
	import type { RuntimeTabId, RuntimeTabItem } from './runtime-shell-state';

	let {
		sessionId,
		title,
		workspaceLabel,
		statusLabel,
		unreadCount = 0,
		sessionIconUrl = null,
		activeTab,
		tabs,
		isRunning,
		onToggleRuntime,
	}: {
		sessionId: string;
		title: string;
		workspaceLabel: string;
		statusLabel: string;
		unreadCount?: number;
		sessionIconUrl?: string | null;
		activeTab: RuntimeTabId;
		tabs: RuntimeTabItem[];
		isRunning: boolean;
		onToggleRuntime: () => void | Promise<void>;
	} = $props();

</script>

{#snippet runtimeToolbarPageTabs(toolbarState: WorkbenchToolbarRenderState)}
	<RuntimeTabBar
		{sessionId}
		{activeTab}
		{tabs}
		{toolbarState}
		class="min-w-0"
	/>
{/snippet}

{#snippet runtimeToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<ProfileAvatar label={title} src={sessionIconUrl} class="runtime-page-toolbar__avatar" />
{/snippet}

{#snippet runtimeToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">{title}</span>
{/snippet}

{#snippet runtimeToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="inline-flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
		<FolderTreeIcon class="size-3.5 shrink-0" />
		<span class="truncate">{workspaceLabel}</span>
	</span>
{/snippet}

{#snippet runtimeToolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class={cn(
			'flex min-w-0 flex-wrap items-center gap-1',
			toolbarState.placement === 'overflow' ? 'justify-start' : 'justify-end',
		)}
	>
		<WorkbenchToolbarStatus
			placement={toolbarState.placement}
			label={statusLabel}
			title={statusLabel}
			tone={isRunning ? 'positive' : 'neutral'}
			caps
		/>
		{#if unreadCount > 0 && (toolbarState.isWide || toolbarState.placement === 'overflow')}
			<WorkbenchToolbarStatus
				placement={toolbarState.placement}
				label={`${unreadCount} unread`}
				title={`${unreadCount} unread`}
				tone="accent"
			/>
		{/if}
	</div>
{/snippet}

{#snippet runtimeToolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<div class={cn('flex min-w-0 items-center gap-1', toolbarState.placement === 'overflow' && 'grid gap-2')}>
		<WorkbenchToolbarAction
			placement={toolbarState.placement}
			label={isRunning ? 'Stop runtime' : 'Start runtime'}
			title={isRunning ? 'Stop runtime' : 'Start runtime'}
			inlineTone={isRunning ? 'critical' : 'active'}
			overflowVariant={isRunning ? 'destructive' : 'default'}
			onclick={() => void onToggleRuntime()}
		>
			{#if isRunning}
				<StopCircleIcon class="size-4" />
			{:else}
				<PlayIcon class="size-4" />
			{/if}
		</WorkbenchToolbarAction>
	</div>
{/snippet}

<WorkbenchToolbar
	pageTabs={runtimeToolbarPageTabs}
	identityLeading={runtimeToolbarIdentityLeading}
	identityTitle={runtimeToolbarIdentityTitle}
	identitySubtitle={runtimeToolbarIdentitySubtitle}
	status={runtimeToolbarStatus}
	actions={runtimeToolbarActions}
	overflowLabel="Open runtime toolbar details"
/>

<style>
	:global(.runtime-page-toolbar__avatar) {
		block-size: 1.6rem;
		inline-size: 1.6rem;
		border-radius: 0.8rem;
		border-color: color-mix(in srgb, var(--border), transparent 20%);
		background: color-mix(in srgb, var(--background), transparent 12%);
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--background), white 78%);
	}

	@container workbench-page-toolbar (max-width: 44rem) {
		:global(.runtime-page-toolbar__avatar) {
			block-size: 1.45rem;
			inline-size: 1.45rem;
		}
	}
</style>
