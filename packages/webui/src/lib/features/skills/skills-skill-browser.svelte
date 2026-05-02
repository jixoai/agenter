<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import { ScrollView } from '@agenter/svelte-components';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import { cn } from '$lib/utils.js';
	import {
		buildSkillTreeRows,
		createSkillBrowserKey,
		formatSkillSize,
		formatSkillTimestamp,
		mergeSkillTreePage,
		type SkillBrowserSection,
		type SkillPreviewRecord,
		type SkillTreePage,
		type SkillTreePages,
	} from './skill-browser-state';
	import SkillFileTree from './skill-file-tree.svelte';
	import SkillPreviewPane from './skill-preview-pane.svelte';

	let {
		title,
		description,
		sections,
		detailRatioPersistence,
		detailLeftMin = 320,
		detailRightMin = 360,
		detailCompactThreshold = undefined,
		loadTree,
		loadPreview,
	}: {
		title: string;
		description: string;
		sections: SkillBrowserSection[];
		detailRatioPersistence: string;
		detailLeftMin?: number;
		detailRightMin?: number;
		detailCompactThreshold?: number;
		loadTree: (input: {
			sectionId: string;
			skill: SkillBrowserSection['skills'][number];
			path?: string;
			offset?: number;
		}) => Promise<SkillTreePage>;
		loadPreview: (input: {
			sectionId: string;
			skill: SkillBrowserSection['skills'][number];
			path: string;
		}) => Promise<SkillPreviewRecord>;
	} = $props();

	let detailCompact = $state(false);
	let detailOpen = $state(false);
	let expandedSkillKeys = $state<string[]>([]);
	let expandedTreePathsBySkill = $state<Record<string, string[]>>({});
	let treePagesBySkill = $state<Record<string, SkillTreePages>>({});
	let loadingTreeKeys = $state<string[]>([]);
	let selectedPreview = $state<SkillPreviewRecord | null>(null);
	let selectedSkillKey = $state<string | null>(null);
	let selectedSkillLabel = $state<string | null>(null);
	let selectedSectionId = $state<string | null>(null);
	let selectedSectionLabel = $state<string | null>(null);
	let previewError = $state<string | null>(null);

	const expandedSkillSet = $derived(new Set(expandedSkillKeys));

	const isLoadingTree = (skillKey: string): boolean => loadingTreeKeys.includes(skillKey);

	const readExpandedTreePaths = (skillKey: string): Set<string> =>
		new Set(expandedTreePathsBySkill[skillKey] ?? ['/']);

	const writeExpandedTreePaths = (skillKey: string, nextPaths: Set<string>): void => {
		expandedTreePathsBySkill = {
			...expandedTreePathsBySkill,
			[skillKey]: [...nextPaths],
		};
	};

	const loadTreePage = async (input: {
		sectionId: string;
		skill: SkillBrowserSection['skills'][number];
		path?: string;
		offset?: number;
	}): Promise<void> => {
		const skillKey = createSkillBrowserKey(input.sectionId, input.skill.name);
		if (input.offset === undefined && treePagesBySkill[skillKey]?.[input.path ?? '/']) {
			return;
		}
		if (!loadingTreeKeys.includes(skillKey)) {
			loadingTreeKeys = [...loadingTreeKeys, skillKey];
		}
		try {
			const page = await loadTree(input);
			treePagesBySkill = {
				...treePagesBySkill,
				[skillKey]: {
					...(treePagesBySkill[skillKey] ?? {}),
					[page.rootPath]: mergeSkillTreePage(treePagesBySkill[skillKey]?.[page.rootPath], page),
				},
			};
		} finally {
			loadingTreeKeys = loadingTreeKeys.filter((key) => key !== skillKey);
		}
	};

	const toggleSkill = async (
		section: SkillBrowserSection,
		skill: SkillBrowserSection['skills'][number],
	): Promise<void> => {
		const skillKey = createSkillBrowserKey(section.id, skill.name);
		if (expandedSkillSet.has(skillKey)) {
			expandedSkillKeys = expandedSkillKeys.filter((value) => value !== skillKey);
			return;
		}
		expandedSkillKeys = [...expandedSkillKeys, skillKey];
		await loadTreePage({
			sectionId: section.id,
			skill,
			path: '/',
		});
	};

	const toggleDirectory = async (input: {
		section: SkillBrowserSection;
		skill: SkillBrowserSection['skills'][number];
		path: string;
	}): Promise<void> => {
		const skillKey = createSkillBrowserKey(input.section.id, input.skill.name);
		const nextPaths = readExpandedTreePaths(skillKey);
		if (nextPaths.has(input.path)) {
			nextPaths.delete(input.path);
			if (!nextPaths.has('/')) {
				nextPaths.add('/');
			}
			writeExpandedTreePaths(skillKey, nextPaths);
			return;
		}
		nextPaths.add(input.path);
		writeExpandedTreePaths(skillKey, nextPaths);
		await loadTreePage({
			sectionId: input.section.id,
			skill: input.skill,
			path: input.path,
		});
	};

	const handleLoadMore = async (input: {
		section: SkillBrowserSection;
		skill: SkillBrowserSection['skills'][number];
		path: string;
	}): Promise<void> => {
		const skillKey = createSkillBrowserKey(input.section.id, input.skill.name);
		const nextOffset = treePagesBySkill[skillKey]?.[input.path]?.nextOffset ?? null;
		if (nextOffset === null) {
			return;
		}
		await loadTreePage({
			sectionId: input.section.id,
			skill: input.skill,
			path: input.path,
			offset: nextOffset,
		});
	};

	const selectFile = async (input: {
		section: SkillBrowserSection;
		skill: SkillBrowserSection['skills'][number];
		path: string;
	}): Promise<void> => {
		previewError = null;
		try {
			selectedPreview = await loadPreview({
				sectionId: input.section.id,
				skill: input.skill,
				path: input.path,
			});
			selectedSkillKey = createSkillBrowserKey(input.section.id, input.skill.name);
			selectedSkillLabel = input.skill.name;
			selectedSectionId = input.section.id;
			selectedSectionLabel = input.section.title;
			detailOpen = true;
		} catch (error) {
			selectedPreview = null;
			selectedSkillKey = null;
			previewError = error instanceof Error ? error.message : 'Failed to load skill preview.';
			detailOpen = true;
		}
	};
