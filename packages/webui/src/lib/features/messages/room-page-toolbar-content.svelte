<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';

	import ActorSelect from '$lib/features/collaboration/actor-select.svelte';
	import type { ActorSelectItem } from '$lib/features/collaboration/actor-select.types';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import { cn } from '$lib/utils.js';

	import type { MessageSystemRoomSeatState } from './message-system-surface.types';

	type RoomBodyMode = 'chat' | 'assets';
	type ViewerOption = {
		value: string;
		label: string;
		subtitle?: string;
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
	const selectedViewerItem = $derived.by(() => {
		if (!selectedViewer && !selectedViewerLabel) {
			return null;
		}
		return {
			value: selectedViewerActorId ?? selectedViewer?.actorId ?? 'room-viewer',
			label: selectedViewerLabel,
			subtitle: selectedViewerSubtitle,
			iconUrl: selectedViewer?.iconUrl ?? null,
		} satisfies ActorSelectItem;
	});
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

{#snippet roomToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	{#if canSelectViewer}
		<ActorSelect
			chrome="borderless"
			density="compact"
			ariaLabel="View room as user"
			items={viewerItems}
			value={selectedViewerActorId}
			selectedItem={selectedViewerItem}
			showTriggerSubtitle={false}
			showMenuSubtitle={false}
			onValueChange={(value) => {
				onSelectViewer(value);
			}}
		/>
	{:else}
		<div class="room-page-toolbar__viewer-static" title={selectedViewerLabel}>
			<ProfileAvatar label={viewerAvatarLabel} src={selectedViewer?.iconUrl ?? null} class="room-page-toolbar__avatar-image" />
			<div class="grid min-w-0 text-left leading-tight">
				<div class="truncate text-[0.82rem] font-semibold text-foreground">{selectedViewerLabel}</div>
				{#if selectedViewerSubtitle}
					<div class="truncate text-[0.68rem] text-muted-foreground">{selectedViewerSubtitle}</div>
				{/if}
			</div>
		</div>
	{/if}
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
	identityTitle={roomToolbarIdentityTitle}
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

	.room-page-toolbar__viewer-static {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		max-inline-size: 100%;
		min-inline-size: 0;
	}

	@container workbench-page-toolbar (max-width: 44rem) {
		:global(.room-page-toolbar__avatar-image) {
			block-size: 1.55rem;
			inline-size: 1.55rem;
		}
	}
</style>
