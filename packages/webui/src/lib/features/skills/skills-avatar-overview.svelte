<script lang="ts">
	import BotIcon from '@lucide/svelte/icons/bot';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { ScrollView } from '@agenter/svelte-components';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import { cn } from '$lib/utils.js';

	type AvatarCatalogState = Awaited<
		ReturnType<ReturnType<typeof getAppControllerContext>['runtimeStore']['listSkillAvatarCatalog']>
	>['items'];

	let {
		selectedAvatarNickname = $bindable(''),
		onOpenAvatar,
	}: {
		selectedAvatarNickname?: string;
		onOpenAvatar: (nickname: string) => void | Promise<void>;
	} = $props();

	const controller = getAppControllerContext();
	let avatarItems = $state<AvatarCatalogState>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let detailCompact = $state(false);
	let detailOpen = $state(true);

	const selectedEntry = $derived(
		avatarItems.find((entry) => entry.nickname === selectedAvatarNickname) ?? avatarItems[0] ?? null,
	);

	$effect(() => {
		if (loading || avatarItems.length > 0 || error) {
			return;
		}
		loading = true;
		void controller.runtimeStore
			.listSkillAvatarCatalog()
			.then((output) => {
				avatarItems = output.items;
			})
			.catch((reason) => {
				error = reason instanceof Error ? reason.message : 'Failed to load avatar skills.';
			})
			.finally(() => {
				loading = false;
			});
	});

	$effect(() => {
		if (!selectedEntry) {
			return;
		}
		if (selectedAvatarNickname !== selectedEntry.nickname) {
			selectedAvatarNickname = selectedEntry.nickname;
		}
	});

	const selectAvatar = (nickname: string): void => {
		selectedAvatarNickname = nickname;
		detailOpen = true;
	};
</script>

<div class="h-full min-w-0" data-testid="skills-avatar-overview">
	<WorkbenchPageContent
		class="h-full min-w-0"
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		mainClass="h-full"
		drawerClass="h-full"
		detailRatioPersistence="skills:avatar:detail"
		detailLeftMin={280}
		detailRightMin={360}
		detailDefaultRatio={0.36}
	>
		{#snippet main()}
			<div class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)]">
				<div class="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-3.5 md:px-5">
					<div class="grid gap-1">
						<div class="flex items-center gap-2">
							<BotIcon class="size-4 text-muted-foreground" />
							<h2 class="text-sm font-semibold">Avatar skills</h2>
						</div>
						<p class="max-w-3xl text-sm leading-6 text-muted-foreground">
							Choose one avatar, inspect its workspace-grouped avatar-private skill roots, then open a dedicated avatar tab for full file browsing.
						</p>
					</div>
					{#if detailCompact && selectedEntry}
						<Button variant="outline" size="sm" onclick={() => (detailOpen = true)}>
							<PanelRightOpenIcon class="size-4" />
							Open detail
						</Button>
					{/if}
				</div>

				<ScrollView class="h-full" contentClass="grid gap-0 border-y border-border/50">
					{#if loading}
						<div class="px-4 py-6 text-sm text-muted-foreground">Loading avatar catalog…</div>
					{:else if error}
						<div class="px-4 py-6">
							<NoticeBanner tone="warning" message={error} />
						</div>
					{:else if avatarItems.length === 0}
						<div class="px-4 py-6">
							<NoticeBanner tone="info" message="No avatars exposed any visible skill groups." />
						</div>
					{:else}
						{#each avatarItems as entry (entry.nickname)}
							{@const isSelected = selectedEntry?.nickname === entry.nickname}
							<button
								type="button"
								class={cn(
									'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/45 px-3 py-3 text-left transition-colors last:border-b-0 md:px-4 md:py-3.5',
									isSelected ? 'bg-accent/45' : 'hover:bg-muted/22',
								)}
								aria-pressed={isSelected}
								onclick={() => {
									selectAvatar(entry.nickname);
								}}
							>
								<ProfileAvatar
									label={entry.displayName ?? entry.nickname}
									src={entry.iconUrl}
									class="size-9 rounded-xl border-border/65 bg-background/70"
								/>
								<div class="grid min-w-0 gap-0.5">
									<div class="truncate text-sm font-semibold">{entry.displayName ?? entry.nickname}</div>
									<div class="truncate text-[11px] leading-5 text-muted-foreground">@{entry.nickname}</div>
								</div>
								<div class="flex items-center gap-2">
									<Badge variant="outline">{entry.groups.length} workspaces</Badge>
								</div>
							</button>
						{/each}
					{/if}
				</ScrollView>
			</div>
		{/snippet}

		{#snippet drawer()}
			<WorkbenchDetailDrawer
				title={selectedEntry ? `${selectedEntry.displayName ?? selectedEntry.nickname}` : 'Avatar preview'}
				description="Preview visible workspace-grouped skills before opening a dedicated tab."
			>
				{#snippet summary()}
					{#if selectedEntry}
						<div>Avatar: @{selectedEntry.nickname}</div>
						<div>Runtime: {selectedEntry.runtimeId}</div>
						<div>Groups: {selectedEntry.groups.length}</div>
					{:else}
						<div>Select one avatar to inspect its visible skill groups.</div>
					{/if}
				{/snippet}

				{#if !selectedEntry}
					<NoticeBanner tone="info" message="Select one avatar to inspect its skill groups." />
				{:else}
					<div class="grid gap-4">
						<div class="flex items-center justify-between gap-3">
							<div class="grid gap-1">
								<div class="text-sm font-semibold">Workspace groups</div>
								<div class="text-sm text-muted-foreground">
									Root workspace stays first. Extra groups only appear when avatar-private skills exist.
								</div>
							</div>
							<Button
								size="sm"
								onclick={() => {
									void onOpenAvatar(selectedEntry.nickname);
								}}
							>
								<PlusIcon class="size-4" />
								Open avatar tab
							</Button>
						</div>

						{#each selectedEntry.groups as group (group.workspacePath)}
							<div class="rounded-[0.95rem] border border-border/60 bg-background/70 p-3">
								<div class="flex flex-wrap items-center gap-2">
									<div class="text-sm font-semibold">{group.workspaceLabel}</div>
									<Badge variant="outline">{group.skills.length} skills</Badge>
								</div>
								<div class="mt-1 break-all text-xs leading-5 text-muted-foreground">
									{group.workspaceDescription}
								</div>
								{#if group.skills.length === 0}
									<div class="mt-3 text-sm text-muted-foreground">No avatar-private skills are visible here.</div>
								{:else}
									<div class="mt-3 flex flex-wrap gap-2">
										{#each group.skills as skill (skill.name)}
											<Badge variant="secondary">{skill.name}</Badge>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</div>
