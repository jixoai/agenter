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
		await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
		await expect(canvas.getByTestId('room-manage-rail')).toBeInTheDocument();
		await expect(canvas.getByTestId('room-manage-stage')).toBeInTheDocument();
		await userEvent.selectOptions(canvas.getByLabelText('Grant actor'), 'auth:wallet_evm');
		await userEvent.selectOptions(canvas.getByLabelText('Grant role'), 'readonly');
		(canvas.getByRole('button', { name: 'Grant seat' }) as HTMLButtonElement).click();
			(canvas.getByRole('button', { name: /^Users/u }) as HTMLButtonElement).click();

		await waitFor(async () => {
			await expect(canvas.getByTestId('room-seat-auth:wallet_evm')).toBeInTheDocument();
		});
		await userEvent.keyboard('{Escape}');
		await waitFor(() => {
			expect(canvas.queryByLabelText('Grant actor')).toBeNull();
		});

		const composer = canvas.getByPlaceholderText('Message Ops bridge...') as HTMLTextAreaElement;
		composer.value = 'Story transcript append';
		composer.dispatchEvent(new Event('input', { bubbles: true }));
		await waitFor(() => {
			expect(canvas.getByRole('button', { name: 'Send' })).toBeEnabled();
		});
		(canvas.getByRole('button', { name: 'Send' }) as HTMLButtonElement).click();

		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Story transcript append')).toBe(true);
		});
		await waitFor(() => {
			expect(canvas.getAllByText('1/3').length).toBeGreaterThanOrEqual(1);
		});
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="access" />
</Story>

<Story
	name="Scenario: Given duplicate-label actors When viewer changes Then viewer perspective stays independent from send-as authority"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
		await userEvent.selectOptions(canvas.getByLabelText('Grant actor'), 'session:reviewer');
		await userEvent.selectOptions(canvas.getByLabelText('Grant role'), 'member');
		(canvas.getByRole('button', { name: 'Grant seat' }) as HTMLButtonElement).click();
		await userEvent.keyboard('{Escape}');
		await waitFor(() => {
			expect(canvas.queryByLabelText('Grant actor')).toBeNull();
		});

		const viewerSelect = canvas.getByLabelText('View as') as HTMLSelectElement;
		const sendAsSelect = canvas.getByLabelText('Send as') as HTMLSelectElement;
		const sendAsBefore = sendAsSelect.value;

		await waitFor(() => {
			expect([...viewerSelect.options].some((option) => option.textContent?.includes('/repo/reviewer'))).toBe(true);
		});
		await userEvent.selectOptions(viewerSelect, 'session:reviewer');
		await waitFor(() => {
			expect(viewerSelect.value).toBe('session:reviewer');
		});
		expect(sendAsSelect.value).toBe(sendAsBefore);
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="access" />
</Story>
