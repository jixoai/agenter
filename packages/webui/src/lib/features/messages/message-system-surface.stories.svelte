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

	const getRoomToolbar = (canvasElement: HTMLElement) => {
		const toolbar = canvasElement.querySelector<HTMLElement>('[data-workbench-page-toolbar]');
		expect(toolbar).not.toBeNull();
		return within(toolbar!);
	};

	const openAddUserForm = async (canvas: ReturnType<typeof within>): Promise<void> => {
		const usersSection = await canvas.findByTestId('room-manage-users-section');
		await userEvent.click(within(usersSection).getByRole('button', { name: 'Add user' }));
		await waitFor(async () => {
			await expect(canvas.getByLabelText('User')).toBeInTheDocument();
		});
	};

	const getComposerEditor = async (canvas: ReturnType<typeof within>): Promise<HTMLElement> => {
		return waitFor(() => {
			const host = canvas.getByTestId('web-chat-draft-editor') as HTMLElement;
			const contentEditable = host.querySelector('[contenteditable="true"]') as HTMLElement | null;
			const textarea = host.querySelector('textarea') as HTMLTextAreaElement | null;
			const editor = contentEditable ?? textarea;
			expect(editor).not.toBeNull();
			expect(getComputedStyle(editor!).pointerEvents).not.toBe('none');
			return editor!;
		});
	};

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
		const toolbar = getRoomToolbar(canvasElement);
		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Ops bridge')).toBe(true);
		});
		await expect(toolbar.getByRole('button', { name: 'Manage room' })).toBeInTheDocument();
		await expect(toolbar.getByRole('button', { name: 'Search messages' })).toBeInTheDocument();
		await expect(toolbar.getByRole('tab', { name: 'chat' })).toHaveAttribute('aria-selected', 'true');
		await expect(toolbar.getByRole('tab', { name: 'assets' })).toBeInTheDocument();
		await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
		await expect(canvas.getByTestId('room-manage-rail')).toBeInTheDocument();
		await expect(canvas.getByTestId('room-manage-stage')).toBeInTheDocument();
		await openAddUserForm(canvas);
		await chooseSelectOption(canvas, 'User', /Wallet Operator/u);
		await chooseSelectOption(canvas, 'Role', 'readonly');
		(canvas.getByRole('button', { name: 'Add room user' }) as HTMLButtonElement).click();

		await waitFor(async () => {
			await expect(canvas.getByTestId('room-seat-auth:wallet_evm')).toBeInTheDocument();
		});
		expect(canvas.queryByTestId('room-seat-system:trusted-bootstrap')).toBeNull();
		await expect(toolbar.getByRole('button', { name: 'Add user' })).toBeInTheDocument();
		await openAddUserForm(canvas);
		await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(canvas.queryByTestId('room-manage-shell')).toBeNull();
		});
		await waitFor(() => {
			expect(document.body.style.pointerEvents).not.toBe('none');
		});

		const composer = await getComposerEditor(canvas);
		composer.focus();
		await userEvent.keyboard('Story transcript append');
		await waitFor(() => {
			expect(canvas.getByRole('button', { name: 'Send' })).toBeEnabled();
		});
		(canvas.getByRole('button', { name: 'Send' }) as HTMLButtonElement).click();

		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Story transcript append')).toBe(true);
		});
		await expect(canvas.queryByText(/^0\/1 read$/u)).toBeNull();
		await expect(canvas.getAllByLabelText('0/1 read').length).toBeGreaterThan(0);
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="users" />
</Story>

<Story
	name="Scenario: Given the room toolbar add-user action When it is pressed Then room management lands on Users Add"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toolbar = getRoomToolbar(canvasElement);
		await userEvent.click(toolbar.getByRole('button', { name: 'Add user' }));
		await waitFor(async () => {
			await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
			await expect(canvas.getByLabelText('User')).toBeInTheDocument();
		});
		await expect(canvas.getByTestId('room-manage-nav-users')).toHaveAttribute('aria-pressed', 'true');
	}}
>
	<Harness disableManageDialogPortal />
</Story>

