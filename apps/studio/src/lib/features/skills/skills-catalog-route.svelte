<script lang="ts">
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';

	import type { SkillCatalogSurfaceRootKind } from './skill-browser-state';
	import SkillsAvatarOverview from './skills-avatar-overview.svelte';
	import SkillsCatalogBrowser from './skills-catalog-browser.svelte';
	import {
		buildSkillAvatarHref,
		buildSkillsCatalogHref,
		readSkillsAvatarNickname,
		readSkillsCatalogView,
		type SkillsCatalogView,
	} from './skills-workbench-location';

	// Page-tabs mirror the durable inheritance law. Reordering them changes both
	// the default route and the user-visible override story, so keep this aligned
	// with runtime skill precedence and the corresponding specs.
	const pageTabs = [
		{ value: 'skills-home', label: 'SKILLS_HOME' },
		{ value: 'built-in', label: 'built-in' },
		{ value: 'avatars', label: 'avatars' },
	] as const satisfies WorkbenchPageTabItem[];

	let selectedAvatarNickname = $state(readSkillsAvatarNickname(page.url.searchParams) ?? '');
	let routeSyncReady = $state(false);

	const activeView = $derived(readSkillsCatalogView(page.url.searchParams));
	const routeAvatarNickname = $derived(readSkillsAvatarNickname(page.url.searchParams));

	$effect(() => {
		if (page.url.pathname !== '/skills') {
			return;
		}
		if (routeAvatarNickname && routeAvatarNickname !== selectedAvatarNickname) {
			selectedAvatarNickname = routeAvatarNickname;
		}
	});

	const syncRoute = (): void => {
		if (!routeSyncReady || page.url.pathname !== '/skills') {
			return;
		}
		const nextHref = buildSkillsCatalogHref({
			view: activeView,
			avatar: selectedAvatarNickname,
		});
		const currentHref = `${page.url.pathname}${page.url.search}`;
		if (nextHref !== currentHref) {
			replaceState(nextHref, page.state);
		}
	};

	$effect(() => {
		syncRoute();
	});

	onMount(() => {
		routeSyncReady = true;
	});

	const handleViewChange = async (value: string): Promise<void> => {
		await goto(
			buildSkillsCatalogHref({
				view: value as SkillsCatalogView,
				avatar: value === 'avatars' ? selectedAvatarNickname : null,
			}),
			{
				keepFocus: true,
				noScroll: true,
			},
		);
	};

	const openAvatarTab = async (avatarNickname: string): Promise<void> => {
		await goto(buildSkillAvatarHref(avatarNickname), {
			keepFocus: true,
			noScroll: true,
		});
	};
</script>

{#snippet skillsToolbarPageTabs(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchPageTabs
		ariaLabel="Skills sections"
		value={activeView}
		items={pageTabs}
		{toolbarState}
		onValueChange={handleViewChange}
	/>
{/snippet}

{#snippet skillsToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<SparklesIcon class="size-4 text-muted-foreground" />
{/snippet}

{#snippet skillsToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">Skills</span>
{/snippet}

{#snippet skillsToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">Read-only browser over SKILLS_HOME, built-in, and avatar-private skill roots.</span>
{/snippet}

<WorkbenchPageToolbar>
	<WorkbenchToolbar
		pageTabs={skillsToolbarPageTabs}
		identityLeading={skillsToolbarIdentityLeading}
		identityTitle={skillsToolbarIdentityTitle}
		identitySubtitle={skillsToolbarIdentitySubtitle}
		overflowLabel="Open skills toolbar details"
	/>
</WorkbenchPageToolbar>

{#if activeView === 'avatars'}
	<SkillsAvatarOverview bind:selectedAvatarNickname onOpenAvatar={openAvatarTab} />
{:else}
	<SkillsCatalogBrowser rootKind={activeView as SkillCatalogSurfaceRootKind} />
{/if}
