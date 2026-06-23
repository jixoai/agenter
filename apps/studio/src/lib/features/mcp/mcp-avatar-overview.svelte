<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import NetworkIcon from '@lucide/svelte/icons/network';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { resolveAvatarHandle } from '$lib/features/avatars/avatar-identity-presentation';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import { cn } from '$lib/utils.js';

	import McpSkeletons from './mcp-skeletons.svelte';
	import {
		countDistinctMcpProjects,
		countFailedMcpRows,
		countRunningMcpRows,
		type McpConfigCatalogRow,
		type McpWorkbenchRow,
	} from './mcp-workbench-state';

	interface McpAvatarOverviewEntry {
		nickname: string;
		label: string;
		principalId: string;
		iconUrl?: string | null;
	}

	let {
		avatars,
		selectedAvatarNickname = $bindable(''),
		configRowsByAvatar,
		projectRowsByAvatar,
		loading = false,
		onOpenConfig,
		onOpenProject,
	}: {
		avatars: readonly McpAvatarOverviewEntry[];
		selectedAvatarNickname?: string;
		configRowsByAvatar: ReadonlyMap<string, readonly McpConfigCatalogRow[]>;
		projectRowsByAvatar: ReadonlyMap<string, readonly McpWorkbenchRow[]>;
		loading?: boolean;
		onOpenConfig?: (row: McpConfigCatalogRow) => void;
		onOpenProject?: (avatarNickname: string, row: McpWorkbenchRow) => void;
	} = $props();

	let detailCompact = $state(false);
	let detailOpen = $state(true);

	const selectedAvatar = $derived(
		avatars.find((avatar) => avatar.nickname === selectedAvatarNickname) ?? avatars[0] ?? null,
	);
	const selectedConfigRows = $derived(
		selectedAvatar ? configRowsByAvatar.get(selectedAvatar.nickname) ?? [] : ([] as readonly McpConfigCatalogRow[]),
	);
	const selectedProjectRows = $derived(
		selectedAvatar ? projectRowsByAvatar.get(selectedAvatar.nickname) ?? [] : ([] as readonly McpWorkbenchRow[]),
	);
	const loadingWithoutData = $derived(loading && avatars.length === 0);
	const refreshingWithData = $derived(loading && avatars.length > 0);

	$effect(() => {
		if (!selectedAvatar && avatars[0]) {
			selectedAvatarNickname = avatars[0].nickname;
			return;
		}
		if (selectedAvatar && selectedAvatarNickname !== selectedAvatar.nickname) {
			selectedAvatarNickname = selectedAvatar.nickname;
		}
	});
</script>

