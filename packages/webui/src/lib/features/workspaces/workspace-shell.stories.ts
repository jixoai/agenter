import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import WorkspaceShellStoryHarness from './workspace-shell.story-harness.svelte';

const getCanvas = (canvasElement: HTMLElement) => within(canvasElement);
const getContentHeader = (canvasElement: HTMLElement) =>
	within(within(canvasElement).getByTestId('workspace-content-header'));

const meta = {
	title: 'Features/Workspaces/Workspace Shell',
	component: WorkspaceShellStoryHarness,
	render: (args) => ({
		Component: WorkspaceShellStoryHarness,
		props: args,
	}),
} satisfies Meta<typeof WorkspaceShellStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ModeSwitchingKeepsSharedShell = {
	name: 'Scenario: Given workspace mode pills When switching between Explorer Rules and Private Then the shared shell swaps page bodies without losing header chrome',
	args: {
		initialMode: 'explorer',
	},
	play: async ({ canvasElement }) => {
		const canvas = getCanvas(canvasElement);

		await userEvent.click(canvas.getByTestId('workspace-mode-rules'));
		await expect(canvas.getByText('Rule priority follows row order.')).toBeInTheDocument();

		await userEvent.click(canvas.getByTestId('workspace-mode-private'));
		await expect(canvas.getByText('Private assets reuse the same tree mental model.')).toBeInTheDocument();

		await userEvent.click(canvas.getByTestId('workspace-mode-explorer'));
		await expect(canvas.getByText('Explorer preview')).toBeInTheDocument();
	},
} satisfies Story;

export const AvatarLensKeepsRootContext = {
	name: 'Scenario: Given the shared content header When switching avatar lens Then the selected root context stays fixed while View as remains live',
	args: {
		initialMode: 'explorer',
	},
	play: async ({ canvasElement }) => {
		const canvas = getCanvas(canvasElement);
		const contentHeader = getContentHeader(canvasElement);

		await expect(contentHeader.getAllByText('/repo/agenter')[0]).toBeInTheDocument();
		await expect(contentHeader.getByText('Persistent')).toBeInTheDocument();
		await userEvent.click(canvas.getByTestId('workspace-avatar-select'));
		await userEvent.click(await screen.findByText('reviewer'));

		await waitFor(() => {
			expect(contentHeader.getByText('reviewer')).toBeInTheDocument();
		});
		await expect(contentHeader.getAllByText('/repo/agenter')[0]).toBeInTheDocument();
	},
} satisfies Story;

export const TreeDisclosureStaysInSurface = {
	name: 'Scenario: Given a tree directory When disclosure is toggled Then child rows stay inside the same virtualized surface',
	args: {
		initialMode: 'explorer',
	},
	play: async ({ canvasElement }) => {
		const canvas = getCanvas(canvasElement);
		let srcDirectoryButton: HTMLElement | null = null;
		await waitFor(() => {
			srcDirectoryButton = canvasElement.querySelector<HTMLElement>('[data-workspace-tree-path="/src"]');
			expect(srcDirectoryButton).not.toBeNull();
		});
		if (!srcDirectoryButton) {
			return;
		}

		await expect(canvas.queryByText('/src/app.ts')).not.toBeInTheDocument();
		await userEvent.click(srcDirectoryButton);
		await expect(canvas.getByText('/src/app.ts')).toBeInTheDocument();
		await userEvent.click(srcDirectoryButton);
		await expect(canvas.queryByText('/src/app.ts')).not.toBeInTheDocument();
	},
} satisfies Story;

export const CompactShellPreservesPrimaryViewport = {
	name: 'Scenario: Given a compact workspace shell When the shared header and bottom dock render Then the tree keeps the dominant viewport budget',
	args: {
		initialMode: 'explorer',
		frameClass: 'h-[58rem] w-[390px] max-w-full',
	},
	play: async ({ canvasElement }) => {
		const canvas = getCanvas(canvasElement);
		const contentHeader = canvas.getByTestId('workspace-content-header');
		const treeViewport = canvas.getByTestId('workspace-shell-story-tree');

		await waitFor(() => {
			const headerRect = contentHeader.getBoundingClientRect();
			const treeRect = treeViewport.getBoundingClientRect();
			expect(Math.round(headerRect.height)).toBeLessThanOrEqual(120);
			expect(Math.round(treeRect.height)).toBeGreaterThanOrEqual(260);
		});
	},
} satisfies Story;
