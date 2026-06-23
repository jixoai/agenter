<script lang="ts">
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import CircleEllipsisIcon from '@lucide/svelte/icons/circle-ellipsis';
	import PlayIcon from '@lucide/svelte/icons/play';
	import StopCircleIcon from '@lucide/svelte/icons/stop-circle';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import WrenchIcon from '@lucide/svelte/icons/wrench';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
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
		runtimeActionPending = false,
		runtimeActionIntent = null,
		heartbeatRepairPending = false,
		heartbeatClearPending = false,
		heartbeatClearDisabled = false,
		onToggleRuntime,
		onRepairHeartbeatRecordProjectionHealth,
		onClearHeartbeatSession,
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
		runtimeActionPending?: boolean;
		runtimeActionIntent?: 'start' | 'stop' | null;
		heartbeatRepairPending?: boolean;
		heartbeatClearPending?: boolean;
		heartbeatClearDisabled?: boolean;
		onToggleRuntime: () => void | Promise<void>;
		onRepairHeartbeatRecordProjectionHealth: () => void | Promise<void>;
		onClearHeartbeatSession: () => void | Promise<void>;
	} = $props();

	const runtimeActionLabel = $derived.by(() => {
		if (runtimeActionPending && runtimeActionIntent === 'start') {
			return 'Starting runtime…';
		}
		if (runtimeActionPending && runtimeActionIntent === 'stop') {
			return 'Stopping runtime…';
		}
		return isRunning ? 'Stop runtime' : 'Start runtime';
	});

	const runtimeActionTitle = $derived(runtimeActionLabel);
	const heartbeatActionPending = $derived(heartbeatRepairPending || heartbeatClearPending);
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
			label={runtimeActionLabel}
			title={runtimeActionTitle}
			inlineTone={isRunning ? 'critical' : 'active'}
			overflowVariant={isRunning ? 'destructive' : 'default'}
			disabled={runtimeActionPending}
			onclick={() => void onToggleRuntime()}
		>
			{#if isRunning}
				<StopCircleIcon class="size-4" />
			{:else}
				<PlayIcon class="size-4" />
			{/if}
		</WorkbenchToolbarAction>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						type="button"
						size="icon-sm"
						variant="ghost"
						class="rounded-full text-muted-foreground hover:text-foreground data-[state=open]:bg-accent"
						disabled={heartbeatActionPending}
						aria-label="More runtime actions"
						title="More"
					>
						<CircleEllipsisIcon class="size-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" sideOffset={6}>
				<DropdownMenu.Item
					disabled={heartbeatActionPending}
					onclick={() => void onRepairHeartbeatRecordProjectionHealth()}
				>
					<div class="flex items-center gap-2">
						<WrenchIcon class="size-4" />
						<span>{heartbeatRepairPending ? 'Repairing Heartbeat projections' : 'Repair Heartbeat projections'}</span>
					</div>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					variant="destructive"
					disabled={heartbeatActionPending || heartbeatClearDisabled}
					onclick={() => void onClearHeartbeatSession()}
				>
					<div class="flex items-center gap-2">
						<Trash2Icon class="size-4" />
						<span>{heartbeatClearPending ? '正在清空 Heartbeat Session' : '清空 Heartbeat Session'}</span>
					</div>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
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
