<script lang="ts">
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import PlayIcon from '@lucide/svelte/icons/play';
	import StopCircleIcon from '@lucide/svelte/icons/stop-circle';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

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

<div class="runtime-page-toolbar" data-testid="runtime-page-toolbar">
	<div class="runtime-page-toolbar__identity" title={`${title} · ${workspaceLabel}`}>
		<ProfileAvatar label={title} src={sessionIconUrl} class="runtime-page-toolbar__avatar" />
		<div class="runtime-page-toolbar__title">
			<span class="truncate font-semibold">{title}</span>
			<span class="hidden items-center gap-1 text-xs text-muted-foreground lg:inline-flex">
				<FolderTreeIcon class="size-3.5" />
				{workspaceLabel}
			</span>
		</div>
	</div>

	<div class="runtime-page-toolbar__tabs">
		<RuntimeTabBar
			{sessionId}
			{activeTab}
			{tabs}
			class="min-w-0"
			listClass="rounded-full border border-border/60 bg-background/70 p-1"
			triggerClass="h-7 rounded-full px-3 text-xs"
		/>
	</div>

	<div class="runtime-page-toolbar__actions">
		<Badge variant="outline" class="hidden rounded-full bg-background/70 md:inline-flex">
			{statusLabel}
		</Badge>
		{#if unreadCount > 0}
			<Badge variant="secondary" class="hidden rounded-full lg:inline-flex">{unreadCount} unread</Badge>
		{/if}
		<Button size="sm" variant={isRunning ? 'destructive' : 'default'} class="rounded-full" onclick={() => void onToggleRuntime()}>
			{#if isRunning}
				<StopCircleIcon class="size-4" />
				Stop
			{:else}
				<PlayIcon class="size-4" />
				Start
			{/if}
		</Button>
	</div>
</div>

<style>
	.runtime-page-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) auto;
		align-items: center;
		gap: 0.75rem;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		padding-inline: 0.75rem;
	}

	.runtime-page-toolbar__identity,
	.runtime-page-toolbar__tabs,
	.runtime-page-toolbar__actions {
		min-inline-size: 0;
	}

	.runtime-page-toolbar__identity {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		overflow: hidden;
	}

	:global(.runtime-page-toolbar__avatar) {
		block-size: 1.75rem;
		inline-size: 1.75rem;
		border-radius: 0.8rem;
		border-color: color-mix(in srgb, var(--border), transparent 20%);
		background: color-mix(in srgb, var(--background), transparent 12%);
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--background), white 78%);
	}

	.runtime-page-toolbar__title {
		display: flex;
		min-inline-size: 0;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		line-height: 1.1;
	}

	.runtime-page-toolbar__tabs {
		display: flex;
		align-items: center;
	}

	.runtime-page-toolbar__actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.45rem;
	}

	@container workbench-page-toolbar (max-width: 56rem) {
		.runtime-page-toolbar {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.runtime-page-toolbar__tabs {
			grid-column: 1 / span 2;
			grid-row: 2;
		}
	}

	@container workbench-page-toolbar (max-width: 42rem) {
		.runtime-page-toolbar__identity {
			gap: 0.45rem;
		}

		.runtime-page-toolbar__title {
			font-size: 0.78rem;
		}
	}
</style>
