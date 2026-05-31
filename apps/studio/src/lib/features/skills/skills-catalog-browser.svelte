<script lang="ts">
	import { getAppControllerContext } from '$lib/app/controller-context';

	import {
		toSkillCatalogTransportRootKind,
		type SkillCatalogSurfaceRootKind,
		type SkillBrowserSection,
	} from './skill-browser-state';
	import SkillsSkillBrowser from './skills-skill-browser.svelte';

	type CatalogState = {
		loaded: boolean;
		loading: boolean;
		error: string | null;
		items: Awaited<ReturnType<ReturnType<typeof getAppControllerContext>['runtimeStore']['listSkillCatalog']>>['items'];
	};

	const createCatalogState = (): CatalogState => ({
		loaded: false,
		loading: false,
		error: null,
		items: [],
	});

	let {
		rootKind,
	}: {
		rootKind: SkillCatalogSurfaceRootKind;
	} = $props();

	const controller = getAppControllerContext();
	let catalogByRootKind = $state({
		'skills-home': createCatalogState(),
		'built-in': createCatalogState(),
	});

	const catalogState = $derived(catalogByRootKind[rootKind]);
	const browserTitle = $derived(rootKind === 'built-in' ? 'Built-in skills' : 'SKILLS_HOME skills');
	const browserDescription = $derived(
		rootKind === 'built-in'
			? 'Read-only view over shipped skills. Expand one skill to inspect its objective file tree.'
			: 'Read-only view over visible skills from the current SKILLS_HOME source order. Expand one skill to inspect its objective file tree.',
	);
	const sections = $derived([
		{
			id: rootKind,
			title: browserTitle,
			description: browserDescription,
			skills: catalogState.items,
		},
	] satisfies SkillBrowserSection[]);

	$effect(() => {
		const state = catalogByRootKind[rootKind];
		if (state.loaded || state.loading) {
			return;
		}
		catalogByRootKind = {
			...catalogByRootKind,
			[rootKind]: {
				...state,
				loading: true,
				error: null,
			},
		};
		void controller.runtimeStore
			.listSkillCatalog({
				rootKind: toSkillCatalogTransportRootKind(rootKind),
			})
			.then((output) => {
				catalogByRootKind = {
					...catalogByRootKind,
					[rootKind]: {
						loaded: true,
						loading: false,
						error: null,
						items: output.items,
					},
				};
			})
			.catch((error) => {
				catalogByRootKind = {
					...catalogByRootKind,
					[rootKind]: {
						loaded: true,
						loading: false,
						error: error instanceof Error ? error.message : 'Failed to load skills.',
						items: [],
					},
				};
			});
	});
</script>

<SkillsSkillBrowser
	title={browserTitle}
	description={catalogState.error ?? browserDescription}
	{sections}
	detailRatioPersistence={`skills:${rootKind}:detail`}
	loadTree={({ skill, path, offset }) =>
		controller.runtimeStore.listSkillCatalogTree({
			rootKind: toSkillCatalogTransportRootKind(rootKind),
			name: skill.name,
			path,
			offset,
		})}
	loadPreview={({ skill, path }) =>
		controller.runtimeStore.readSkillCatalogPreview({
			rootKind: toSkillCatalogTransportRootKind(rootKind),
			name: skill.name,
			path,
		})}
/>
