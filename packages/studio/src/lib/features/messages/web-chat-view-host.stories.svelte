<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import Harness from './web-chat-view-host.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Messages/WebChatViewHost',
		component: Harness,
	});
</script>

<script lang="ts">
	import { expect, userEvent, waitFor, within } from 'storybook/test';

	import { containsVisibleTextDeep } from '$lib/testing/shadow-dom';
</script>

<Story
	name="Scenario: Given a shared room host When the operator sends a message Then websocket transcript facts stay visible"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Welcome from transport')).toBe(true);
		});

		const composer = canvas.getByPlaceholderText('Message Operator room...');
		await userEvent.type(composer, 'Live transport append');
		await userEvent.click(canvas.getByRole('button', { name: 'Send' }));

		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Live transport append')).toBe(true);
		});
		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Read ring should stay in sync.')).toBe(true);
		});
	}}
>
	<Harness />
</Story>
