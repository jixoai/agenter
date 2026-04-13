import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, within } from 'storybook/test';

import type { RuntimeChatMessage } from '@agenter/client-sdk';

import RuntimeHeartbeatMessage from './runtime-heartbeat-message.svelte';

const baseTimestamp = Date.UTC(2026, 3, 12, 14, 25, 0);

const assistantMessage = {
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
} satisfies RuntimeChatMessage;

const meta = {
	title: 'Features/Runtime/Heartbeat Message',
	component: RuntimeHeartbeatMessage,
	render: (args) => ({
		Component: RuntimeHeartbeatMessage,
		props: args,
	}),
} satisfies Meta<typeof RuntimeHeartbeatMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AssistantHeartbeatMessageShowsAttachmentsAndToolState = {
	name: 'Scenario: Given an assistant heartbeat row When rendering attachments and tool metadata Then the primitive keeps the ledger message readable without owning scroll layout',
	args: {
		message: assistantMessage,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText('Gathered workspace metadata and queued the next attention follow-up.'),
		).toBeInTheDocument();
		await expect(canvas.getByText('workspace-summary.json')).toBeInTheDocument();
		await expect(canvas.getByText(/workspace\.exec · success/u)).toBeInTheDocument();
	},
} satisfies Story;
