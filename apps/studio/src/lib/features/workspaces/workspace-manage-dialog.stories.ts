import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, within } from 'storybook/test';

import WorkspaceManageDialogStoryHarness from './workspace-manage-dialog.story-harness.svelte';

const meta = {
	title: 'Features/Workspaces/Workspace Manage Dialog',
	component: WorkspaceManageDialogStoryHarness,
	render: () => ({
		Component: WorkspaceManageDialogStoryHarness,
	}),
} satisfies Meta<typeof WorkspaceManageDialogStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MountUnmountAndLensSelection = {
	name: 'Scenario: Given workspace management stays dialog-scoped When avatars are mounted unmounted and opened Then the list updates without replacing the Explorer Rules Private shell',
	play: async ({ canvasElement, userEvent }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByTestId('workspace-manage-launch'));
		await expect(canvas.getByTestId('workspace-manage-dialog')).toBeInTheDocument();

		await userEvent.click(canvas.getByTestId('workspace-manage-mount-reviewer'));
		await expect(canvas.getByTestId('workspace-manage-row-reviewer')).toHaveTextContent('Public workspace');
		await expect(canvas.getByTestId('workspace-manage-row-reviewer')).toHaveTextContent(
			'Mounted without rules yet',
		);

		await userEvent.click(canvas.getByTestId('workspace-manage-unmount-observer'));
		await expect(canvas.getByTestId('workspace-manage-row-observer')).toHaveTextContent('Detached');
		await expect(canvas.getByTestId('workspace-manage-row-observer')).toHaveTextContent('Not mounted yet');

		await userEvent.click(canvas.getByTestId('workspace-manage-open-reviewer'));
		await expect(canvas.getByTestId('workspace-manage-current-lens')).toHaveTextContent('reviewer');
		await expect(canvas.getByTestId('workspace-manage-row-reviewer')).toHaveTextContent('Current lens');
	},
} satisfies Story;
