<script lang="ts">
	import BotIcon from '@lucide/svelte/icons/bot';
	import FolderRootIcon from '@lucide/svelte/icons/folder-root';
	import LayoutListIcon from '@lucide/svelte/icons/layout-list';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import SearchIcon from '@lucide/svelte/icons/search';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import WorkbenchPageTabs from './workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from './workbench-page-tabs.types';
	import WorkbenchToolbarAction from './workbench-toolbar-action.svelte';
	import WorkbenchToolbarStatus from './workbench-toolbar-status.svelte';
	import WorkbenchToolbarToggle from './workbench-toolbar-toggle.svelte';
	import WorkbenchToolbar from './workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from './workbench-toolbar.types';
	import { cn } from '$lib/utils.js';

	let {
		variant = 'page-tabs',
		frameWidth = '72rem',
	}: {
		variant?: 'page-tabs' | 'page-tabs-actions-only' | 'page-tabs-minimal' | 'identity';
		frameWidth?: string;
	} = $props();

	let activePageTab = $state<'chat' | 'assets'>('chat');
	let searchQuery = $state('');
	let compactMode = $state(false);

	const demoTabs = [
		{ value: 'chat', label: 'Chat' },
		{ value: 'assets', label: 'Assets' },
	] as const satisfies WorkbenchPageTabItem[];
</script>

