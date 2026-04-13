import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, within } from 'storybook/test';

import Harness from './workbench-window.story-harness.svelte';

const meta = {
	title: 'Features/Navigation/WorkbenchWindow',
	component: Harness,
	render: () => ({
		Component: Harness,
	}),
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ChromeFusesIntoBodySurface = {
	name: 'Scenario: Given a switched workbench window When chrome and body render Then the body remains fused to the same surface',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Window shell')).toBeInTheDocument();
		await expect(canvas.getByText('Body Surface')).toBeInTheDocument();
		await expect(canvas.getByTestId('workbench-window-story-page')).toBeInTheDocument();

		const toolbar = canvasElement.querySelector<HTMLElement>('[data-workbench-page-toolbar]');
		const body = canvasElement.querySelector<HTMLElement>('[data-workbench-window-body]');
		const pageSurface = canvasElement.querySelector<HTMLElement>('[data-workbench-surface="page"]');

		expect(toolbar).not.toBeNull();
		expect(body).not.toBeNull();
		expect(pageSurface).not.toBeNull();

		const toolbarBottom = toolbar?.getBoundingClientRect().bottom ?? 0;
		const bodyTop = body?.getBoundingClientRect().top ?? 0;
		const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
		expect(Math.round(toolbarHeight)).toBe(48);
		expect(Math.abs(bodyTop - toolbarBottom)).toBeLessThanOrEqual(1);
	},
} satisfies Story;
