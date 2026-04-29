<script lang="ts">
	import SkillsSkillBrowser from './skills-skill-browser.svelte';
	import type { SkillBrowserSection, SkillPreviewRecord, SkillTreePage } from './skill-browser-state';

	let {
		frameClass = 'h-[52rem] w-[1280px] max-w-full',
		previewMode = 'text',
		detailLeftMin = undefined,
		detailRightMin = undefined,
		detailCompactThreshold = undefined,
	}: {
		frameClass?: string;
		previewMode?: 'text' | 'image';
		detailLeftMin?: number;
		detailRightMin?: number;
		detailCompactThreshold?: number;
	} = $props();

	const buildPagesByPath = (): Record<string, SkillTreePage> => ({
		'/': {
			rootPath: '/',
			total: 2,
			nextOffset: null,
			items: [
				{
					path: '/docs',
					name: 'docs',
					kind: 'directory',
					sizeBytes: null,
					modifiedAtMs: 1,
					previewKind: 'directory',
				},
				{
					path: previewMode === 'image' ? '/preview.png' : '/SKILL.md',
					name: previewMode === 'image' ? 'preview.png' : 'SKILL.md',
					kind: 'file',
					sizeBytes: previewMode === 'image' ? 512 : 128,
					modifiedAtMs: 2,
					previewKind: previewMode === 'image' ? 'image' : 'text',
				},
			],
		},
		'/docs': {
			rootPath: '/docs',
			total: 1,
			nextOffset: null,
			items: [
				{
					path: '/docs/guide.md',
					name: 'guide.md',
					kind: 'file',
					sizeBytes: 96,
					modifiedAtMs: 3,
					previewKind: 'text',
				},
			],
		},
	});

	const sections = [
		{
			id: 'built-in',
			title: 'Built-in skills',
			description: 'Shipped read-only skills.',
			skills: [
				{
					name: 'reviewer',
					summary: 'Review code and explain risks.',
					rootKind: 'builtin',
					skillPath: 'reviewer',
					skillDir: '/skills/reviewer',
					configPath: '/skills/reviewer/ccski.config.json',
					configExists: true,
				},
			],
		},
	] satisfies SkillBrowserSection[];

	const loadPreview = async (path: string): Promise<SkillPreviewRecord> => {
		if (previewMode === 'image' && path === '/preview.png') {
			return {
				path,
				name: 'preview.png',
				kind: 'file',
				sizeBytes: 512,
				modifiedAtMs: 2,
				previewKind: 'image',
				mimeType: 'image/svg+xml',
				textContent: null,
				mediaDataUrl:
					'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNDAiIGhlaWdodD0iMTYwIj48cmVjdCB3aWR0aD0iMjQwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iI2Q0ZWVmZiIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9IjcwIiByPSIzNiIgZmlsbD0iIzRhNzJmNSIvPjxwYXRoIGQ9Ik0yNCAxMzJMODQgODlMMTE2IDEyMWwyNi0zMiA3NCA0M3YxNkgyNHoiIGZpbGw9IiMyYmM0YzMiLz48L3N2Zz4=',
				truncated: false,
				note: null,
			};
		}

		return {
			path,
			name: path.split('/').at(-1) ?? 'SKILL.md',
			kind: 'file',
			sizeBytes: 128,
			modifiedAtMs: 2,
			previewKind: 'text',
			mimeType: 'text/markdown',
			textContent: '# Reviewer\n\nRead-only preview body for this skill file.\n',
			mediaDataUrl: null,
			truncated: false,
			note: null,
		};
	};
</script>

<div class={frameClass} data-testid="skills-skill-browser-harness">
	<SkillsSkillBrowser
		title="Built-in skills"
		description="Objective accordion list-detail browser."
		{sections}
		detailRatioPersistence="storybook:skills-browser"
		{detailLeftMin}
		{detailRightMin}
		{detailCompactThreshold}
		loadTree={({ path }) => Promise.resolve(buildPagesByPath()[path ?? '/'] ?? buildPagesByPath()['/']!)}
		loadPreview={({ path }) => loadPreview(path)}
	/>
</div>
