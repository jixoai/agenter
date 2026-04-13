import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { HeartbeatPartItem } from '@agenter/client-sdk';

import RuntimeStageHeartbeatStoryHarness from './runtime-stage-heartbeat.story-harness.svelte';

const baseTimestamp = Date.UTC(2026, 3, 12, 14, 25, 0);

const initialEntries = [
	{
		id: 21,
		messageId: 'request_aux:systemPrompt:1',
		windowId: null,
		aiCallId: 41,
		roundIndex: 7,
		scope: 'request_aux',
		role: 'system',
		createdAt: baseTimestamp + 10_000,
		updatedAt: baseTimestamp + 10_000,
		isComplete: true,
		text: 'You are a Linux expert. Prefer bash and skills before asking for help.',
		parts: [
			{
				partId: 21,
				partIndex: 0,
				messageId: 'request_aux:systemPrompt:1',
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
	{
		id: 22,
		messageId: 'request_aux:tools:1',
		windowId: null,
		aiCallId: 41,
		roundIndex: 7,
		scope: 'request_aux',
		role: 'system',
		createdAt: baseTimestamp + 12_000,
		updatedAt: baseTimestamp + 12_000,
		isComplete: true,
		text: '[{"name":"workspace.bash"},{"name":"attention.focus"}]',
		parts: [
			{
				partId: 22,
				partIndex: 0,
				messageId: 'request_aux:tools:1',
				windowId: null,
				aiCallId: 41,
				roundIndex: 7,
				scope: 'request_aux',
				role: 'system',
				partType: 'tools',
				mimeType: null,
				payload: [{ name: 'workspace.bash' }, { name: 'attention.focus' }],
				createdAt: baseTimestamp + 12_000,
				updatedAt: baseTimestamp + 12_000,
				isComplete: true,
			},
		],
	},
	{
		id: 23,
		messageId: 'heartbeat-part:ai-call:41:request:0',
		windowId: null,
		aiCallId: 41,
		roundIndex: 7,
		scope: 'heartbeat_part',
		role: 'user',
		createdAt: baseTimestamp + 15_000,
		updatedAt: baseTimestamp + 15_000,
		isComplete: true,
		text: 'scoreMap={\"message:room-main\":1} commit=在吗？',
		parts: [
			{
				partId: 23,
				partIndex: 0,
				messageId: 'heartbeat-part:ai-call:41:request:0',
				windowId: null,
				aiCallId: 41,
				roundIndex: 7,
				scope: 'heartbeat_part',
				role: 'user',
				partType: 'text',
				mimeType: null,
				payload: {
					type: 'text',
					content: 'scoreMap={"message:room-main":1} commit=在吗？',
				},
				createdAt: baseTimestamp + 15_000,
				updatedAt: baseTimestamp + 15_000,
				isComplete: true,
			},
		],
	},
	{
		id: 24,
		messageId: 'heartbeat-part:ai-call:41:compact',
		windowId: null,
		aiCallId: 41,
		roundIndex: 8,
		scope: 'heartbeat_part',
		role: 'system',
		createdAt: baseTimestamp + 25_000,
		updatedAt: baseTimestamp + 25_000,
		isComplete: true,
		text: 'Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.',
		parts: [
			{
				partId: 24,
				partIndex: 0,
				messageId: 'heartbeat-part:ai-call:41:compact',
				windowId: null,
				aiCallId: 41,
				roundIndex: 8,
				scope: 'heartbeat_part',
				role: 'system',
				partType: 'compact',
				mimeType: null,
				payload: {
					type: 'compact',
					text: 'Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.',
					format: 'plain',
					heartbeatKind: 'compact_separator',
					compactTrigger: 'manual',
					callRoundIndex: 7,
					currentRoundIndex: 8,
				},
				createdAt: baseTimestamp + 25_000,
				updatedAt: baseTimestamp + 25_000,
				isComplete: true,
			},
		],
	},
	{
		id: 25,
		messageId: 'heartbeat-part:ai-call:41:response:assistant',
		windowId: null,
		aiCallId: 41,
		roundIndex: 8,
		scope: 'heartbeat_part',
		role: 'assistant',
		createdAt: baseTimestamp + 45_000,
		updatedAt: baseTimestamp + 50_000,
		isComplete: false,
		text: 'Gathered workspace metadata and queued the next attention follow-up.',
		parts: [
			{
				partId: 25,
				partIndex: 0,
				messageId: 'heartbeat-part:ai-call:41:response:assistant',
				windowId: null,
				aiCallId: 41,
				roundIndex: 8,
				scope: 'heartbeat_part',
				role: 'assistant',
				partType: 'thinking',
				mimeType: null,
				payload: {
					type: 'thinking',
					text: '先看当前房间有没有新的 commit，再决定是否要切去 workspace。',
				},
				createdAt: baseTimestamp + 45_000,
				updatedAt: baseTimestamp + 48_000,
				isComplete: false,
			},
			{
				partId: 26,
				partIndex: 1,
				messageId: 'heartbeat-part:ai-call:41:response:assistant',
				windowId: null,
				aiCallId: 41,
				roundIndex: 8,
				scope: 'heartbeat_part',
				role: 'assistant',
				partType: 'tool_call',
				mimeType: null,
				payload: {
					invocationId: 'tool-call-1',
					tool: 'workspace.bash',
					input: { command: 'ccski list --no-color' },
					startedAt: baseTimestamp + 46_000,
				},
				createdAt: baseTimestamp + 46_000,
				updatedAt: baseTimestamp + 46_000,
				isComplete: true,
			},
			{
				partId: 27,
				partIndex: 2,
				messageId: 'heartbeat-part:ai-call:41:response:assistant',
				windowId: null,
				aiCallId: 41,
				roundIndex: 8,
				scope: 'heartbeat_part',
				role: 'assistant',
				partType: 'tool_result',
				mimeType: null,
				payload: {
					invocationId: 'tool-call-1',
					tool: 'workspace.bash',
					output: { stdout: 'workspace.bash\nattention.focus' },
					error: null,
					finishedAt: baseTimestamp + 47_000,
				},
				createdAt: baseTimestamp + 47_000,
				updatedAt: baseTimestamp + 47_000,
				isComplete: true,
			},
			{
				partId: 28,
				partIndex: 3,
				messageId: 'heartbeat-part:ai-call:41:response:assistant',
				windowId: null,
				aiCallId: 41,
				roundIndex: 8,
				scope: 'heartbeat_part',
				role: 'assistant',
				partType: 'text',
				mimeType: null,
				payload: {
					type: 'text',
					content: 'Gathered workspace metadata and queued the next attention follow-up.',
				},
				createdAt: baseTimestamp + 48_000,
				updatedAt: baseTimestamp + 50_000,
				isComplete: false,
			},
		],
	},
] satisfies HeartbeatPartItem[];

const olderEntries = [
	{
		id: 19,
		messageId: 'request_aux:config:0',
		windowId: null,
		aiCallId: 40,
		roundIndex: 6,
		scope: 'request_aux',
		role: 'config',
		createdAt: baseTimestamp - 30_000,
		updatedAt: baseTimestamp - 30_000,
		isComplete: true,
		text: '{"temperature":0.2,"maxToken":512}',
		parts: [
			{
				partId: 19,
				partIndex: 0,
				messageId: 'request_aux:config:0',
				windowId: null,
				aiCallId: 40,
				roundIndex: 6,
				scope: 'request_aux',
				role: 'config',
				partType: 'config',
				mimeType: null,
				payload: { temperature: 0.2, maxToken: 512 },
				createdAt: baseTimestamp - 30_000,
				updatedAt: baseTimestamp - 30_000,
				isComplete: true,
			},
		],
	},
	{
		id: 20,
		messageId: 'heartbeat-part:ai-call:40:response:assistant',
		windowId: null,
		aiCallId: 40,
		roundIndex: 6,
		scope: 'heartbeat_part',
		role: 'assistant',
		createdAt: baseTimestamp - 20_000,
		updatedAt: baseTimestamp - 18_000,
		isComplete: true,
		text: 'Checkpoint restored.',
		parts: [
			{
				partId: 20,
				partIndex: 0,
				messageId: 'heartbeat-part:ai-call:40:response:assistant',
				windowId: null,
				aiCallId: 40,
				roundIndex: 6,
				scope: 'heartbeat_part',
				role: 'assistant',
				partType: 'text',
				mimeType: null,
				payload: {
					type: 'text',
					content: 'Checkpoint restored.',
				},
				createdAt: baseTimestamp - 20_000,
				updatedAt: baseTimestamp - 18_000,
				isComplete: true,
			},
		],
	},
] satisfies HeartbeatPartItem[];

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
	name: 'Scenario: Given durable Heartbeat message-parts When older rows are loaded Then folded bootstrap facts compact boundaries and assistant updates stay in one stream',
	args: {
		initialEntries,
		olderEntries,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const stage = canvas.getByTestId('runtime-heartbeat-stage');
		const systemPromptEntry = canvas.getByTestId('runtime-heartbeat-entry-21');
		const userEntry = canvas.getByTestId('runtime-heartbeat-entry-23');
		const compactEntry = canvas.getByTestId('runtime-heartbeat-entry-24');

		await expect(stage).toBeInTheDocument();
		await waitFor(() => {
			expect(userEntry.textContent).toContain('scoreMap={"message:room-main":1} commit=在吗？');
		});
		await waitFor(() => {
			expect(compactEntry.textContent).toContain(
				'Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.',
			);
		});

		const systemPromptSummary = systemPromptEntry.querySelector('summary');
		if (!(systemPromptSummary instanceof HTMLElement)) {
			throw new Error('System prompt summary is missing.');
		}
		await userEvent.click(systemPromptSummary);
		await waitFor(() => {
			expect(systemPromptEntry.textContent).toContain(
				'You are a Linux expert. Prefer bash and skills before asking for help.',
			);
		});

			await userEvent.click(canvas.getByRole('button', { name: 'Load older' }));
			const olderAssistantEntry = canvas.getByTestId('runtime-heartbeat-entry-20');
			await waitFor(() => {
				expect(olderAssistantEntry.textContent).toContain('Checkpoint restored.');
			});
			await expect(canvas.getByRole('button', { name: 'History loaded' })).toBeDisabled();
		},
	} satisfies Story;

export const EmptyLedgerShowsExplicitState = {
	name: 'Scenario: Given no persisted Heartbeat rows When the stage opens Then the operator sees an explicit empty state instead of a blank panel',
	args: {
		initialEntries: [],
		olderEntries: [],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const stage = canvas.getByTestId('runtime-heartbeat-stage');

		await expect(stage).toBeInTheDocument();
		await waitFor(() => {
			expect(canvas.getByTestId('runtime-heartbeat-empty')).toBeInTheDocument();
		});
		await expect(canvas.getByText('No Heartbeat rows yet')).toBeInTheDocument();
	},
} satisfies Story;
