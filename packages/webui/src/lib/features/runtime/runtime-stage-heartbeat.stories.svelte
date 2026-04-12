<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import type { RuntimeChatMessage } from '@agenter/client-sdk';

	import RuntimeStageHeartbeatStoryHarness from './runtime-stage-heartbeat.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Runtime/Heartbeat Stage',
		component: RuntimeStageHeartbeatStoryHarness,
	});

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
</script>

<script lang="ts">
	import { expect, userEvent, within } from 'storybook/test';
</script>

<Story
	name="Scenario: Given persisted heartbeat rows When older history is loaded Then message primitives stay stable while the virtual list owns scrolling"
	exportName="LoadingOlderKeepsHeartbeatRowsStable"
	args={{ initialMessages, olderMessages }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const stage = canvas.getByTestId('runtime-heartbeat-stage');

		await expect(stage).toBeInTheDocument();
		await expect(canvas.getByText('Summarize the current workspace grants before the next loop.')).toBeInTheDocument();
		await expect(canvas.getByText('Gathered workspace metadata and queued the next attention follow-up.')).toBeInTheDocument();
		await expect(canvas.getByText('workspace.exec')).toBeInTheDocument();
		await expect(canvas.getByText('workspace-summary.json')).toBeInTheDocument();

		await userEvent.click(canvas.getByRole('button', { name: 'Load older' }));
		await expect(canvas.getByText('Load the previous checkpoint before you continue.')).toBeInTheDocument();
		await expect(canvas.getByRole('button', { name: 'History loaded' })).toBeDisabled();
	}}
/>
