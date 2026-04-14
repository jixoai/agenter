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
			<span class="runtime-page-toolbar__workspace text-xs text-muted-foreground">
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
			triggerClass="h-6 rounded-full px-2.5 text-[11px] md:h-7 md:px-3 md:text-xs"
		/>
	</div>

	<div class="runtime-page-toolbar__actions">
		<Badge variant="outline" class="hidden rounded-full bg-background/70 md:inline-flex">
			{statusLabel}
		</Badge>
		{#if unreadCount > 0}
			<Badge variant="secondary" class="hidden rounded-full lg:inline-flex">{unreadCount} unread</Badge>
		{/if}
		<Button
			size="sm"
			variant={isRunning ? 'destructive' : 'default'}
			class="rounded-full"
			aria-label={isRunning ? 'Stop' : 'Start'}
			title={isRunning ? 'Stop' : 'Start'}
			onclick={() => void onToggleRuntime()}
		>
			{#if isRunning}
				<StopCircleIcon class="size-4" />
				<span class="runtime-page-toolbar__action-label">Stop</span>
			{:else}
				<PlayIcon class="size-4" />
				<span class="runtime-page-toolbar__action-label">Start</span>
			{/if}
		</Button>
	</div>
</div>

<style>
	.runtime-page-toolbar {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		padding-inline: 0.6rem;
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
		max-inline-size: 11rem;
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
		display: none;
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

		.runtime-page-toolbar__workspace {
			display: inline-flex;
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

		.runtime-page-toolbar__action-label {
			display: none;
		}
	}
</style>
