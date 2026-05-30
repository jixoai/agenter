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

	const getRoomToolbarButton = async (
		toolbar: ReturnType<typeof within>,
		name: 'Add user' | 'Manage room' | 'Search messages',
	): Promise<HTMLButtonElement> => {
		const inlineButton = toolbar.queryByRole('button', { name });
		if (inlineButton instanceof HTMLButtonElement) {
			return inlineButton;
		}

		const overflowTrigger = toolbar.queryByRole('button', { name: 'Open room toolbar details' });
		expect(overflowTrigger).not.toBeNull();
		if (overflowTrigger instanceof HTMLButtonElement && overflowTrigger.getAttribute('aria-expanded') !== 'true') {
			await userEvent.click(overflowTrigger);
		}

		return waitFor(() => {
			const overflowButton = toolbar.getByRole('button', { name });
			expect(overflowButton).toBeInstanceOf(HTMLButtonElement);
			return overflowButton as HTMLButtonElement;
		});
	};

	const expectInsideToolbarBand = (toolbarElement: HTMLElement, nodes: readonly HTMLElement[]): void => {
		const toolbarRect = toolbarElement.getBoundingClientRect();
		const epsilon = 1;
		for (const node of nodes) {
			const rect = node.getBoundingClientRect();
			expect(rect.top).toBeGreaterThanOrEqual(toolbarRect.top - epsilon);
			expect(rect.bottom).toBeLessThanOrEqual(toolbarRect.bottom + epsilon);
			expect(rect.left).toBeGreaterThanOrEqual(toolbarRect.left - epsilon);
			expect(rect.right).toBeLessThanOrEqual(toolbarRect.right + epsilon);
		}
	};

	const expectSameRow = (left: HTMLElement, right: HTMLElement): void => {
		const leftRect = left.getBoundingClientRect();
		const rightRect = right.getBoundingClientRect();
		const epsilon = 2;
		expect(Math.abs(leftRect.top - rightRect.top)).toBeLessThanOrEqual(epsilon);
		expect(Math.abs(leftRect.bottom - rightRect.bottom)).toBeLessThanOrEqual(epsilon);
	};

	const expectVisibleButtonBorder = (button: HTMLElement): void => {
		const style = getComputedStyle(button);
		expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
		expect(style.borderTopStyle).not.toBe('none');
		expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
		expect(style.borderTopColor).not.toBe('transparent');
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

	const expectComposerHidden = async (canvas: ReturnType<typeof within>): Promise<void> => {
		await waitFor(() => {
			expect(canvas.queryByTestId('web-chat-draft-editor')).toBeNull();
			expect(canvas.queryByRole('button', { name: 'Send' })).toBeNull();
		});
	};

	const chooseSelectOption = async (
		canvas: ReturnType<typeof within>,
		label: string,
		optionMatcher: RegExp | string,
	): Promise<string> => {
		const resolveInteractiveTrigger = (): HTMLButtonElement => {
			const candidates = canvas.getAllByLabelText(label) as HTMLButtonElement[];
			const trigger = candidates.find((candidate) => {
				if (candidate.closest('[hidden]') || candidate.closest('[inert]')) {
					return false;
				}
				const style = getComputedStyle(candidate);
				return style.pointerEvents !== 'none' && style.visibility !== 'hidden' && style.display !== 'none';
			});
			expect(trigger).toBeInstanceOf(HTMLButtonElement);
			return trigger as HTMLButtonElement;
		};
		const trigger = resolveInteractiveTrigger();
		await waitFor(() => {
			const nextTrigger = resolveInteractiveTrigger();
			expect(nextTrigger.closest('[inert]')).toBeNull();
			expect(getComputedStyle(nextTrigger).pointerEvents).not.toBe('none');
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
		await expect(await getRoomToolbarButton(toolbar, 'Manage room')).toBeInTheDocument();
		await expect(await getRoomToolbarButton(toolbar, 'Search messages')).toBeInTheDocument();
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
		await expect(await getRoomToolbarButton(toolbar, 'Add user')).toBeInTheDocument();
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
	name="Scenario: Given a control-only room When opened in Studio Then transcript and room management stay available while sending stays disabled"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toolbar = getRoomToolbar(canvasElement);
		await waitFor(() => {
			expect(containsVisibleTextDeep(canvasElement, 'Current operator room is live.')).toBe(true);
		});
		await expect(await getRoomToolbarButton(toolbar, 'Manage room')).toBeInTheDocument();
		await expect(await getRoomToolbarButton(toolbar, 'Add user')).toBeInTheDocument();
		await expect(canvas.getByTestId('message-room-send-capability-banner')).toHaveTextContent('No sending seat');
		await expectComposerHidden(canvas);
		await userEvent.click(await getRoomToolbarButton(toolbar, 'Manage room'));
		await waitFor(async () => {
			await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
			await expect(canvas.getByTestId('room-manage-nav-overview')).toHaveAttribute('aria-pressed', 'true');
		});
	}}
>
	<Harness disableManageDialogPortal fixture="control-only" />
</Story>

<Story
	name="Scenario: Given the room toolbar add-user action When it is pressed Then room management lands on Users Add"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toolbar = getRoomToolbar(canvasElement);
		await userEvent.click(await getRoomToolbarButton(toolbar, 'Add user'));
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
	name="Scenario: Given a readonly room user When selected as viewer Then transcript read stays available while send remains unavailable"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => {
			expect(canvas.getByTestId('message-room-send-capability-banner')).toHaveTextContent('Read-only seat selected');
		});
		await expectComposerHidden(canvas);
		await expect(canvas.getByText('Current operator room is live.')).toBeInTheDocument();
	}}
