import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { RuntimeChatMessage } from '@agenter/client-sdk';

import RuntimeStageHeartbeatStoryHarness from './runtime-stage-heartbeat.story-harness.svelte';

const baseTimestamp = Date.UTC(2026, 3, 12, 14, 25, 0);

const initialMessages = [
	{
		id: 'heartbeat-user-1',
		chatId: 'runtime-heartbeat',
		role: 'user',
		content: 'Summarize the current workspace grants before the next loop.',
		timestamp: baseTimestamp,
		cycleId: 41,
		attachments: [],
	},
	{
		id: 'heartbeat-compact-1',
		role: 'system',
		content: 'Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.',
		timestamp: baseTimestamp + 25_000,
		cycleId: 41,
		format: 'plain',
		heartbeatKind: 'compact_separator',
		compactTrigger: 'manual',
	},
	{
		id: 'heartbeat-assistant-1',
		chatId: 'runtime-heartbeat',
		role: 'assistant',
		channel: 'to_user',
		content: 'Gathered workspace metadata and queued the next attention follow-up.',
		timestamp: baseTimestamp + 45_000,
		cycleId: 41,
		attachments: [
			{
				assetId: 'asset-log',
				kind: 'file',
				name: 'workspace-summary.json',
				mimeType: 'application/json',
				sizeBytes: 384,
				url: 'https://example.test/workspace-summary.json',
			},
		],
		tool: {
			invocationId: 'tool-call-1',
			name: 'workspace.exec',
			status: 'success',
			startedAt: baseTimestamp + 42_000,
			finishedAt: baseTimestamp + 44_000,
			call: {
				value: {
					cmd: 'workspace list --json',
				},
				rawText: '{"cmd":"workspace list --json"}',
			},
		},
	},
] satisfies RuntimeChatMessage[];

const olderMessages = [
	{
		id: 'heartbeat-user-0',
		chatId: 'runtime-heartbeat',
		role: 'user',
		content: 'Load the previous checkpoint before you continue.',
		timestamp: baseTimestamp - 60_000,
		cycleId: 40,
		attachments: [],
	},
] satisfies RuntimeChatMessage[];

const meta = {
	title: 'Features/Runtime/Heartbeat Stage',
	component: RuntimeStageHeartbeatStoryHarness,
	render: (args) => ({
		Component: RuntimeStageHeartbeatStoryHarness,
		props: args,
	}),
} satisfies Meta<typeof RuntimeStageHeartbeatStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoadingOlderKeepsHeartbeatRowsStable = {
	name: 'Scenario: Given persisted heartbeat rows When older history is loaded Then message primitives stay stable while the virtual list owns scrolling',
	args: {
		initialMessages,
		olderMessages,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const stage = canvas.getByTestId('runtime-heartbeat-stage');

		await expect(stage).toBeInTheDocument();
		await waitFor(() => {
			expect(
				canvas.getByText('Summarize the current workspace grants before the next loop.'),
			).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(canvas.getByText('Context compacted')).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(
				canvas.getByText('Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.'),
			).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(
				canvas.getByText('Gathered workspace metadata and queued the next attention follow-up.'),
			).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(canvas.getByText('workspace-summary.json')).toBeInTheDocument();
		});

		await userEvent.click(canvas.getByRole('button', { name: 'Load older' }));
		await waitFor(() => {
			expect(canvas.getByText('Load the previous checkpoint before you continue.')).toBeInTheDocument();
		});
		await expect(canvas.getByRole('button', { name: 'History loaded' })).toBeDisabled();
	},
} satisfies Story;

export const EmptyLedgerShowsExplicitState = {
	name: 'Scenario: Given no persisted heartbeat rows When the stage opens Then the operator sees an explicit empty ledger state instead of a blank panel',
	args: {
		initialMessages: [],
		olderMessages: [],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const stage = canvas.getByTestId('runtime-heartbeat-stage');

		await expect(stage).toBeInTheDocument();
		await waitFor(() => {
			expect(canvas.getByTestId('runtime-heartbeat-empty')).toBeInTheDocument();
		});
		await expect(canvas.getByText('No Heartbeat rows yet')).toBeInTheDocument();
		await expect(
			canvas.getByText(
				'Persisted AI-call ledger rows will appear here after the runtime records user, assistant, or compact-boundary facts.',
			),
		).toBeInTheDocument();
	},
} satisfies Story;
