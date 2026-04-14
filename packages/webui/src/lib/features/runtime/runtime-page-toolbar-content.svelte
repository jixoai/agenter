<script lang="ts">
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import PlayIcon from '@lucide/svelte/icons/play';
	import StopCircleIcon from '@lucide/svelte/icons/stop-circle';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';

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

	const resolveTabListClass = (toolbarState: WorkbenchToolbarRenderState): string =>
		toolbarState.isNarrow
			? 'rounded-full border border-border/60 bg-background/70 p-0.5'
			: 'rounded-full border border-border/60 bg-background/70 p-1';

const resolveTabTriggerClass = (toolbarState: WorkbenchToolbarRenderState): string =>
	toolbarState.isNarrow
		? 'h-6 rounded-full px-1.5 text-[10px]'
		: 'h-6 rounded-full px-2.5 text-[11px] md:h-7 md:px-3 md:text-xs';
</script>

{#snippet runtimeToolbarContent(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class="runtime-page-toolbar"
		data-testid="runtime-page-toolbar"
		data-toolbar-breakpoint={toolbarState.breakpoint}
	>
		<div class="runtime-page-toolbar__identity" title={`${title} · ${workspaceLabel}`}>
			<ProfileAvatar label={title} src={sessionIconUrl} class="runtime-page-toolbar__avatar" />
			<div class="runtime-page-toolbar__title">
				<span class="truncate font-semibold">{title}</span>
				{#if !toolbarState.isNarrow}
					<span class="runtime-page-toolbar__workspace text-xs text-muted-foreground">
						<FolderTreeIcon class="size-3.5" />
						{workspaceLabel}
					</span>
				{/if}
			</div>
		</div>

		<div class="runtime-page-toolbar__tabs">
			<RuntimeTabBar
				{sessionId}
				{activeTab}
				{tabs}
				class="min-w-0"
				listClass={resolveTabListClass(toolbarState)}
				triggerClass={resolveTabTriggerClass(toolbarState)}
			/>
		</div>

		<div class="runtime-page-toolbar__actions">
			{#if !toolbarState.isNarrow}
				<Badge variant="outline" class="rounded-full bg-background/70 text-[10px] uppercase tracking-[0.14em]">
					{statusLabel}
				</Badge>
			{/if}
			{#if unreadCount > 0 && toolbarState.isWide}
				<Badge variant="secondary" class="rounded-full">{unreadCount} unread</Badge>
			{/if}
			<Button
				size={toolbarState.isNarrow ? 'icon-sm' : 'sm'}
				variant={isRunning ? 'destructive' : 'default'}
				class="rounded-full"
				aria-label={isRunning ? 'Stop runtime' : 'Start runtime'}
				title={isRunning ? 'Stop runtime' : 'Start runtime'}
				onclick={() => void onToggleRuntime()}
			>
				{#if isRunning}
					<StopCircleIcon class="size-4" />
					{#if !toolbarState.isNarrow}
						<span>Stop</span>
					{/if}
				{:else}
					<PlayIcon class="size-4" />
					{#if !toolbarState.isNarrow}
						<span>Start</span>
					{/if}
				{/if}
			</Button>
		</div>
	</div>
{/snippet}

<WorkbenchToolbar content={runtimeToolbarContent} />

<style>
	.runtime-page-toolbar {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		padding-inline: 0.55rem;
	}

	.runtime-page-toolbar__identity,
	.runtime-page-toolbar__tabs,
	.runtime-page-toolbar__actions {
		min-inline-size: 0;
	}

	.runtime-page-toolbar__identity {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex: 0 1 auto;
		max-inline-size: 12rem;
		overflow: hidden;
	}

	:global(.runtime-page-toolbar__avatar) {
		block-size: 1.6rem;
		inline-size: 1.6rem;
		border-radius: 0.8rem;
		border-color: color-mix(in srgb, var(--border), transparent 20%);
		background: color-mix(in srgb, var(--background), transparent 12%);
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--background), white 78%);
	}

	.runtime-page-toolbar__title {
		display: grid;
		min-inline-size: 0;
		gap: 0.12rem;
		font-size: 0.8rem;
		line-height: 1.05;
	}

	.runtime-page-toolbar__workspace {
		display: inline-flex;
		min-inline-size: 0;
		align-items: center;
		gap: 0.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.runtime-page-toolbar__tabs {
		display: flex;
		align-items: center;
		flex: 1 1 auto;
	}

	.runtime-page-toolbar__actions {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: flex-end;
		gap: 0.45rem;
	}

	@container workbench-page-toolbar (min-width: 64rem) {
		.runtime-page-toolbar__identity {
			max-inline-size: 20rem;
		}
	}

	@container workbench-page-toolbar (max-width: 44rem) {
		.runtime-page-toolbar {
			gap: 0.45rem;
			padding-inline: 0.45rem;
		}

		.runtime-page-toolbar__identity {
			max-inline-size: 8.5rem;
		}

		:global(.runtime-page-toolbar__avatar) {
			block-size: 1.45rem;
			inline-size: 1.45rem;
		}

		.runtime-page-toolbar__title {
			font-size: 0.76rem;
		}
	}
</style>
