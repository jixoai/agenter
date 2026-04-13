import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { ModelCallItem, RequestAuxItem, RuntimeChatMessage } from '@agenter/client-sdk';

import RuntimeStageHeartbeatStoryHarness from './runtime-stage-heartbeat.story-harness.svelte';

const baseTimestamp = Date.UTC(2026, 3, 12, 14, 25, 0);

const initialMessages = [
	{
		id: '11',
		chatId: 'runtime-heartbeat',
		role: 'user',
		content: 'Summarize the current workspace grants before the next loop.',
		timestamp: baseTimestamp,
		cycleId: 41,
		attachments: [],
	},
	{
		id: '12',
		role: 'system',
		content: 'Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.',
		timestamp: baseTimestamp + 25_000,
		cycleId: 41,
		format: 'plain',
		heartbeatKind: 'compact_separator',
		compactTrigger: 'manual',
	},
	{
		id: '13',
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

const initialRequestAux = [
	{
		id: 21,
		messageId: 'aux-system',
		windowId: null,
		aiCallId: 41,
		roundIndex: 7,
		scope: 'request_aux',
		role: 'system',
		createdAt: baseTimestamp + 10_000,
		updatedAt: baseTimestamp + 10_000,
		isComplete: true,
		text: 'You are a Linux expert.',
		parts: [
			{
				partId: 21,
				partIndex: 0,
				messageId: 'aux-system',
				windowId: null,
				aiCallId: 41,
				roundIndex: 7,
				scope: 'request_aux',
				role: 'system',
				partType: 'systemPrompt',
				mimeType: null,
				payload: 'You are a Linux expert. Prefer bash and skills before asking for help.',
				createdAt: baseTimestamp + 10_000,
				updatedAt: baseTimestamp + 10_000,
				isComplete: true,
			},
		],
	},
] satisfies RequestAuxItem[];

const initialModelCalls = [
	{
		id: 41,
		cycleId: 41,
		roundIndex: 7,
		kind: 'attention',
		status: 'running',
		provider: 'openai-compatible',
		model: 'test-model',
		requestUrl: 'https://example.test/v1/chat/completions',
		request: {
			messages: [{ role: 'system', content: 'You are a Linux expert.' }],
		},
		response: {
			assistant: {
				text: 'Gathering workspace facts now.',
				thinking: 'The runtime still needs the latest grants and shell outputs.',
			},
		},
		error: null,
		outcome: null,
		createdAt: baseTimestamp + 15_000,
		updatedAt: baseTimestamp + 35_000,
		completedAt: null,
		isComplete: false,
	},
] satisfies ModelCallItem[];

const olderMessages = [
	{
		id: '10',
		chatId: 'runtime-heartbeat',
		role: 'user',
		content: 'Load the previous checkpoint before you continue.',
		timestamp: baseTimestamp - 60_000,
		cycleId: 40,
		attachments: [],
	},
] satisfies RuntimeChatMessage[];

const olderRequestAux = [
	{
		id: 20,
		messageId: 'aux-tools',
		windowId: null,
		aiCallId: 40,
		roundIndex: 6,
		scope: 'request_aux',
		role: 'config',
		createdAt: baseTimestamp - 30_000,
		updatedAt: baseTimestamp - 30_000,
		isComplete: true,
		text: '[{"name":"workspace.bash"}]',
		parts: [
			{
				partId: 20,
				partIndex: 0,
				messageId: 'aux-tools',
				windowId: null,
				aiCallId: 40,
				roundIndex: 6,
				scope: 'request_aux',
				role: 'config',
				partType: 'tools',
				mimeType: null,
				payload: [{ name: 'workspace.bash' }],
				createdAt: baseTimestamp - 30_000,
				updatedAt: baseTimestamp - 30_000,
				isComplete: true,
			},
		],
	},
] satisfies RequestAuxItem[];

const olderModelCalls = [
	{
		id: 40,
		cycleId: 40,
		roundIndex: 6,
		kind: 'attention',
		status: 'done',
		provider: 'openai-compatible',
		model: 'test-model',
		requestUrl: 'https://example.test/v1/chat/completions',
		request: {
			messages: [{ role: 'user', content: 'Load checkpoint' }],
		},
		response: {
			assistant: {
				text: 'Checkpoint restored.',
			},
		},
		error: null,
		outcome: { code: 'done' },
		createdAt: baseTimestamp - 25_000,
		updatedAt: baseTimestamp - 20_000,
		completedAt: baseTimestamp - 20_000,
		isComplete: true,
	},
] satisfies ModelCallItem[];

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
	name: 'Scenario: Given persisted heartbeat inspection facts When older history is loaded Then message rows request aux facts and model-call cards stay in one ordered stream',
	args: {
		initialMessages,
		initialRequestAux,
		initialModelCalls,
		modelCallDeltas: [
			{
				id: 1,
				seq: 1,
				modelCallId: 41,
				cycleId: 41,
				timestamp: baseTimestamp + 18_000,
				kind: 'tool_call',
				data: { name: 'workspace.bash', command: 'workspace list --json' },
			},
		],
		olderMessages,
		olderRequestAux,
		olderModelCalls,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const stage = canvas.getByTestId('runtime-heartbeat-stage');

		await expect(stage).toBeInTheDocument();
		await waitFor(() => {
			expect(canvas.getByText('Summarize the current workspace grants before the next loop.')).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(canvas.getByTestId('runtime-heartbeat-request-aux-21').textContent).toContain(
				'You are a Linux expert. Prefer bash and skills before asking for help.',
			);
		});
		await waitFor(() => {
			expect(canvas.getByText('https://example.test/v1/chat/completions')).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(canvas.getByText('workspace-summary.json')).toBeInTheDocument();
		});

		await userEvent.click(canvas.getByRole('button', { name: 'Load older' }));
		await waitFor(() => {
			expect(canvas.getByText('Load the previous checkpoint before you continue.')).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(canvas.getByText('Checkpoint restored.')).toBeInTheDocument();
		});
		await expect(canvas.getByRole('button', { name: 'History loaded' })).toBeDisabled();
	},
} satisfies Story;

export const EmptyLedgerShowsExplicitState = {
	name: 'Scenario: Given no persisted heartbeat inspection facts When the stage opens Then the operator sees an explicit empty state instead of a blank panel',
	args: {
		initialMessages: [],
		initialRequestAux: [],
		initialModelCalls: [],
		modelCallDeltas: [],
		olderMessages: [],
		olderRequestAux: [],
		olderModelCalls: [],
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
				'Persisted Heartbeat messages, request bootstrap facts, and model-call cards will appear here once the runtime records them.',
			),
		).toBeInTheDocument();
	},
} satisfies Story;
