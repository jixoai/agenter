<script lang="ts">
	import type { MessageSystemRoomSeatState } from '$lib/features/messages/message-system-surface.types';
	import RoomPageToolbarContent from '$lib/features/messages/room-page-toolbar-content.svelte';
	import RuntimePageToolbarContent from '$lib/features/runtime/runtime-page-toolbar-content.svelte';
	import type { RuntimeTabId, RuntimeTabItem } from '$lib/features/runtime/runtime-shell-state';

	import Harness from './workbench-toolbar.story-harness.svelte';

	const runtimeTabs = [
		{ id: 'heartbeat', label: 'Heartbeat', badgeLabel: '12', badgeTone: 'positive' },
		{ id: 'attention', label: 'Attention', badgeLabel: '3', badgeTone: 'warning' },
		{ id: 'settings', label: 'Settings' },
	] as const satisfies RuntimeTabItem[];

	const roomViewers = [
		{
			actorId: 'auth:reviewer',
			actorKind: 'auth',
			label: 'Reviewer',
			subtitle: 'Primary room viewer',
			iconUrl: null,
			role: 'admin',
			currentAdmin: true,
			online: true,
			focused: true,
			invalidCredential: false,
			trackedByLatestVisible: true,
			hasReadLatestVisible: true,
		},
		{
			actorId: 'auth:observer',
			actorKind: 'auth',
			label: 'Observer',
			subtitle: 'Readonly perspective',
			iconUrl: null,
			role: 'readonly',
			currentAdmin: false,
			online: true,
			focused: false,
			invalidCredential: false,
			trackedByLatestVisible: true,
			hasReadLatestVisible: false,
		},
	] as const satisfies MessageSystemRoomSeatState[];

	let runtimeWideTab = $state<RuntimeTabId>('heartbeat');
	let runtimeNarrowTab = $state<RuntimeTabId>('heartbeat');
	let runtimeRunning = $state(true);
	let roomMode = $state<'chat' | 'assets'>('chat');
	let selectedViewerActorId = $state<string>(roomViewers[0].actorId);

	const selectedViewer = $derived(
		roomViewers.find((viewer) => viewer.actorId === selectedViewerActorId) ?? roomViewers[0],
	);
	const viewerItems = $derived(
		roomViewers.map((viewer) => ({
			value: viewer.actorId,
			label: viewer.label,
			iconUrl: viewer.iconUrl,
		})),
	);
</script>

<svelte:head>
	<title>Workbench Toolbar Preview</title>
</svelte:head>

<div class="toolbar-preview">
	<header class="toolbar-preview__hero">
		<p class="toolbar-preview__eyebrow">Chrome Page Toolbar Preview</p>
		<h1 class="toolbar-preview__title">Shared page-toolbar law in concrete surfaces</h1>
		<p class="toolbar-preview__copy">
			This page isolates the new toolbar primitive from Storybook and backend routing. Use the narrow cards to click
			the overflow trigger and verify the floating panel behavior directly.
		</p>
	</header>

	<div class="toolbar-preview__grid">
		<section class="toolbar-preview__card">
			<div class="toolbar-preview__meta">
				<h2>Runtime page, wide</h2>
				<p>`page-tabs + identity + status + primary action` stays inline across the two-row grid.</p>
			</div>
			<div class="toolbar-preview__frame" style:inline-size="72rem">
				<div class="toolbar-preview__toolbar">
					<RuntimePageToolbarContent
						sessionId="session-alpha"
						title="Reviewer runtime"
						workspaceLabel="workspace-alpha"
						statusLabel={runtimeRunning ? 'Running' : 'Stopped'}
						unreadCount={3}
						sessionIconUrl={null}
						activeTab={runtimeWideTab}
						tabs={runtimeTabs}
						isRunning={runtimeRunning}
						onToggleRuntime={() => {
							runtimeRunning = !runtimeRunning;
						}}
					/>
				</div>
				<div class="toolbar-preview__body">
					URL-driven body content remains below the toolbar surface.
				</div>
			</div>
		</section>

		<section class="toolbar-preview__card">
			<div class="toolbar-preview__meta">
				<h2>Runtime page, narrow</h2>
				<p>At narrow width the anchor remains the `page-tabs`, while secondary content moves behind overflow.</p>
			</div>
			<div class="toolbar-preview__frame" style:inline-size="31rem">
				<div class="toolbar-preview__toolbar">
					<RuntimePageToolbarContent
						sessionId="session-alpha"
						title="Reviewer runtime"
						workspaceLabel="workspace-alpha"
						statusLabel={runtimeRunning ? 'Running' : 'Stopped'}
						unreadCount={9}
						sessionIconUrl={null}
						activeTab={runtimeNarrowTab}
						tabs={runtimeTabs}
						isRunning={runtimeRunning}
						onToggleRuntime={() => {
							runtimeRunning = !runtimeRunning;
						}}
					/>
				</div>
				<div class="toolbar-preview__body">Click the overflow trigger to inspect the floated panel state.</div>
			</div>
		</section>

		<section class="toolbar-preview__card">
			<div class="toolbar-preview__meta">
				<h2>Messages page, wide</h2>
				<p>Viewer identity stays beside `page-tabs`, while local actions live on the right side of the grid.</p>
			</div>
			<div class="toolbar-preview__frame" style:inline-size="72rem">
				<div class="toolbar-preview__toolbar">
					<RoomPageToolbarContent
						selectedViewer={selectedViewer}
						{selectedViewerActorId}
						{viewerItems}
						selectedViewerLabel={selectedViewer.label}
						selectedViewerSubtitle={selectedViewer.subtitle}
						canSelectViewer
						activeMode={roomMode}
						canSearch
						actionsDisabled={false}
						onSelectViewer={(actorId) => {
							selectedViewerActorId = actorId;
						}}
						onSelectMode={(mode) => {
							roomMode = mode;
						}}
						onSearchClick={() => undefined}
						onAddUserClick={() => undefined}
						onManageClick={() => undefined}
					/>
				</div>
				<div class="toolbar-preview__body">The body remains independent from the toolbar state machine.</div>
			</div>
		</section>

		<section class="toolbar-preview__card">
			<div class="toolbar-preview__meta">
				<h2>Messages page, compact</h2>
				<p>
					When a `page-tabs` page has identity and actions but no status, the actions should remain inline instead of
					collapsing behind overflow too early.
				</p>
			</div>
			<div class="toolbar-preview__frame" style:inline-size="52rem">
				<div class="toolbar-preview__toolbar">
					<RoomPageToolbarContent
						selectedViewer={selectedViewer}
						{selectedViewerActorId}
						{viewerItems}
						selectedViewerLabel={selectedViewer.label}
						selectedViewerSubtitle={selectedViewer.subtitle}
						canSelectViewer
						activeMode={roomMode}
						canSearch
						actionsDisabled={false}
						onSelectViewer={(actorId) => {
							selectedViewerActorId = actorId;
						}}
						onSelectMode={(mode) => {
							roomMode = mode;
						}}
						onSearchClick={() => undefined}
						onAddUserClick={() => undefined}
						onManageClick={() => undefined}
					/>
				</div>
				<div class="toolbar-preview__body">Compact room chrome should still keep the local actions visible.</div>
			</div>
		</section>

		<section class="toolbar-preview__card">
			<div class="toolbar-preview__meta">
				<h2>Identity anchor law</h2>
				<p>When a page has no `page-tabs`, the identity block stays inline and only actions or status collapse.</p>
			</div>
			<Harness variant="identity" frameWidth="33rem" />
		</section>
	</div>
