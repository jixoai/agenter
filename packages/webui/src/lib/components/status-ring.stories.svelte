<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import StatusRing from './status-ring.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/StatusRing',
		component: StatusRing,
	});
</script>

<script lang="ts">
	import { expect, within } from 'storybook/test';
</script>

<Story
	name="Read progress"
	args={{
		value: 3,
		total: 5,
		label: 'Read progress',
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByLabelText('Read progress')).toBeInTheDocument();
		await expect(canvas.getByText('3/5')).toBeInTheDocument();
	}}
/>

<Story
	name="Running pulse"
	args={{
		value: 7,
		total: 9,
		label: 'Cycle progress',
		pulse: true,
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByLabelText('Cycle progress')).toBeInTheDocument();
		await expect(canvas.getByText('7/9')).toBeInTheDocument();
	}}
/>
