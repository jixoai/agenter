<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import { cn } from '$lib/utils.js';

	import type { MessageSystemRoomSeatState } from './message-system-surface.types';

	type RoomBodyMode = 'chat' | 'assets';
	type ViewerOption = {
		value: string;
		label: string;
		iconUrl?: string | null;
	};

	const roomModes = [
		{ value: 'chat', label: 'Chat' },
		{ value: 'assets', label: 'Assets' },
	] as const satisfies WorkbenchPageTabItem[];

	let {
		selectedViewer,
		selectedViewerActorId,
		viewerItems,
		selectedViewerLabel,
		selectedViewerSubtitle,
		canSelectViewer,
		activeMode,
		canSearch = true,
		actionsDisabled = false,
		onSelectViewer,
		onSelectMode,
		onSearchClick,
		onAddUserClick,
		onManageClick,
	}: {
		selectedViewer: MessageSystemRoomSeatState | null;
		selectedViewerActorId: string | null;
		viewerItems: ViewerOption[];
		selectedViewerLabel: string;
		selectedViewerSubtitle?: string;
		canSelectViewer: boolean;
		activeMode: RoomBodyMode;
		canSearch?: boolean;
		actionsDisabled?: boolean;
		onSelectViewer: (actorId: string) => void;
		onSelectMode: (mode: RoomBodyMode) => void;
		onSearchClick: () => void;
		onAddUserClick: () => void;
		onManageClick: () => void;
	} = $props();

	const viewerAvatarLabel = $derived(selectedViewer?.label ?? selectedViewerLabel ?? 'Room user');
</script>

{#snippet roomToolbarPageTabs(_toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchPageTabs
		ariaLabel="Room sections"
		value={activeMode}
		items={roomModes}
		toolbarState={_toolbarState}
		onValueChange={(value) => {
			onSelectMode(value as RoomBodyMode);
		}}
	/>
{/snippet}

{#snippet roomToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<ProfileAvatar label={viewerAvatarLabel} src={selectedViewer?.iconUrl ?? null} class="room-page-toolbar__avatar-image" />
{/snippet}

{#snippet roomToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	{#if canSelectViewer}
		<Select.Root
			type="single"
			items={viewerItems}
			value={selectedViewerActorId ?? undefined}
			onValueChange={(value) => {
				onSelectViewer(value);
			}}
		>
			<Select.Trigger
				size="sm"
				aria-label="View room as user"
				class="room-page-toolbar__viewer-trigger"
				title={selectedViewerLabel}
			>
				<span class="truncate">{selectedViewerLabel}</span>
			</Select.Trigger>
			<Select.Content>
				{#each viewerItems as item (item.value)}
					<Select.Item value={item.value} label={item.label}>
						<div class="room-page-toolbar__viewer-option">
							<ProfileAvatar
								label={item.label}
								src={item.iconUrl ?? null}
								class="room-page-toolbar__viewer-option-avatar"
							/>
							<span class="truncate">{item.label}</span>
						</div>
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	{:else}
		<div class="truncate" title={selectedViewerLabel}>
			{selectedViewerLabel}
		</div>
	{/if}
{/snippet}

{#snippet roomToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">{selectedViewerSubtitle}</span>
{/snippet}

{#snippet roomToolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class={cn(
			'flex min-w-0 items-center gap-1',
			toolbarState.placement === 'overflow' && 'grid gap-2',
		)}
		aria-label="Room actions"
	>
		<WorkbenchToolbarAction
			type="button"
			placement={toolbarState.placement}
			label="Search messages"
			title="Search messages"
			disabled={!canSearch}
			onclick={onSearchClick}
		>
			<SearchIcon class="size-4" />
		</WorkbenchToolbarAction>
		<WorkbenchToolbarAction
			type="button"
			placement={toolbarState.placement}
			label="Add user"
			title="Add user"
			disabled={actionsDisabled}
			onclick={onAddUserClick}
		>
			<UserPlusIcon class="size-4" />
		</WorkbenchToolbarAction>
		<WorkbenchToolbarAction
			type="button"
			placement={toolbarState.placement}
			label="Manage room"
			title="Manage room"
			disabled={actionsDisabled}
			onclick={onManageClick}
		>
			<Settings2Icon class="size-4" />
		</WorkbenchToolbarAction>
	</div>
{/snippet}

<WorkbenchToolbar
	pageTabs={roomToolbarPageTabs}
	identityLeading={roomToolbarIdentityLeading}
	identityTitle={roomToolbarIdentityTitle}
	identitySubtitle={roomToolbarIdentitySubtitle}
	actions={roomToolbarActions}
	overflowLabel="Open room toolbar details"
/>

<style>
	:global(.room-page-toolbar__avatar-image) {
		block-size: 1.7rem;
		inline-size: 1.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--background), transparent 12%);
		box-shadow: none;
	}

	:global(.room-page-toolbar__viewer-trigger),
	:global(.room-page-toolbar__viewer-trigger[data-slot='select-trigger']) {
		block-size: 1.2rem;
		min-block-size: 1.2rem;
		inline-size: fit-content;
		max-inline-size: 100%;
		min-inline-size: 0;
		justify-content: flex-start;
		gap: 0.14rem;
		border: 0;
		background: transparent;
		padding: 0;
		color: var(--foreground);
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1;
		box-shadow: none;
	}

	:global(.room-page-toolbar__viewer-trigger > svg) {
		inline-size: 0.72rem;
		block-size: 0.72rem;
		opacity: 0.5;
	}

	:global(.room-page-toolbar__viewer-trigger > .truncate) {
		max-inline-size: 100%;
	}

	:global(.room-page-toolbar__viewer-option) {
		display: inline-flex;
		min-inline-size: 0;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.room-page-toolbar__viewer-option-avatar) {
		block-size: 1.2rem;
		inline-size: 1.2rem;
		border-radius: 999px;
		border-color: color-mix(in srgb, var(--border), transparent 18%);
		background: color-mix(in srgb, var(--background), transparent 8%);
		box-shadow: none;
	}

	@container workbench-page-toolbar (max-width: 44rem) {
		:global(.room-page-toolbar__avatar-image) {
			block-size: 1.55rem;
			inline-size: 1.55rem;
		}

		:global(.room-page-toolbar__viewer-trigger),
		:global(.room-page-toolbar__viewer-trigger[data-slot='select-trigger']) {
			font-size: 0.76rem;
		}
	}
</style>
