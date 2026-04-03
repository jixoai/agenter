<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import Harness from './message-system-surface.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Messages/MessageSystemSurface',
		component: Harness,
	});
</script>

<script lang="ts">
	import { expect, userEvent, waitFor, within } from 'storybook/test';

	import { containsVisibleTextDeep } from '$lib/testing/shadow-dom';
</script>

<Story
	name="Scenario: Given an operator room surface When a seat is granted and a message is sent Then transcript and seat facts stay synchronized"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('button', { name: /Ops bridge/i })).toBeInTheDocument();

		await userEvent.selectOptions(canvas.getByLabelText('Grant actor'), 'auth:wallet_evm');
		await userEvent.selectOptions(canvas.getByLabelText('Grant role'), 'readonly');
		await userEvent.click(canvas.getByRole('button', { name: 'Grant seat' }));

		await waitFor(async () => {
			await expect(canvas.getByTestId('room-seat-auth:wallet_evm')).toBeInTheDocument();
		});

		await userEvent.type(canvas.getByPlaceholderText('Message Ops bridge...'), 'Story transcript append');
		await userEvent.click(canvas.getByRole('button', { name: 'Send' }));

		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Story transcript append')).toBe(true);
		});
		await waitFor(() => {
			expect(canvas.getAllByText('1/3').length).toBeGreaterThanOrEqual(1);
		});
	}}
>
	<Harness />
</Story>
