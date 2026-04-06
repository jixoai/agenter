<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import Harness from './message-system-surface.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Messages/MessageSystemSurface',
		component: Harness,
	});
</script>

<script lang="ts">
	import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

	import { containsVisibleTextDeep } from '$lib/testing/shadow-dom';

	const chooseSelectOption = async (
		canvas: ReturnType<typeof within>,
		label: string,
		optionMatcher: RegExp | string,
	): Promise<string> => {
		const trigger = canvas.getByLabelText(label) as HTMLButtonElement;
		await waitFor(() => {
			expect(trigger.closest('[inert]')).toBeNull();
			expect(getComputedStyle(trigger).pointerEvents).not.toBe('none');
		});
		await userEvent.click(trigger);
		const option = await screen.findByRole('option', {
			name: typeof optionMatcher === 'string' ? new RegExp(`^${optionMatcher}$`, 'u') : optionMatcher,
		});
		const optionText = option.textContent?.trim() ?? '';
		await userEvent.click(option);
		await waitFor(() => {
			expect(trigger.textContent ?? '').toContain(optionText);
		});
		return optionText;
	};
</script>

<Story
	name="Scenario: Given an operator room surface When a seat is granted and a message is sent Then the grant flow and transcript append both succeed"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Ops bridge')).toBe(true);
		});
		await expect(canvas.getByRole('button', { name: 'Manage room' })).toBeInTheDocument();
		await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
		await expect(canvas.getByTestId('room-manage-rail')).toBeInTheDocument();
		await expect(canvas.getByTestId('room-manage-stage')).toBeInTheDocument();
		(canvas.getByRole('button', { name: 'Add user' }) as HTMLButtonElement).click();
		await waitFor(async () => {
			await expect(canvas.getByLabelText('Grant actor')).toBeInTheDocument();
		});
		await chooseSelectOption(canvas, 'Grant actor', /Wallet Operator/u);
		await chooseSelectOption(canvas, 'Grant role', 'readonly');
		(canvas.getByRole('button', { name: 'Grant seat' }) as HTMLButtonElement).click();

		await waitFor(async () => {
			await expect(canvas.getByTestId('room-seat-auth:wallet_evm')).toBeInTheDocument();
		});
		expect(canvas.queryByTestId('room-seat-system:trusted-bootstrap')).toBeNull();
		await expect(canvas.getByRole('button', { name: 'Add user' })).toBeInTheDocument();
		(canvas.getByRole('button', { name: 'Add user' }) as HTMLButtonElement).click();
		await waitFor(async () => {
			await expect(canvas.getByLabelText('Grant actor')).toBeInTheDocument();
		});
		await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(canvas.queryByTestId('room-manage-shell')).toBeNull();
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
		await expect(canvas.getByText('2 users')).toBeInTheDocument();
		await expect(canvas.queryByText(/^1\/2 read$/u)).toBeNull();
		await expect(canvas.getByLabelText('1/2 read')).toBeInTheDocument();
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="users" />
</Story>

<Story
	name="Scenario: Given duplicate-label room users When viewer changes Then the viewer chooser keeps actors distinguishable"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
		(canvas.getByRole('button', { name: 'Add user' }) as HTMLButtonElement).click();
		await waitFor(async () => {
			await expect(canvas.getByLabelText('Grant actor')).toBeInTheDocument();
		});
		await chooseSelectOption(canvas, 'Grant actor', /Analyst .*\/repo\/reviewer/u);
		await chooseSelectOption(canvas, 'Grant role', 'member');
		(canvas.getByRole('button', { name: 'Grant seat' }) as HTMLButtonElement).click();
		await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(canvas.queryByTestId('room-manage-shell')).toBeNull();
		});

		const viewerSelect = canvas.getByLabelText('View room as user');

		await waitFor(() => {
			expect(viewerSelect.textContent ?? '').not.toContain('No granted room user yet');
		});
		await waitFor(() => {
			expect(viewerSelect.textContent ?? '').toContain('auth:analyst');
		});
		await chooseSelectOption(canvas, 'View room as user', /Analyst .*\/repo\/reviewer/u);
		await waitFor(() => {
			expect(viewerSelect.textContent ?? '').toContain('/repo/reviewer');
		});
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="users" />
</Story>

<Story
	name="Scenario: Given compact room users When seat actions open Then focus and revoke stay reachable through the dropdown menu"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		(canvas.getByRole('button', { name: 'Add user' }) as HTMLButtonElement).click();
		await waitFor(async () => {
			await expect(canvas.getByLabelText('Grant actor')).toBeInTheDocument();
		});
		await chooseSelectOption(canvas, 'Grant actor', /Wallet Operator/u);
		await chooseSelectOption(canvas, 'Grant role', 'member');
		(canvas.getByRole('button', { name: 'Grant seat' }) as HTMLButtonElement).click();
		await waitFor(async () => {
			await expect(canvas.getByTestId('room-seat-auth:wallet_evm')).toBeInTheDocument();
		});

		const walletSeat = await canvas.findByTestId('room-seat-auth:wallet_evm');
		await userEvent.click(
			within(walletSeat).getByRole('button', {
				name: /Seat actions for Wallet Operator/u,
			}),
		);
		await userEvent.click(await screen.findByRole('menuitem', { name: 'Focus seat' }));
		await waitFor(() => {
			expect(within(walletSeat).getByText('Focused')).toBeInTheDocument();
		});

		await userEvent.click(
			within(walletSeat).getByRole('button', {
				name: /Seat actions for Wallet Operator/u,
			}),
		);
		await userEvent.click(await screen.findByRole('menuitem', { name: 'Revoke user' }));
		await waitFor(() => {
			expect(canvas.queryByTestId('room-seat-auth:wallet_evm')).toBeNull();
		});
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="users" />
</Story>

<Story
	name="Scenario: Given a granted room user When role changes in Permissions Then the updated permission is reflected in the user list"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		(canvas.getByRole('button', { name: 'Add user' }) as HTMLButtonElement).click();
		await waitFor(async () => {
			await expect(canvas.getByLabelText('Grant actor')).toBeInTheDocument();
		});
		await chooseSelectOption(canvas, 'Grant actor', /Wallet Operator/u);
		await chooseSelectOption(canvas, 'Grant role', 'readonly');
		(canvas.getByRole('button', { name: 'Grant seat' }) as HTMLButtonElement).click();
		await waitFor(async () => {
			await expect(canvas.getByTestId('room-seat-auth:wallet_evm')).toBeInTheDocument();
		});

		(canvas.getByRole('button', { name: 'Open Permissions section' }) as HTMLButtonElement).click();
		const permissionRow = await canvas.findByTestId('room-permission-auth:wallet_evm');
		await userEvent.click(within(permissionRow).getByRole('button', { name: 'Admin' }));
		await userEvent.click(within(permissionRow).getByRole('button', { name: 'Apply' }));

		(canvas.getByRole('button', { name: 'Open Users section' }) as HTMLButtonElement).click();
		const walletSeat = await canvas.findByTestId('room-seat-auth:wallet_evm');
		await waitFor(() => {
			expect(within(walletSeat).getByTestId('room-seat-role-auth:wallet_evm').textContent).toBe('admin');
		});
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="users" />
</Story>