>
	<Harness disableManageDialogPortal fixture="readonly-viewer" />
</Story>

<Story
	name="Scenario: Given room management was dismissed When the operator presses manage again Then the same dialog shell reopens without leaving the page inert"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toolbar = getRoomToolbar(canvasElement);

		await userEvent.click(await getRoomToolbarButton(toolbar, 'Manage room'));
		await waitFor(async () => {
			await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
		});

		await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(canvas.queryByTestId('room-manage-shell')).toBeNull();
		});
		await waitFor(() => {
			expect(document.body.style.pointerEvents).not.toBe('none');
		});

		await userEvent.click(await getRoomToolbarButton(toolbar, 'Manage room'));
		await waitFor(async () => {
			await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
			await expect(canvas.getByTestId('room-manage-nav-overview')).toHaveAttribute('aria-pressed', 'true');
		});
	}}
>
	<Harness disableManageDialogPortal />
</Story>

<Story
	name="Scenario: Given a room is archived from its own detail surface When the action completes Then the transcript stays visible and the page shows archived status instead of navigating away"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toolbar = getRoomToolbar(canvasElement);

		await userEvent.click(await getRoomToolbarButton(toolbar, 'Manage room'));
		await waitFor(async () => {
			await expect(canvas.getByTestId('room-manage-shell')).toBeInTheDocument();
		});
		await expect(canvas.getByTestId('room-manage-nav-overview')).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(canvas.getByRole('button', { name: 'Archive room' }));

		await waitFor(async () => {
			await expect(canvas.getByTestId('message-room-archived-banner')).toBeInTheDocument();
		});
		await expect(canvas.getByTestId('message-room-archived-banner')).toHaveTextContent(
			'This room is archived.',
		);
		await expect(canvas.getByText('Current operator room is live.')).toBeInTheDocument();
	}}
>
	<Harness disableManageDialogPortal />
</Story>