</script>

<div class="h-full min-w-0" data-testid="skills-skill-browser">
	<WorkbenchPageContent
		class="h-full min-w-0"
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		mainClass="h-full"
		drawerClass="h-full"
		detailRatioPersistence={detailRatioPersistence}
		{detailLeftMin}
		{detailRightMin}
		detailDefaultRatio={0.58}
		{detailCompactThreshold}
		detailCloseLabel="Close preview"
	>
		{#snippet main()}
			<div class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)]">
				<div class="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-3.5 md:px-5">
					<div class="grid gap-1">
						<div class="flex items-center gap-2">
							<FolderTreeIcon class="size-4 text-muted-foreground" />
							<h2 class="text-sm font-semibold">{title}</h2>
						</div>
						<p class="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
					</div>
					{#if detailCompact && (selectedPreview || previewError)}
						<Button variant="outline" size="sm" onclick={() => (detailOpen = true)}>
							<PanelRightOpenIcon class="size-4" />
							Open preview
						</Button>
					{/if}
				</div>

				<ScrollView class="h-full" contentClass="grid gap-5 px-3 py-3 md:px-5 md:py-4">
					{#if sections.length === 0}
						<NoticeBanner tone="info" message="No visible skills were returned for this surface." />
					{:else}
						{#each sections as section (section.id)}
							<section class="grid gap-3">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="text-sm font-semibold">{section.title}</h3>
									<Badge variant="outline">{section.skills.length} skills</Badge>
								</div>
								<p class="text-sm leading-6 text-muted-foreground">{section.description}</p>

								{#if section.skills.length === 0}
									<NoticeBanner tone="info" message="No skills are visible in this group." />
								{:else}
									<div class="grid gap-3">
										{#each section.skills as skill (skill.name)}
											{@const skillKey = createSkillBrowserKey(section.id, skill.name)}
											{@const skillOpen = expandedSkillSet.has(skillKey)}
											<div class="rounded-[1rem] border border-border/60 bg-background/55">
												<button
													type="button"
													class="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 text-left md:px-4"
													onclick={() => {
														void toggleSkill(section, skill);
													}}
												>
													<ChevronRightIcon
														class={cn('mt-0.5 size-4 text-muted-foreground transition-transform', skillOpen && 'rotate-90')}
													/>
													<div class="grid min-w-0 gap-1">
														<div class="truncate text-sm font-semibold">{skill.name}</div>
														<div class="break-all text-xs leading-5 text-muted-foreground">{skill.skillPath}</div>
														<p class="text-sm leading-6 text-muted-foreground">{skill.summary}</p>
													</div>
													<div class="flex flex-col items-end gap-2">
														<Badge variant="outline">{skill.configExists ? 'config' : 'no config'}</Badge>
													</div>
												</button>

												{#if skillOpen}
													<div class="border-t border-border/50 px-2 pb-2 pt-2 md:px-3">
														{#if isLoadingTree(skillKey) && !treePagesBySkill[skillKey]?.['/']}
															<div class="rounded-[0.85rem] bg-muted/24 px-4 py-6 text-sm text-muted-foreground">
																Loading file tree…
															</div>
														{:else}
															<div class="h-[18rem]">
																<SkillFileTree
																	rows={buildSkillTreeRows({
																		pages: treePagesBySkill[skillKey] ?? {},
																		expandedPaths: readExpandedTreePaths(skillKey),
																	})}
																	selectedPath={selectedPreview && selectedSkillKey === skillKey && selectedSectionId === section.id ? selectedPreview.path : null}
																	expandedPaths={readExpandedTreePaths(skillKey)}
																	viewportTestId={`skill-tree-${skillKey}`}
																	onSelectFile={(path) => {
																		void selectFile({ section, skill, path });
																	}}
																	onToggleDirectory={(path) => {
																		void toggleDirectory({ section, skill, path });
																	}}
																	onLoadMore={(path) => {
																		void handleLoadMore({ section, skill, path });
																	}}
																/>
															</div>
														{/if}
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</section>
						{/each}
					{/if}
				</ScrollView>
			</div>
		{/snippet}

		{#snippet drawer()}
			<WorkbenchDetailDrawer
				title={selectedPreview?.name ?? 'Preview'}
				description={selectedPreview ? `${selectedSkillLabel ?? 'Skill'} · ${selectedSectionLabel ?? 'Section'}` : 'Read-only file preview.'}
				summaryClass="gap-1"
				scrollBody={false}
				contentClass="grid h-full min-h-0"
			>
				{#snippet summary()}
					{#if previewError}
						<div>{previewError}</div>
					{:else if selectedPreview}
						<div>Path: {selectedPreview.path}</div>
						<div>Kind: {selectedPreview.previewKind}</div>
						<div>Size: {formatSkillSize(selectedPreview.sizeBytes)}</div>
						<div>Modified: {formatSkillTimestamp(selectedPreview.modifiedAtMs)}</div>
						{#if selectedPreview.mimeType}
							<div>MIME: {selectedPreview.mimeType}</div>
						{/if}
						{#if selectedPreview.note}
							<div>{selectedPreview.note}</div>
						{/if}
					{:else}
						<div>Select a file from the tree to inspect it here.</div>
					{/if}
				{/snippet}

				{#if previewError}
					<NoticeBanner tone="warning" message={previewError} />
				{:else}
					<SkillPreviewPane preview={selectedPreview} class="h-full min-h-0" />
				{/if}
			</WorkbenchDetailDrawer>
		{/snippet}
	</WorkbenchPageContent>
</div>
