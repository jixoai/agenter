import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, userEvent, within } from 'storybook/test';

import StructuredValueViewer from './structured-value-viewer.svelte';

const rawText = '{"status":"ok","count":2,"nested":{"kind":"assistant"}}';

const meta = {
	title: 'Components/Structured Value/Viewer',
	component: StructuredValueViewer,
	render: (args) => ({
		Component: StructuredValueViewer,
		props: args,
	}),
} satisfies Meta<typeof StructuredValueViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MenuSwitchesTheReadOnlyCodeMirrorDocument = {
	name: 'Scenario: Given a structured payload When the viewer mode changes from YAML to plain text Then the shadcn dropdown and read-only CodeMirror surface stay in sync',
	args: {
		value: {
			status: 'ok',
			count: 2,
			nested: {
				kind: 'assistant',
			},
		},
		rawText,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Structured value options' });

		await expect(canvasElement.textContent).toContain('status: ok');

		await userEvent.click(trigger);

		const overlay = within(document.body);
		const [localPlainTextOption] = overlay.getAllByRole('menuitemradio', { name: /Plain text/u });
		await userEvent.click(localPlainTextOption!);

		await expect(trigger).toHaveTextContent('Plain text');
		await expect(canvasElement.textContent).toContain(rawText);
	},
} satisfies Story;