{#snippet demoPageTabs(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchPageTabs
		ariaLabel="Demo page sections"
		value={activePageTab}
		items={demoTabs}
		{toolbarState}
		onValueChange={(value) => {
			activePageTab = value as 'chat' | 'assets';
		}}
	/>
{/snippet}

{#snippet pageTabsIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<div class="grid size-7 place-items-center rounded-full border border-border/60 bg-background/70">
		<BotIcon class="size-4" />
	</div>
{/snippet}

{#snippet pageTabsIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">Reviewer runtime</span>
{/snippet}

{#snippet pageTabsIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">workspace-alpha</span>
{/snippet}

{#snippet pageTabsStatus(toolbarState: WorkbenchToolbarRenderState)}
	<div class={cn('flex flex-wrap items-center gap-1', toolbarState.placement === 'overflow' ? 'justify-start' : 'justify-end')}>
		<WorkbenchToolbarStatus placement={toolbarState.placement} label="Running" title="Running" tone="positive" caps />
		<WorkbenchToolbarStatus placement={toolbarState.placement} label="2 unread" title="2 unread" tone="accent" />
	</div>
{/snippet}

{#snippet pageTabsActions(toolbarState: WorkbenchToolbarRenderState)}
	<div class={cn('flex items-center gap-1', toolbarState.placement === 'overflow' && 'grid gap-2')}>
		<WorkbenchToolbarAction
			placement={toolbarState.placement}
			label="Search transcript"
			title="Search transcript"
			type="button"
		>
			<SearchIcon class="size-4" />
		</WorkbenchToolbarAction>
		<WorkbenchToolbarAction
			placement={toolbarState.placement}
			label="Open detail panel"
			title="Open detail panel"
			inlineTone="active"
			overflowVariant="default"
			type="button"
		>
			<PanelRightOpenIcon class="size-4" />
		</WorkbenchToolbarAction>
		{#if toolbarState.placement === 'overflow'}
			{#each Array.from({ length: 24 }, (_, index) => index + 1) as actionId}
				<Button type="button" variant="outline" size="sm" class="w-auto self-start justify-self-start justify-start rounded-full">
					<span>Overflow action {actionId}</span>
				</Button>
			{/each}
		{/if}
	</div>
{/snippet}

{#snippet identityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<div class="grid size-7 place-items-center rounded-full border border-border/60 bg-background/70">
		<FolderRootIcon class="size-4 text-muted-foreground" />
	</div>
{/snippet}

{#snippet identityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">Workspace roots</span>
{/snippet}

{#snippet identitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">Choose one durable workspace root and open its dedicated detail surface.</span>
{/snippet}

{#snippet identityStatus(toolbarState: WorkbenchToolbarRenderState)}
	<div class={cn('flex flex-wrap items-center gap-1', toolbarState.placement === 'overflow' ? 'justify-start' : 'justify-end')}>
		<WorkbenchToolbarStatus placement={toolbarState.placement} label="12 roots" title="12 roots" />
		<WorkbenchToolbarStatus placement={toolbarState.placement} label="@reviewer" title="Avatar filter: reviewer" tone="accent" />
	</div>
{/snippet}

{#snippet identityActions(toolbarState: WorkbenchToolbarRenderState)}
	<div class={cn('flex min-w-0 items-center gap-1', toolbarState.placement === 'overflow' && 'grid gap-2')}>
		<WorkbenchToolbarToggle
			placement={toolbarState.placement}
			label="Compact view"
			title={compactMode ? 'Switch to comfortable view' : 'Switch to compact view'}
			pressed={compactMode}
			inlineTone="active"
			onPressedChange={(pressed) => {
				compactMode = pressed;
			}}
		>
			<LayoutListIcon class="size-4" />
		</WorkbenchToolbarToggle>
		<div
			class={cn(
				'flex min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5',
				toolbarState.placement === 'overflow' ? 'h-9 rounded-xl px-3' : 'h-6 gap-1 px-1.5',
			)}
		>
			<SearchIcon class="size-3.5 shrink-0 text-muted-foreground" />
			<Input
				bind:value={searchQuery}
				class={cn(
					'h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0',
					toolbarState.placement === 'overflow'
						? 'w-full min-w-[14rem] text-sm'
						: 'w-20 text-[11px] sm:w-32 md:w-44 md:text-xs',
				)}
				placeholder="Search roots"
			/>
		</div>
	</div>
{/snippet}

<div class="p-4" style={`inline-size: ${frameWidth};`}>
	<div class="grid w-full gap-0" data-testid="workbench-toolbar-story-shell">
		<div
			class="h-12 rounded-t-[1.35rem] border-x border-t border-border/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_14%)_0%,color-mix(in_srgb,var(--card),white_5%)_58%,color-mix(in_srgb,var(--background),transparent_8%)_100%)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_56%),0_22px_44px_-40px_color-mix(in_srgb,var(--foreground),transparent_16%)]"
			data-workbench-page-toolbar
		>
			{#if variant === 'page-tabs'}
				<WorkbenchToolbar
					pageTabs={demoPageTabs}
					identityLeading={pageTabsIdentityLeading}
					identityTitle={pageTabsIdentityTitle}
					identitySubtitle={pageTabsIdentitySubtitle}
					status={pageTabsStatus}
					actions={pageTabsActions}
					overflowLabel="Open page toolbar details"
				/>
			{:else if variant === 'page-tabs-actions-only'}
				<WorkbenchToolbar
					pageTabs={demoPageTabs}
					identityLeading={pageTabsIdentityLeading}
					identityTitle={pageTabsIdentityTitle}
					actions={pageTabsActions}
					overflowLabel="Open page toolbar details"
				/>
			{:else if variant === 'page-tabs-minimal'}
				<WorkbenchToolbar
					pageTabs={demoPageTabs}
					identityLeading={pageTabsIdentityLeading}
					identityTitle={pageTabsIdentityTitle}
					overflowLabel="Open page toolbar details"
				/>
			{:else}
				<WorkbenchToolbar
					identityLeading={identityLeading}
					identityTitle={identityTitle}
					identitySubtitle={identitySubtitle}
					status={identityStatus}
					actions={identityActions}
					overflowLabel="Open workspace toolbar details"
				/>
			{/if}
		</div>

		<div
			class="min-h-[20rem] rounded-b-[1.35rem] border border-border/65 border-t-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,var(--card)_16%,color-mix(in_srgb,var(--background),var(--card)_42%)_100%)] p-6"
			data-testid="workbench-toolbar-story-body"
		>
			<div class="grid gap-2 rounded-[1rem] border border-dashed border-border/70 bg-background/55 p-5 text-sm text-muted-foreground">
				<div class="font-medium text-foreground">Page content stays URL-driven.</div>
				<p>The toolbar overflow is anchored over this body and must not push the page layout downward.</p>
			</div>
		</div>
	</div>
</div>
