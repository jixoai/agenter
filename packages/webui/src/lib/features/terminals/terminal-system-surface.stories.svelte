<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import Harness from './terminal-system-surface.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Terminals/TerminalSystemSurface',
		component: Harness,
	});
</script>

<script lang="ts">
	import { expect, userEvent, waitFor, within } from 'storybook/test';

	import { containsVisibleTextDeep } from '$lib/testing/shadow-dom';
</script>

<Story
	name="Scenario: Given a live terminal operator surface When requester access is granted and a lease is approved Then users and actions stay synchronized"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const terminalSelectName = /Select terminal term-story/i;
		const requestedWrite = 'echo requester approval';
		const leasedWrite = 'echo requester after lease';
		await expect(canvas.getByRole('button', { name: terminalSelectName })).toBeInTheDocument();

		await userEvent.click(canvas.getByRole('tab', { name: 'Users' }));
		await userEvent.selectOptions(canvas.getByLabelText('Grant actor'), 'auth:wallet_evm');
		await userEvent.selectOptions(canvas.getByLabelText('Grant role'), 'requester');
		await userEvent.click(canvas.getByRole('button', { name: 'Grant seat' }));

		await waitFor(async () => {
			await expect(canvas.getByTestId('terminal-seat-auth:wallet_evm')).toBeInTheDocument();
		});

		await userEvent.click(canvas.getByRole('tab', { name: 'Actions' }));
		await userEvent.selectOptions(canvas.getAllByLabelText('Call tool as')[0], 'token:term-story:auth:wallet_evm');
		await userEvent.type(canvas.getByPlaceholderText('Type terminal input…'), requestedWrite);
		await userEvent.click(canvas.getByRole('button', { name: 'Call tool' }));

		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, /Write approval requested:/)).toBe(true);
		});

		await userEvent.click(canvas.getByRole('tab', { name: 'Users' }));
		await waitFor(async () => {
			await expect(canvas.getByText('Pending approvals')).toBeInTheDocument();
		});
		await userEvent.click(canvas.getByRole('button', { name: 'Approve 30m' }));
		await waitFor(async () => {
			await expect(canvas.getByText(/Lease until/)).toBeInTheDocument();
		});

		await userEvent.click(canvas.getByRole('tab', { name: 'Actions' }));
		await userEvent.type(canvas.getByPlaceholderText('Type terminal input…'), leasedWrite);
		await userEvent.click(canvas.getByRole('button', { name: 'Call tool' }));
		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, leasedWrite)).toBe(true);
		});
	}}
>
	<Harness />
</Story>
