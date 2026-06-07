import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import McpWorkbenchStoryHarness from './mcp-workbench.story-harness.svelte';

const meta = {
	title: 'Features/MCP/MCP Workbench',
	component: McpWorkbenchStoryHarness,
	render: (args) => ({
		Component: McpWorkbenchStoryHarness,
		props: args,
	}),
} satisfies Meta<typeof McpWorkbenchStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoRuntimeState = {
	name: 'Scenario: Given no running runtime When MCP opens Then runtime authority is required before actions',
	args: {
		scenario: 'no-runtime',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId('mcp-story-no-runtime')).toHaveTextContent('No running AvatarRuntime');
	},
} satisfies Story;

export const GlobalOnlyNewConfig = {
	name: 'Scenario: Given global-only mode When New is visible Then global add can explicitly enable and start one project',
	args: {
		scenario: 'global-only',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId('mcp-new-global-form')).toHaveTextContent('New global config');
		await expect(canvas.getByText('01 Global config')).toBeInTheDocument();
		await expect(canvas.getByText('02 Project availability')).toBeInTheDocument();
		await expect(canvas.getByText('03 Project runtime')).toBeInTheDocument();
		await userEvent.click(canvas.getByText('Start after install'));
		await expect(canvas.getAllByText('mcp start')[0]!).toBeInTheDocument();
		await userEvent.click(canvas.getByRole('button', { name: 'Install & start' }));
		await waitFor(() => {
			expect(canvas.getByTestId('mcp-story-event')).toHaveTextContent('submit:browser-tools:stdio:enable:start');
		});
	},
} satisfies Story;

export const DefaultDisabledProject = {
	name: 'Scenario: Given default-disabled projection When row is selected Then lifecycle controls stay gated',
	args: {
		scenario: 'default-disabled',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const detail = within(canvas.getByTestId('mcp-server-detail'));
		await expect(canvas.getByTestId('mcp-server-detail')).toHaveTextContent('default disabled');
		await expect(detail.getByRole('button', { name: 'Enable' })).toBeEnabled();
		await expect(detail.getByRole('button', { name: /^Start$/i })).toBeDisabled();
	},
} satisfies Story;

export const EnabledStoppedProject = {
	name: 'Scenario: Given enabled stopped projection When lifecycle controls render Then start and restart are available',
	args: {
		scenario: 'enabled-stopped',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const detail = within(canvas.getByTestId('mcp-server-detail'));
		await expect(canvas.getByTestId('mcp-server-detail')).toHaveTextContent('enabled');
		await expect(detail.getByRole('button', { name: /^Start$/i })).toBeEnabled();
		await expect(detail.getByRole('button', { name: /^Restart$/i })).toBeEnabled();
		await expect(detail.getByRole('button', { name: /^Stop$/i })).toBeDisabled();
	},
} satisfies Story;

export const RunningProjectTestCall = {
	name: 'Scenario: Given running projection When a tool test call runs Then autoEnable remains explicit and result is structured',
	args: {
		scenario: 'test-call',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const detail = within(canvas.getByTestId('mcp-server-detail'));
		await userEvent.click(detail.getAllByRole('button', { name: /^Test$/i })[0]!);
		const dialog = await waitFor(() => screen.getByTestId('mcp-test-call-dialog'));
		await expect(dialog).toHaveTextContent('autoEnable is off unless explicitly selected');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Call' }));
		await waitFor(() => {
			expect(canvas.getByTestId('mcp-story-event')).toHaveTextContent('call:filesystem:read_file:no-auto-enable');
		});
		await expect(dialog).toHaveTextContent('structuredContent');
	},
} satisfies Story;

export const FailedProject = {
	name: 'Scenario: Given failed projection When detail renders Then latest error and failed state stay visible',
	args: {
		scenario: 'failed',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId('mcp-server-detail')).toHaveTextContent('failed');
		await expect(canvas.getByTestId('mcp-server-detail')).toHaveTextContent('401 while initializing SSE transport');
	},
} satisfies Story;

export const BlockedRemove = {
	name: 'Scenario: Given running projects block remove When remove is attempted Then blocked paths remain visible until stop is explicit',
	args: {
		scenario: 'blocked-remove',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId('mcp-remove-blocked')).toHaveTextContent('/repo/app');
		const detail = within(canvas.getByTestId('mcp-server-detail'));
		await userEvent.click(detail.getByRole('button', { name: /^Remove$/i }));
		const dialog = await waitFor(() => screen.getByTestId('mcp-remove-dialog'));
		await expect(dialog).toHaveTextContent('Stop running project instances before removing');
		await userEvent.click(within(dialog).getByRole('button', { name: 'Remove only' }));
		await waitFor(() => {
			expect(canvas.getByTestId('mcp-story-event')).toHaveTextContent('remove:linear:no-stop');
		});
		await expect(canvas.getByTestId('mcp-remove-blocked')).toHaveTextContent('/repo/app');
	},
} satisfies Story;