<div class="h-full min-w-0" data-testid="mcp-avatar-overview">
	<WorkbenchPageContent
		class="h-full min-w-0"
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		mainClass="h-full"
		drawerClass="h-full"
		detailRatioPersistence="mcp:avatar:detail"
		detailLeftMin={300}
		detailRightMin={360}
		detailDefaultRatio={0.4}
	>
		{#snippet main()}
			<div class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)]">
				<div class="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-3.5 md:px-5">
					<div class="flex items-center gap-2">
						<NetworkIcon class="size-4 text-muted-foreground" />
						<h2 class="text-sm font-semibold">Avatar ownership</h2>
					</div>
					{#if refreshingWithData}
						<div
							class="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/72 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
							data-testid="mcp-avatar-overview-refreshing"
						>
							<span class="size-1.5 rounded-full bg-amber-500"></span>
							Refreshing
						</div>
					{/if}
					{#if detailCompact && selectedAvatar}
						<Button variant="outline" size="sm" onclick={() => (detailOpen = true)}>
							<PanelRightOpenIcon class="size-4" />
							Open detail
						</Button>
					{/if}
				</div>

				<ScrollView class="h-full" contentClass="grid gap-0">
					{#if loadingWithoutData}
						<McpSkeletons rows={4} variant="avatar-list" data-testid="mcp-avatar-list-skeleton" />
					{:else}
						{#each avatars as avatar (avatar.nickname)}
							{@const isSelected = selectedAvatar?.nickname === avatar.nickname}
							{@const avatarConfigRows = configRowsByAvatar.get(avatar.nickname) ?? []}
							{@const avatarProjectRows = projectRowsByAvatar.get(avatar.nickname) ?? []}
							<button
								type="button"
								class={cn(
									'grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-border/45 px-3 py-3 text-left transition-colors last:border-b-0 md:px-4',
									isSelected ? 'bg-accent/45' : 'hover:bg-muted/22',
								)}
								aria-pressed={isSelected}
								onclick={() => {
									selectedAvatarNickname = avatar.nickname;
									detailOpen = true;
								}}
							>
								<div data-testid={`mcp-avatar-profile-${avatar.nickname}`}>
									<ProfileAvatar label={avatar.label} src={avatar.iconUrl ?? null} class="size-10 rounded-xl" />
								</div>
								<div class="grid min-w-0 gap-1">
									<div class="truncate text-sm font-semibold">{avatar.label}</div>
									<div class="truncate text-[11px] leading-5 text-muted-foreground">
										{resolveAvatarHandle(avatar)}
									</div>
									<div class="flex min-w-0 flex-wrap items-center gap-1.5">
										<Badge variant="outline">{avatarConfigRows.length} configs</Badge>
										<Badge variant="secondary">{countDistinctMcpProjects(avatarProjectRows)} projects</Badge>
										<Badge variant={countRunningMcpRows(avatarProjectRows) > 0 ? 'outline' : 'secondary'}>
											{countRunningMcpRows(avatarProjectRows)} running
										</Badge>
										{#if countFailedMcpRows(avatarProjectRows) > 0}
											<Badge variant="destructive">{countFailedMcpRows(avatarProjectRows)} failed</Badge>
										{/if}
									</div>
								</div>
							</button>
						{/each}
					{/if}
				</ScrollView>
			</div>
		{/snippet}

		{#snippet drawer()}
			<WorkbenchDetailDrawer
				title={selectedAvatar ? selectedAvatar.label : 'Avatar detail'}
				data-testid="mcp-avatar-detail"
			>
				{#snippet titleAccessory()}
					{#if selectedAvatar}
						<div data-testid="mcp-avatar-detail-profile">
							<ProfileAvatar label={selectedAvatar.label} src={selectedAvatar.iconUrl ?? null} class="size-8 rounded-xl" />
						</div>
					{/if}
				{/snippet}

				{#snippet summary()}
					{#if selectedAvatar}
						<div>Handle: {resolveAvatarHandle(selectedAvatar)}</div>
						<div>Configs: {selectedConfigRows.length}</div>
						<div>Projects: {countDistinctMcpProjects(selectedProjectRows)}</div>
					{:else}
						<div>Select one Avatar.</div>
					{/if}
				{/snippet}

				{#if loadingWithoutData && !selectedAvatar}
					<McpSkeletons rows={1} variant="detail" data-testid="mcp-avatar-detail-skeleton" />
				{:else if !selectedAvatar}
					<div class="text-sm text-muted-foreground">Select one Avatar to inspect its MCP ownership.</div>
				{:else}
					<section class="grid gap-3">
						<div class="flex items-center justify-between gap-3">
							<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Configs</div>
							<Badge variant="outline">{selectedConfigRows.length}</Badge>
						</div>
						{#if selectedConfigRows.length === 0}
							<div class="text-sm text-muted-foreground">No MCP configs under this Avatar.</div>
						{:else}
							<div class="divide-y divide-border/45">
								{#each selectedConfigRows as row (row.name)}
									<button
										type="button"
										class="grid w-full gap-1 rounded-md py-2 text-left transition-colors hover:bg-muted/22"
										onclick={() => onOpenConfig?.(row)}
									>
										<div class="flex min-w-0 flex-wrap items-center gap-1.5">
											<div class="truncate text-sm font-semibold">{row.title}</div>
											<Badge variant="outline">{row.name}</Badge>
											<Badge variant="secondary">{row.transport}</Badge>
										</div>
										<div class="truncate text-xs text-muted-foreground">
											{row.enabledProjectCount} enabled · {row.runningInstanceCount} running · {row.failedInstanceCount} failed
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</section>

					<section class="grid gap-3">
						<div class="flex items-center justify-between gap-3">
							<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Instances</div>
							<Badge variant="outline">{selectedProjectRows.length}</Badge>
						</div>
						{#if selectedProjectRows.length === 0}
							<div class="text-sm text-muted-foreground">No exact-project rows under this Avatar.</div>
						{:else}
							<div class="divide-y divide-border/45">
								{#each selectedProjectRows as row (`${row.name}:${row.projectPath ?? 'global'}`)}
									<button
										type="button"
										class="grid w-full gap-1 rounded-md py-2 text-left transition-colors hover:bg-muted/22"
										onclick={() => onOpenProject?.(selectedAvatar.nickname, row)}
									>
										<div class="flex min-w-0 flex-wrap items-center gap-1.5">
											<div class="truncate text-sm font-semibold">{row.projectPath ?? 'unknown project'}</div>
											<Badge variant="outline">{row.name}</Badge>
											<Badge variant={row.projectState === 'enabled' ? 'outline' : 'secondary'}>
												{row.projectState === 'enabled' ? 'enabled' : 'disabled'}
											</Badge>
											<Badge variant={row.lifecycle === 'failed' ? 'destructive' : 'secondary'}>
												{row.lifecycle}
											</Badge>
										</div>
										<div class="truncate text-xs text-muted-foreground">
											{row.snapshotAt ? `snapshot ${row.snapshotAt}` : 'no snapshot'} · {row.latestAction.label}
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</section>
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</div>
