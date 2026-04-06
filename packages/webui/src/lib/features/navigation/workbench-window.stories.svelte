<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import Harness from './workbench-window.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Navigation/WorkbenchWindow',
		component: Harness,
	});
</script>

<script lang="ts">
	import { expect, within } from 'storybook/test';
</script>

<Story
	name="Scenario: Given a switched workbench window When chrome and body render Then the body remains fused to the same surface"
	asChild
	play={async ({ canvasElement }) => {
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
		expect(Math.abs(bodyTop - toolbarBottom)).toBeLessThanOrEqual(1);
	}}
>
	<Tooltip.Provider delayDuration={0}>
		<div class="h-[42rem] w-full max-w-5xl p-4">
			<Harness />
		</div>
	</Tooltip.Provider>
</Story>