</div>

<style>
	.toolbar-preview {
		min-block-size: 100vh;
		padding: 2rem;
		background:
			radial-gradient(circle at top, color-mix(in srgb, var(--primary), transparent 88%), transparent 42%),
			linear-gradient(180deg, color-mix(in srgb, var(--background), white 14%) 0%, var(--background) 100%);
		color: var(--foreground);
	}

	.toolbar-preview__hero {
		display: grid;
		gap: 0.55rem;
		max-inline-size: 54rem;
		margin-block-end: 1.5rem;
	}

	.toolbar-preview__eyebrow {
		color: var(--muted-foreground);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.toolbar-preview__title {
		font-size: clamp(1.8rem, 3vw, 2.4rem);
		line-height: 1.05;
	}

	.toolbar-preview__copy {
		max-inline-size: 46rem;
		color: var(--muted-foreground);
		line-height: 1.6;
	}

	.toolbar-preview__grid {
		display: grid;
		gap: 1.25rem;
	}

	.toolbar-preview__card {
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--border), transparent 18%);
		border-radius: 1.4rem;
		background: color-mix(in srgb, var(--card), transparent 2%);
		box-shadow: 0 22px 50px -36px color-mix(in srgb, var(--foreground), transparent 78%);
		overflow: auto;
	}

	.toolbar-preview__meta {
		display: grid;
		gap: 0.3rem;
	}

	.toolbar-preview__meta h2 {
		font-size: 1rem;
		font-weight: 600;
	}

	.toolbar-preview__meta p {
		color: var(--muted-foreground);
		font-size: 0.92rem;
		line-height: 1.5;
	}

	.toolbar-preview__frame {
		display: grid;
		gap: 0;
		max-inline-size: 100%;
	}

	.toolbar-preview__toolbar {
		block-size: 3rem;
		border-top-left-radius: 1.35rem;
		border-top-right-radius: 1.35rem;
		border: 1px solid color-mix(in srgb, var(--border), transparent 14%);
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--card), white 14%) 0%,
				color-mix(in srgb, var(--card), white 5%) 58%,
				color-mix(in srgb, var(--background), transparent 8%) 100%
			);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--background), white 56%),
			0 22px 44px -40px color-mix(in srgb, var(--foreground), transparent 16%);
	}

	.toolbar-preview__body {
		min-block-size: 7rem;
		padding: 1.25rem;
		border: 1px solid color-mix(in srgb, var(--border), transparent 14%);
		border-top: 0;
		border-bottom-left-radius: 1.35rem;
		border-bottom-right-radius: 1.35rem;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--card), white 6%) 0%,
				var(--card) 16%,
				color-mix(in srgb, var(--background), var(--card) 42%) 100%
			);
		color: var(--muted-foreground);
		font-size: 0.92rem;
	}

	@media (max-width: 640px) {
		.toolbar-preview {
			padding: 1rem;
		}
	}
</style>
