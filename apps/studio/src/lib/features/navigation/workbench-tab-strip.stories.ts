import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, screen, waitFor, within } from 'storybook/test';

import Harness from './workbench-tab-strip.story-harness.svelte';

const meta = {
	title: 'Features/Navigation/WorkbenchTabStrip',
	component: Harness,
	render: (args) => ({
		Component: Harness,
		props: args,
	}),
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HoveringRuntimeTabShowsTooltip = {
	name: 'Scenario: Given a chrome-style runtime tab When hovering it Then tooltip detail and fused status indicators stay visible',
	play: async ({ canvasElement, userEvent }) => {
		const canvas = within(canvasElement);
		const runtimeTab = canvas.getByRole('tab', { name: /reviewer/u });
		await userEvent.hover(runtimeTab);

		await waitFor(() => {
			expect(screen.getByText('reviewer · alpha workspace')).toBeInTheDocument();
		});
		await expect(
			screen.getByText('Workspace alpha · attention pending and 2 unread tool results.'),
		).toBeInTheDocument();
		await expect(canvas.getByText('2')).toBeInTheDocument();
		await waitFor(() => {
			expect(
				canvasElement.querySelector('[data-workbench-tab="session-reviewer"] .animate-spin'),
			).not.toBeNull();
		});
	},
} satisfies Story;

export const ContextMenuCloseFallsBackSelection = {
	name: 'Scenario: Given a running workbench tab When opening its context menu and closing it Then menu actions dispatch and selection falls back',
	play: async ({ canvasElement, userEvent }) => {
		const canvas = within(canvasElement);
		const runtimeTab = canvas.getByRole('tab', { name: /reviewer/u });
		runtimeTab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

		const copyMenuItem = await screen.findByRole('menuitem', { name: 'Copy session id' });
		await userEvent.click(copyMenuItem);
		await expect(canvas.getByTestId('workbench-tab-event-log')).toHaveTextContent(
			'menu:session-reviewer:copy-session-id',
		);

		runtimeTab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		const closeMenuItem = await screen.findByRole('menuitem', { name: 'Close tab' });
		await userEvent.click(closeMenuItem);
		await waitFor(() => {
			expect(canvas.queryByRole('tab', { name: /reviewer/u })).toBeNull();
		});
		await expect(canvas.getByTestId('workbench-tab-event-log')).toHaveTextContent(
			'close:session-reviewer',
		);
		await expect(canvas.getByTestId('workbench-tab-state')).toHaveTextContent('history');
	},
} satisfies Story;

export const NarrowToolbarStaysSingleSurface = {
	name: 'Scenario: Given a narrow workbench chrome When toolbar content reflows Then metadata stays visible and hover actions collapse without horizontal overflow',
	args: {
		frameClassName: 'w-full max-w-[24.375rem] p-4',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Avatar workbench')).toBeInTheDocument();
		await expect(canvas.getByRole('button', { name: 'Inspect state' })).toBeVisible();

		const toolbarSlot = canvasElement.querySelector<HTMLElement>('[data-workbench-page-toolbar]');
		const toolbar = canvasElement.querySelector<HTMLElement>('[data-workbench-toolbar]');
		const contentRegion = canvasElement.querySelector<HTMLElement>('[data-workbench-toolbar-region="content"]');
		const runtimeTab = canvas.getByRole('tab', { name: /reviewer/u });
		const closeButton = canvasElement.querySelector<HTMLElement>('[data-workbench-tab-action="close"]');

		expect(toolbarSlot).not.toBeNull();
		expect(toolbar).not.toBeNull();
		expect(contentRegion).not.toBeNull();
		expect(closeButton).not.toBeNull();

		const overflowX = (toolbar?.scrollWidth ?? 0) - (toolbar?.clientWidth ?? 0);
		expect(overflowX).toBeLessThanOrEqual(1);
		expect(Math.round(toolbarSlot?.getBoundingClientRect().height ?? 0)).toBe(48);
		expect(runtimeTab.getBoundingClientRect().width).toBeLessThanOrEqual(193);
		expect(getComputedStyle(closeButton!).display).toBe('none');
	},
} satisfies Story;
