import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { SettingsEffectiveGraph, SettingsLayerFile, SettingsLayerItem } from './settings-graph-types';
import WorkspaceSettingsPanelStoryHarness from './workspace-settings-panel.story-harness.svelte';

const layers: SettingsLayerItem[] = [
	{
		layerId: 'workspace',
		sourceId: 'workspace',
		kind: 'file',
		path: '/repo/demo/.agenter/settings.json',
		exists: true,
		editable: true,
	},
	{
		layerId: 'avatar',
		sourceId: 'avatar',
		kind: 'avatar',
		path: '/repo/demo/.agenter/avatars/runtime-planner/settings.local.json',
		exists: true,
		editable: true,
	},
];

const meta = {
	title: 'Features/Settings/Workspace Settings Panel',
	component: WorkspaceSettingsPanelStoryHarness,
	render: (args) => ({
		Component: WorkspaceSettingsPanelStoryHarness,
		props: args,
	}),
} satisfies Meta<typeof WorkspaceSettingsPanelStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SwitchingLayersKeepsProvenanceVisible = {
	name: 'Scenario: Given a settings provenance panel When the operator switches source layers Then the detail editor follows the selected layer instead of collapsing back to one flat file',
	args: {
		effective: {
			content: '{\n  "voice": "calm",\n  "timezone": "Asia/Shanghai"\n}\n',
			value: {
				voice: 'calm',
				timezone: 'Asia/Shanghai',
			},
			schema: {
				type: 'object',
				properties: {
					voice: { type: 'string' },
					timezone: { type: 'string' },
				},
			},
			provenance: {},
		} satisfies SettingsEffectiveGraph,
		layers,
		layerFiles: {
			workspace: {
				layer: layers[0],
				path: '/repo/demo/.agenter/settings.json',
				content: '{\n  "voice": "steady"\n}\n',
				mtimeMs: 1,
			},
			avatar: {
				layer: layers[1],
				path: '/repo/demo/.agenter/avatars/runtime-planner/settings.local.json',
				content: '{\n  "timezone": "Asia/Shanghai"\n}\n',
				mtimeMs: 2,
			},
		} satisfies Record<string, SettingsLayerFile>,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('tab', { name: 'Layer Sources' }));
		await userEvent.click(canvas.getByRole('button', { name: /avatar/i }));

		await waitFor(() => {
			expect(canvas.getByText('Loaded avatar')).toBeInTheDocument();
		});

		const editor = canvas.getByTestId('settings-layer-source-editor').querySelector('textarea');
		expect(editor?.value).toContain('"timezone": "Asia/Shanghai"');

		if (editor) {
			editor.value = '{\n  "timezone": "UTC"\n}\n';
			editor.dispatchEvent(new Event('input', { bubbles: true }));
		}
		await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
		await expect(canvas.getByText('Saved avatar')).toBeInTheDocument();
	},
} satisfies Story;
