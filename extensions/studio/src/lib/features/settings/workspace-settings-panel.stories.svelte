<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	import Harness from './workspace-settings-panel.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Settings/WorkspaceSettingsPanel',
		component: Harness,
	});
</script>

<script lang="ts">
	import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

	import type { SettingsEffectiveGraph, SettingsLayerItem } from './settings-graph-types';

	const effectiveValue = {
		lang: 'en',
		ai: {
			activeProvider: 'default',
		},
		terminal: {
			outputRoot: '/repo/demo/tmp',
		},
		notes: '',
	};

	const effective: SettingsEffectiveGraph = {
		content: `${JSON.stringify(effectiveValue, null, 2)}\n`,
		value: effectiveValue,
		schema: {
			type: 'object',
			properties: {
				lang: {
					type: 'string',
					description: 'Preferred UI locale.',
				},
				ai: {
					type: 'object',
					description: 'Provider selection and model routing.',
					properties: {
						activeProvider: {
							type: 'string',
							description: 'Provider id used for chat and tools.',
						},
					},
				},
				terminal: {
					type: 'object',
					description: 'Terminal runtime options.',
					properties: {
						outputRoot: {
							type: 'string',
							description: 'Absolute path for terminal output files.',
						},
					},
				},
				notes: {
					type: 'string',
					description: 'Optional workspace notes.',
				},
			},
		},
		provenance: {
			'/lang': {
				pointer: '/lang',
				origins: [
					{
						layerId: '1:project',
						sourceId: 'project',
						kind: 'file',
						path: '/repo/demo/.agenter/settings.json',
						pointer: '/lang',
						value: 'en',
					},
				],
				jumpTarget: {
					layerId: '1:project',
					pointer: '/lang',
				},
			},
			'/ai/activeProvider': {
				pointer: '/ai/activeProvider',
				origins: [
					{
						layerId: '2:local',
						sourceId: 'local',
						kind: 'file',
						path: '/repo/demo/.agenter/settings.local.json',
						pointer: '/ai/activeProvider',
						value: 'default',
					},
				],
				jumpTarget: {
					layerId: '2:local',
					pointer: '/ai/activeProvider',
				},
			},
			'/notes': {
				pointer: '/notes',
				origins: [
					{
						layerId: '1:project',
						sourceId: 'project',
						kind: 'file',
						path: '/repo/demo/.agenter/settings.json',
						pointer: '/notes',
						value: '',
					},
				],
				jumpTarget: {
					layerId: '1:project',
					pointer: '/notes',
				},
			},
		},
	};

	const layers: SettingsLayerItem[] = [
		{
			layerId: '0:user',
			sourceId: 'user',
			kind: 'file',
			path: '~/.agenter/settings.json',
			exists: true,
			editable: true,
		},
		{
			layerId: '1:project',
			sourceId: 'project',
			kind: 'file',
			path: '/repo/demo/.agenter/settings.json',
			exists: true,
			editable: true,
		},
		{
			layerId: '2:local',
			sourceId: 'local',
			kind: 'file',
			path: '/repo/demo/.agenter/settings.local.json',
			exists: true,
			editable: true,
		},
	];

	const layerContentById: Record<string, string> = {
		'0:user': '{\n  "lang": "en"\n}\n',
		'1:project': '{\n  "lang": "en",\n  "ai": {\n    "activeProvider": "default"\n  },\n  "notes": ""\n}\n',
		'2:local': '{\n  "ai": {\n    "activeProvider": "default"\n  },\n  "terminal": {\n    "outputRoot": "./tmp"\n  }\n}\n',
	};

	const longLayers: SettingsLayerItem[] = Array.from({ length: 40 }, (_, index) => ({
		layerId: `${index}:project`,
		sourceId: index % 2 === 0 ? 'project' : 'user',
		kind: 'file',
		path: `/repo/demo/.agenter/settings-${index + 1}.json`,
		exists: true,
		editable: true,
	}));

	const onSelectLayerJump = fn<(layerId: string) => void>();
	const onLoadLayerJump = fn<(layerId: string) => void>();
</script>

<Story
	name="Scenario: Given effective settings view When selecting a provenance source Then the panel jumps to layer view and loads the mapped field"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole('tab', { name: 'Effective' }));
		await userEvent.click(canvas.getByRole('tab', { name: 'View' }));
		const notesSourceButton = canvasElement.querySelector('[data-settings-source-pointer="/notes"]');
		await expect(notesSourceButton).not.toBeNull();
		await expect(canvas.getByRole('button', { name: 'Explain notes' })).toBeInTheDocument();
		await userEvent.click(notesSourceButton as HTMLElement);

		await expect(onSelectLayerJump).toHaveBeenCalledWith('1:project');
		await expect(onLoadLayerJump).toHaveBeenCalledWith('1:project');
		await expect(canvas.getByText('Layer Detail')).toBeInTheDocument();
		await waitFor(() => {
			expect(canvasElement.querySelector('[data-settings-pointer="/notes"]')).not.toBeNull();
		});
	}}
>
	<Tooltip.Provider delayDuration={0}>
		<Harness
			effective={effective}
			{layers}
			initialSelectedLayerId="1:project"
			initialLayerContent={layerContentById['1:project']}
			{layerContentById}
			onSelectLayer={onSelectLayerJump}
			onLoadLayer={onLoadLayerJump}
		/>
	</Tooltip.Provider>
</Story>

<Story
	name="Scenario: Given many settings layers When viewing layer sources Then the panel exposes an explicit scroll viewport"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('tab', { name: 'Layer Sources' }));
		const viewport = canvas.getByTestId('settings-sources-scroll-viewport');
		await expect(['auto', 'scroll']).toContain(getComputedStyle(viewport).overflowY);
	}}
>
	<Tooltip.Provider delayDuration={0}>
		<Harness
			effective={effective}
			layers={longLayers}
			initialSelectedLayerId={longLayers[0]?.layerId ?? null}
			initialLayerContent={'{\n  "lang": "en"\n}\n'}
		/>
	</Tooltip.Provider>
</Story>

<Story
	name="Scenario: Given compact workspace settings When selecting one layer source Then the editor opens in a right sheet"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('tab', { name: 'Layer Sources' }));
		await userEvent.click(canvas.getByRole('button', { name: /project/i }));

		await waitFor(() => {
			expect(within(document.body).getByRole('dialog')).toBeInTheDocument();
		});
		await expect(within(document.body).getByRole('heading', { name: 'Layer Detail' })).toBeInTheDocument();
	}}
>
	<Tooltip.Provider delayDuration={0}>
		<Harness
			effective={effective}
			{layers}
			initialSelectedLayerId="1:project"
			initialLayerContent={layerContentById['1:project']}
			{layerContentById}
			compactShell
		/>
	</Tooltip.Provider>
</Story>
