<script lang="ts">
	import BotIcon from '@lucide/svelte/icons/bot';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';

	import type { SkillBrowserSection } from './skill-browser-state';
	import SkillsSkillBrowser from './skills-skill-browser.svelte';

	type AvatarCatalogItem = Awaited<
		ReturnType<ReturnType<typeof getAppControllerContext>['runtimeStore']['listSkillAvatarCatalog']>
	>['items'][number];

	let {
		avatarNickname,
	}: {
		avatarNickname: string;
	} = $props();

	const controller = getAppControllerContext();
	let avatarItems = $state<AvatarCatalogItem[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const selectedEntry = $derived(avatarItems.find((entry) => entry.nickname === avatarNickname) ?? null);
	const sections = $derived(
		(selectedEntry?.groups ?? []).map((group) => ({
			id: group.workspacePath,
			title: group.workspaceLabel,
			description: `${group.workspaceDescription} · ${group.skillsRootPath}`,
			skills: group.skills,
		})) satisfies SkillBrowserSection[],
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
				error = reason instanceof Error ? reason.message : 'Failed to load avatar skill browser.';
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

{#snippet avatarToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<BotIcon class="size-4 text-muted-foreground" />
{/snippet}

{#snippet avatarToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">@{avatarNickname}</span>
{/snippet}

{#snippet avatarToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">Workspace-grouped avatar skill browser</span>
{/snippet}

{#snippet avatarToolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	{#if selectedEntry}
		<div class:justify-start={toolbarState.placement === 'overflow'} class="flex min-w-0 flex-wrap items-center gap-1">
			<WorkbenchToolbarStatus
				placement={toolbarState.placement}
				label={`${selectedEntry.groups.length} groups`}
				title={`${selectedEntry.groups.length} visible workspace groups`}
			/>
		</div>
	{/if}
{/snippet}

<WorkbenchPageToolbar>
	<WorkbenchToolbar
		identityLeading={avatarToolbarIdentityLeading}
		identityTitle={avatarToolbarIdentityTitle}
		identitySubtitle={avatarToolbarIdentitySubtitle}
		status={avatarToolbarStatus}
		overflowLabel="Open avatar toolbar details"
	/>
</WorkbenchPageToolbar>

{#if loading}
	<div class="px-4 py-6 text-sm text-muted-foreground">Loading avatar skill browser…</div>
{:else if error}
	<div class="px-4 py-6">
		<NoticeBanner tone="warning" message={error} />
	</div>
{:else if !selectedEntry}
	<div class="px-4 py-6">
		<NoticeBanner tone="warning" message={`Avatar @${avatarNickname} did not expose any visible skill groups.`} />
	</div>
{:else}
	<SkillsSkillBrowser
		title={`${selectedEntry.displayName ?? selectedEntry.nickname} skills`}
		description="Read-only avatar skill browser grouped by workspace."
		{sections}
		detailRatioPersistence={`skills:avatar:${selectedEntry.nickname}:detail`}
		loadTree={({ sectionId, skill, path, offset }) =>
			controller.runtimeStore.listSkillAvatarTree({
				avatarNickname: selectedEntry.nickname,
				workspacePath: sectionId,
				name: skill.name,
				path,
				offset,
			})}
		loadPreview={({ sectionId, skill, path }) =>
			controller.runtimeStore.readSkillAvatarPreview({
				avatarNickname: selectedEntry.nickname,
				workspacePath: sectionId,
				name: skill.name,
				path,
			})}
	/>
{/if}
