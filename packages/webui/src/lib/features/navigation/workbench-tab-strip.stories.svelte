<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	import Harness from './workbench-tab-strip.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Navigation/WorkbenchTabStrip',
		component: Harness,
	});
</script>

<script lang="ts">
	import { expect, screen, waitFor, within } from 'storybook/test';
</script>

<Story
	name="Scenario: Given a chrome-style runtime tab When hovering it Then tooltip detail and fused status indicators stay visible"
	asChild
	play={async ({ canvasElement, userEvent }) => {
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
			expect(canvasElement.querySelector('[data-workbench-tab="session-reviewer"] .animate-spin')).not.toBeNull();
		});
	}}
>
	<Tooltip.Provider delayDuration={0}>
		<div class="w-full max-w-4xl p-4">
			<Harness />
		</div>
	</Tooltip.Provider>
</Story>

<Story
	name="Scenario: Given a running workbench tab When opening its context menu and closing it Then menu actions dispatch and selection falls back"
	asChild
	play={async ({ canvasElement, userEvent }) => {
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
		await expect(canvas.getByTestId('workbench-tab-event-log')).toHaveTextContent('close:session-reviewer');
		await expect(canvas.getByTestId('workbench-tab-state')).toHaveTextContent('history');
	}}
>
	<Tooltip.Provider delayDuration={0}>
		<div class="w-full max-w-4xl p-4">
			<Harness />
		</div>
	</Tooltip.Provider>
</Story>

<Story
	name="Scenario: Given a narrow workbench chrome When toolbar content reflows Then metadata and actions stay visible without horizontal overflow"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Avatar workbench')).toBeInTheDocument();
		await expect(canvas.getByRole('button', { name: 'Inspect state' })).toBeVisible();

		const toolbarSlot = canvasElement.querySelector<HTMLElement>('[data-workbench-page-toolbar]');
		const toolbar = canvasElement.querySelector<HTMLElement>('[data-workbench-toolbar]');
		const contentRegion = canvasElement.querySelector<HTMLElement>('[data-workbench-toolbar-region="content"]');
		const runtimeTab = canvas.getByRole('tab', { name: /reviewer/u });
		const closeButton = canvas.getByRole('button', { name: /Close reviewer/u });

		expect(toolbarSlot).not.toBeNull();
		expect(toolbar).not.toBeNull();
		expect(contentRegion).not.toBeNull();

		const overflowX = (toolbar?.scrollWidth ?? 0) - (toolbar?.clientWidth ?? 0);
		expect(overflowX).toBeLessThanOrEqual(1);
		expect(Math.round(toolbarSlot?.getBoundingClientRect().height ?? 0)).toBe(48);
		expect(runtimeTab.getBoundingClientRect().width).toBeLessThanOrEqual(193);
		expect(getComputedStyle(closeButton).pointerEvents).toBe('none');
	}}
>
	<Tooltip.Provider delayDuration={0}>
		<div class="w-full max-w-[24.375rem] p-4">
			<Harness />
		</div>
	</Tooltip.Provider>
</Story>