<Story
	name="Scenario: Given room management Share section When opened Then room websocket links and user tokens can be copied"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		let share = canvas;

		await waitFor(async () => {
			const shareSection = canvas.getByTestId('room-manage-share-section');
			await expect(shareSection).toBeInTheDocument();
			share = within(shareSection);
		});
		await expect(share.getByText('Ops bridge')).toBeInTheDocument();
		await expect(share.getByText('room-ops')).toBeInTheDocument();
		await expect(share.getByDisplayValue('ws://127.0.0.1:4581/room/room-ops')).toBeInTheDocument();
		await expect(share.getByText('auth:analyst')).toBeInTheDocument();
		await expect(share.getByDisplayValue('token:room-ops:analyst')).toBeInTheDocument();
		await expect(share.getByRole('button', { name: 'Copy room websocket base URL' })).toBeInTheDocument();
		await expect(share.getByRole('button', { name: 'Copy token for Analyst' })).toBeInTheDocument();
		await userEvent.click(share.getByRole('button', { name: 'Show WebSocket URL for Analyst' }));
		await expect(
			share.getByDisplayValue('ws://127.0.0.1:4581/room/room-ops?token=token%3Aroom-ops%3Aanalyst'),
		).toBeVisible();
		await expect(share.getByRole('button', { name: 'Copy websocket URL for Analyst' })).toBeInTheDocument();
	}}
>
	<Harness disableManageDialogPortal initialManageDialogSection="share" />
</Story>

<Story
	name="Scenario: Given room search was dismissed When the operator presses search again Then the search dialog reopens without leaving the page inert"
	asChild
	play={async ({ canvasElement }) => {
		const toolbar = getRoomToolbar(canvasElement);

		await userEvent.click(await getRoomToolbarButton(toolbar, 'Search messages'));
		await waitFor(async () => {
			const dialog = screen.getByTestId('room-search-dialog');
			await expect(dialog).toBeInTheDocument();
			await expect(within(dialog).getByLabelText('Search messages')).toBeInTheDocument();
		});

		await userEvent.click(screen.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(screen.queryByTestId('room-search-dialog')).toBeNull();
		});
		await waitFor(() => {
			expect(document.body.style.pointerEvents).not.toBe('none');
		});

		await userEvent.click(await getRoomToolbarButton(toolbar, 'Search messages'));
		await waitFor(async () => {
			const dialog = screen.getByTestId('room-search-dialog');
			await expect(dialog).toBeInTheDocument();
			await expect(within(dialog).getByLabelText('Search messages')).toBeInTheDocument();
		});
	}}
>
	<Harness disableManageDialogPortal />
</Story>

<Story
	name="Scenario: Given a fixed 48px room toolbar When compact width is applied Then the viewer trigger, actions, and mode chips stay fully visible inside the toolbar"
	asChild
	play={async ({ canvasElement }) => {
		const toolbarElement = canvasElement.querySelector<HTMLElement>('[data-workbench-page-toolbar]');
		expect(toolbarElement).not.toBeNull();
		const toolbar = getRoomToolbar(canvasElement);
		const viewerTrigger = toolbar.getByLabelText('View room as user') as HTMLElement;
		const searchAction = toolbar.getByRole('button', { name: 'Search messages' }) as HTMLElement;
		const addUserAction = toolbar.getByRole('button', { name: 'Add user' }) as HTMLElement;
		const manageAction = toolbar.getByRole('button', { name: 'Manage room' }) as HTMLElement;
		const chatTab = toolbar.getByRole('tab', { name: 'chat' }) as HTMLElement;
		const assetsTab = toolbar.getByRole('tab', { name: 'assets' }) as HTMLElement;

		await waitFor(() => {
			expectInsideToolbarBand(toolbarElement!, [
				viewerTrigger,
				searchAction,
				addUserAction,
				manageAction,
				chatTab,
				assetsTab,
			]);
		});
	}}
>
	<Harness disableManageDialogPortal surfaceClass="h-[52rem] w-[390px] max-w-full min-w-0 bg-background" />
</Story>

<Story
	name="Scenario: Given the compact room composer When idle at 390px width Then send stays inline and passive help chrome does not occupy a second footer row"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const attachAction = canvas.getByRole('button', { name: 'Attach' }) as HTMLElement;
		const screenshotAction = canvas.getByRole('button', { name: 'Screenshot' }) as HTMLElement;
		const sendAction = canvas.getByRole('button', { name: 'Send' }) as HTMLElement;

		await waitFor(() => {
			expectSameRow(attachAction, sendAction);
			expectSameRow(screenshotAction, sendAction);
			expectVisibleButtonBorder(attachAction);
			expectVisibleButtonBorder(screenshotAction);
		});
		await expect(canvas.getByLabelText('Composer help')).not.toBeVisible();
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