<Story
	name="Scenario: Given a fixed 48px room toolbar When compact width is applied Then the viewer trigger and mode chips stay fully visible inside the toolbar"
	asChild
	play={async ({ canvasElement }) => {
		const toolbarElement = canvasElement.querySelector<HTMLElement>('[data-workbench-page-toolbar]');
		expect(toolbarElement).not.toBeNull();
		const toolbar = getRoomToolbar(canvasElement);
		const viewerTrigger = toolbar.getByLabelText('View room as user') as HTMLElement;
		const chatTab = toolbar.getByRole('tab', { name: 'chat' }) as HTMLElement;
		const assetsTab = toolbar.getByRole('tab', { name: 'assets' }) as HTMLElement;

		await waitFor(() => {
			const toolbarRect = toolbarElement!.getBoundingClientRect();
			for (const node of [viewerTrigger, chatTab, assetsTab]) {
				const rect = node.getBoundingClientRect();
				expect(rect.top).toBeGreaterThanOrEqual(toolbarRect.top - 0.5);
				expect(rect.bottom).toBeLessThanOrEqual(toolbarRect.bottom + 0.5);
			}
		});
	}}
>
	<Harness disableManageDialogPortal surfaceClass="h-[52rem] w-[390px] max-w-full min-w-0 bg-background" />
</Story>

<Story
	name="Scenario: Given duplicate-label room users When viewer changes Then the viewer chooser keeps actors distinguishable"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toolbar = getRoomToolbar(canvasElement);
		await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
		await openAddUserForm(canvas);
		await chooseSelectOption(canvas, 'User', /Analyst .*\/repo\/reviewer/u);
		await chooseSelectOption(canvas, 'Role', 'member');
		(canvas.getByRole('button', { name: 'Add room user' }) as HTMLButtonElement).click();
		await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(canvas.queryByTestId('room-manage-shell')).toBeNull();
		});

		const viewerSelect = toolbar.getByLabelText('View room as user');

		await waitFor(() => {
			expect(viewerSelect.textContent ?? '').not.toContain('No granted room user yet');
		});
		await waitFor(() => {
			expect(viewerSelect.textContent ?? '').toContain('Analyst');
		});
		await chooseSelectOption(toolbar, 'View room as user', /Analyst .*\/repo\/reviewer/u);
		await waitFor(() => {
			expect(viewerSelect.textContent ?? '').toContain('/repo/reviewer');
		});
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="users" />
</Story>

<Story
	name="Scenario: Given durable room assets When switching toolbar chips Then assets fill page_content without transcript chrome pollution"
	asChild
		play={async ({ canvasElement, userEvent }) => {
		const canvas = within(canvasElement);
		const toolbar = getRoomToolbar(canvasElement);
		(toolbar.getByRole('tab', { name: 'assets' }) as HTMLButtonElement).click();
		await waitFor(() => {
			expect(canvas.getByTestId('room-asset-row-asset-room-brief')).toBeInTheDocument();
		});
		expect(canvas.queryByTestId('web-chat-draft-editor')).toBeNull();
		(toolbar.getByRole('tab', { name: 'chat' }) as HTMLButtonElement).click();
		await waitFor(() => {
			expect(canvas.getByTestId('web-chat-draft-editor')).toBeInTheDocument();
		});
	}}
>
	<Harness disableManageDialogPortal />
</Story>

<Story
	name="Scenario: Given compact room users When seat actions open Then focus and revoke stay reachable through the dropdown menu"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toolbar = getRoomToolbar(canvasElement);
		await openAddUserForm(canvas);
		await chooseSelectOption(canvas, 'User', /Wallet Operator/u);
		await chooseSelectOption(canvas, 'Role', 'member');
		(canvas.getByRole('button', { name: 'Add room user' }) as HTMLButtonElement).click();
		await waitFor(async () => {
			await expect(canvas.getByTestId('room-seat-auth:wallet_evm')).toBeInTheDocument();
		});

		const walletSeat = await canvas.findByTestId('room-seat-auth:wallet_evm');
		await userEvent.click(
			within(walletSeat).getByRole('button', {
				name: /User actions for Wallet Operator/u,
			}),
		);
		await userEvent.click(await screen.findByRole('menuitem', { name: 'Focus seat' }));
		await waitFor(() => {
			expect(within(walletSeat).getByText('Focused')).toBeInTheDocument();
		});

		await userEvent.click(
			within(walletSeat).getByRole('button', {
				name: /User actions for Wallet Operator/u,
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
		const toolbar = getRoomToolbar(canvasElement);
		await openAddUserForm(canvas);
		await chooseSelectOption(canvas, 'User', /Wallet Operator/u);
		await chooseSelectOption(canvas, 'Role', 'readonly');
		(canvas.getByRole('button', { name: 'Add room user' }) as HTMLButtonElement).click();
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
