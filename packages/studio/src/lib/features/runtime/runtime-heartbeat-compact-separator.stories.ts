import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, within } from 'storybook/test';

import type { RuntimeChatMessage } from '@agenter/client-sdk';

import RuntimeHeartbeatCompactSeparator from './runtime-heartbeat-compact-separator.svelte';

const separatorMessage = {
	id: 'heartbeat-compact-1',
	role: 'system',
	content: 'Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.',
	timestamp: Date.UTC(2026, 3, 12, 14, 25, 25),
	format: 'plain',
	heartbeatKind: 'compact_separator',
	compactTrigger: 'manual',
} satisfies RuntimeChatMessage;

const meta = {
	title: 'Features/Runtime/Heartbeat Compact Separator',
	component: RuntimeHeartbeatCompactSeparator,
	render: (args) => ({
		Component: RuntimeHeartbeatCompactSeparator,
		props: args,
	}),
} satisfies Meta<typeof RuntimeHeartbeatCompactSeparator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CompactBoundaryRendersAsCenteredSeparator = {
	name: 'Scenario: Given a compact heartbeat boundary When rendering the separator Then the stream shows a centered context reset marker',
	args: {
		message: separatorMessage,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Context compacted')).toBeInTheDocument();
		await expect(
			canvas.getByText('Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.'),
		).toBeInTheDocument();
	},
} satisfies Story;
