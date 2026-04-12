<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import type { RuntimeChatMessage } from '@agenter/client-sdk';

	import RuntimeHeartbeatMessage from './runtime-heartbeat-message.svelte';

	const { Story } = defineMeta({
		title: 'Features/Runtime/Heartbeat Message',
		component: RuntimeHeartbeatMessage,
	});

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
</script>

<script lang="ts">
	import { expect, within } from 'storybook/test';
</script>

<Story
	name="Scenario: Given an assistant heartbeat row When rendering attachments and tool metadata Then the primitive keeps the ledger message readable without owning scroll layout"
	exportName="AssistantHeartbeatMessageShowsAttachmentsAndToolState"
	args={{ message: assistantMessage }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Gathered workspace metadata and queued the next attention follow-up.')).toBeInTheDocument();
		await expect(canvas.getByText('workspace-summary.json')).toBeInTheDocument();
		await expect(canvas.getByText(/workspace\.exec · success/u)).toBeInTheDocument();
	}}
>
	<div class="max-w-4xl rounded-[1.35rem] border border-border/70 bg-background p-4">
		<RuntimeHeartbeatMessage message={assistantMessage} />
	</div>
</Story>
