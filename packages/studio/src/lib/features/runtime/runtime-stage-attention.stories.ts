import type {
	MessageChannelEntry,
	RuntimeSnapshotEntry,
	SessionNotificationItem,
} from '@agenter/client-sdk';
import type { Meta, StoryObj } from '@storybook/sveltekit';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import RuntimeStageAttentionStoryHarness from './runtime-stage-attention.story-harness.svelte';

const baseTimestamp = Date.UTC(2026, 3, 16, 9, 30, 0);

const attentionScores = (scores: Record<string, number>): Record<string, number> => scores;

const channels: MessageChannelEntry[] = [
	{
		chatId: 'room-main',
		kind: 'room',
		title: 'Main room',
		owner: 'message-system',
		contextId: 'ctx-room-main',
		participants: [],
		metadata: {},
		createdAt: baseTimestamp,
		updatedAt: baseTimestamp + 1_000,
		focused: true,
		roomRevision: '0',
		transcriptRevision: '0',
		accessRole: 'admin',
		accessToken: 'room-main-token',
	},
	{
		chatId: 'room-side',
		kind: 'room',
		title: 'Relay room',
		owner: 'message-system',
		contextId: 'ctx-room-side',
		participants: [],
		metadata: {},
		createdAt: baseTimestamp,
		updatedAt: baseTimestamp + 2_000,
		focused: false,
		roomRevision: '0',
		transcriptRevision: '0',
		accessRole: 'admin',
		accessToken: 'room-side-token',
	},
] ;

const notifications: SessionNotificationItem[] = [
	{
		id: 'notification-terminal',
		sessionId: 'session-attention',
		src: 'tty:terminal-main/91',
		sourceNamespace: 'tty',
		sourceId: 'terminal-main',
		bucketKey: 'tty:terminal-main',
		attentionContextId: 'ctx-terminal-terminal-main',
		attentionCommitId: 'commit-terminal-main-1',
		workspacePath: '/repo/agenter',
		sessionName: 'attention-demo',
		content: 'Terminal finished a build and is ready for the next explicit step.',
		timestamp: baseTimestamp + 7_000,
	},
	{
		id: 'notification-room-side',
		sessionId: 'session-attention',
		src: 'msg:room-side/12',
		sourceNamespace: 'msg',
		sourceId: 'room-side',
		bucketKey: 'msg:room-side',
		attentionContextId: 'ctx-room-side',
		attentionCommitId: 'commit-room-side-1',
		workspacePath: '/repo/agenter',
		sessionName: 'attention-demo',
		content: 'Relay room received a queued follow-up for later handling.',
		timestamp: baseTimestamp + 6_000,
	},
] ;

const runtime: RuntimeSnapshotEntry = {
	sessionId: 'session-attention',
	started: true,
	activityState: 'idle',
	schedulerPhase: 'waiting_commits',
	stage: 'idle',
	focusedTerminalId: 'terminal-main',
	focusedTerminalIds: ['terminal-main'],
	chatMessages: [],
	messageChannels: channels,
	terminalSnapshots: {},
	terminalReads: {},
	terminals: [
		{
			terminalId: 'terminal-main',
			status: 'IDLE',
			processPhase: 'running',
			lifecycleTransition: null,
			seq: 42,
			launchCwd: '/repo/agenter',
			configuredTitle: 'Main shell',
			currentTitle: 'Main shell',
			currentPath: '/repo/agenter',
			lastStopReason: null,
			lastExitCode: null,
			lastExitSignal: null,
			lastStoppedAt: null,
		},
	],
	tasks: [],
	schedulerState: {
		schemaVersion: 2,
		stateVersion: 1,
		running: true,
		paused: false,
		runtimeStatus: 'idle',
		phase: 'waiting_commits',
		gate: 'open',
		queueSize: 2,
		cycle: 18,
		sentBatches: 4,
		updatedAt: baseTimestamp + 8_000,
		lastMessageAt: baseTimestamp + 4_000,
		lastResponseAt: baseTimestamp + 5_000,
		lastWakeAt: baseTimestamp + 8_000,
		lastWakeSource: 'attention',
		lastWakeCause: 'ready_now',
		activeContextCount: 2,
		activeItemCount: 3,
		unresolvedScoreCount: 2,
		waitingReason: 'attention_idle',
		nextAutoWakeAt: baseTimestamp + 30_000,
		backoffMs: null,
		retryCount: 0,
		blockedReason: null,
		lastProgressAt: baseTimestamp + 5_000,
		lastError: null,
	},
	attention: {
		snapshot: {
			contexts: [
				{
					contextId: 'ctx-room-main',
					owner: 'message',
					focusState: 'focused',
					content: 'Main room needs a direct answer about the runtime cleanup.',
					headCommitId: 'commit-room-main-2',
					createdAt: new Date(baseTimestamp + 2_000).toISOString(),
					updatedAt: new Date(baseTimestamp + 8_000).toISOString(),
						scoreMap: attentionScores({ room: 7, follow_up: 2 }),
					consumedPushCommitIds: [],
					commits: [
						{
								commitId: 'commit-room-main-1',
								contextId: 'ctx-room-main',
								ingressType: 'commit',
								contextMutation: 'apply',
								parentCommitIds: [],
							meta: {
								author: 'auth:user-main',
								source: 'message',
								src: 'msg:room-main/10',
							},
								scores: attentionScores({ room: 5 }),
							summary: 'Question arrived in Main room',
							change: {
								type: 'update',
								value: 'Can you explain why the backend did not convert this room message into an AttentionItem?',
							},
							createdAt: new Date(baseTimestamp + 2_000).toISOString(),
						},
						{
								commitId: 'commit-room-main-2',
								contextId: 'ctx-room-main',
								ingressType: 'commit',
								contextMutation: 'apply',
								parentCommitIds: ['commit-room-main-1'],
							meta: {
								author: 'runtime-watch',
								source: 'watch',
								src: 'watch:room-main',
							},
								scores: attentionScores({ follow_up: 2 }),
							summary: 'Reminder reopened the same room decision',
							change: {
								type: 'update',
								value: 'The generic watch expired and asked the model to re-decide without mutating the room.',
							},
							createdAt: new Date(baseTimestamp + 8_000).toISOString(),
						},
					],
					commitCount: 2,
					commitsTruncated: false,
				},
				{
					contextId: 'ctx-room-side',
					owner: 'message',
					focusState: 'background',
					content: 'Relay room still has a queued notification.',
					headCommitId: 'commit-room-side-1',
					createdAt: new Date(baseTimestamp + 3_000).toISOString(),
					updatedAt: new Date(baseTimestamp + 6_000).toISOString(),
						scoreMap: attentionScores({ relay: 3 }),
					consumedPushCommitIds: [],
					commits: [
						{
								commitId: 'commit-room-side-1',
								contextId: 'ctx-room-side',
								ingressType: 'commit',
								contextMutation: 'apply',
								parentCommitIds: [],
							meta: {
								author: 'auth:user-relay',
								source: 'message',
								src: 'msg:room-side/12',
							},
								scores: attentionScores({ relay: 3 }),
							summary: 'Relay room queued a later follow-up',
							change: {
								type: 'update',
								value: 'This room is present as a queued push, not a platform-authored reply obligation.',
							},
							createdAt: new Date(baseTimestamp + 6_000).toISOString(),
						},
					],
					commitCount: 1,
					commitsTruncated: false,
				},
				{
					contextId: 'ctx-terminal-terminal-main',
					owner: 'terminal',
					focusState: 'background',
					content: 'The terminal finished the latest command and exposed await evidence.',
					headCommitId: 'commit-terminal-main-1',
					createdAt: new Date(baseTimestamp + 4_000).toISOString(),
					updatedAt: new Date(baseTimestamp + 7_000).toISOString(),
						scoreMap: attentionScores({ terminal: 4 }),
					consumedPushCommitIds: [],
					commits: [
						{
								commitId: 'commit-terminal-main-1',
								contextId: 'ctx-terminal-terminal-main',
								ingressType: 'commit',
								contextMutation: 'apply',
								parentCommitIds: [],
							meta: {
								author: 'terminal',
								source: 'terminal',
								src: 'tty:terminal-main/91',
							},
								scores: attentionScores({ terminal: 4 }),
							summary: 'Terminal await returned deterministic output',
							change: {
								type: 'update',
								value: 'The latest build finished and the terminal is ready for a fresh explicit command.',
							},
							createdAt: new Date(baseTimestamp + 7_000).toISOString(),
						},
					],
					commitCount: 1,
					commitsTruncated: false,
				},
			],
		},
		active: [
			{
				contextId: 'ctx-room-main',
				context: {
					contextId: 'ctx-room-main',
					owner: 'message',
					focusState: 'focused',
					content: 'Main room needs a direct answer about the runtime cleanup.',
					headCommitId: 'commit-room-main-2',
					createdAt: new Date(baseTimestamp + 2_000).toISOString(),
					updatedAt: new Date(baseTimestamp + 8_000).toISOString(),
						scoreMap: attentionScores({ room: 7, follow_up: 2 }),
					consumedPushCommitIds: [],
				},
				recentCommits: [
					{
							commitId: 'commit-room-main-2',
							contextId: 'ctx-room-main',
							ingressType: 'commit',
							contextMutation: 'apply',
							parentCommitIds: ['commit-room-main-1'],
						meta: {
							author: 'runtime-watch',
							source: 'watch',
							src: 'watch:room-main',
						},
							scores: attentionScores({ follow_up: 2 }),
						summary: 'Reminder reopened the same room decision',
						change: {
							type: 'update',
							value: 'The generic watch expired and asked the model to re-decide without mutating the room.',
						},
						createdAt: new Date(baseTimestamp + 8_000).toISOString(),
					},
					{
							commitId: 'commit-room-main-1',
							contextId: 'ctx-room-main',
							ingressType: 'commit',
							contextMutation: 'apply',
							parentCommitIds: [],
						meta: {
							author: 'auth:user-main',
							source: 'message',
							src: 'msg:room-main/10',
						},
							scores: attentionScores({ room: 5 }),
						summary: 'Question arrived in Main room',
						change: {
							type: 'update',
							value: 'Can you explain why the backend did not convert this room message into an AttentionItem?',
						},
						createdAt: new Date(baseTimestamp + 2_000).toISOString(),
					},
				],
			},
		],
		cycleFrames: [],
		hooks: [
			{
				id: 'hook-room-main-1',
				cycleId: 18,
				hookId: 'builtin-message-bridge',
				bridgeId: 'message',
				contextId: 'ctx-room-main',
				commitId: 'commit-room-main-2',
				status: 'delivered',
				createdAt: baseTimestamp + 8_500,
			},
		],
	},
	attentionDelivery: {
		projections: [
			{
				contextId: 'ctx-room-main',
				commitId: 'commit-room-main-2',
				state: 'completed',
				attemptCount: 1,
				latestDispatchId: 'dispatch-room-main-1',
				latestReceiptId: 'receipt-room-main-1',
				agentCallId: 'agent-call-room-main',
				sessionModelCallId: 118,
				firstAcceptedAt: baseTimestamp + 8_800,
				latestReceiptAt: baseTimestamp + 9_400,
				latestError: null,
			},
		],
		dispatches: [
			{
				dispatchId: 'dispatch-room-main-1',
				contextId: 'ctx-room-main',
				commitId: 'commit-room-main-2',
				cycleId: 18,
				attemptIndex: 1,
				agentCallId: 'agent-call-room-main',
				sessionModelCallId: 118,
				createdAt: baseTimestamp + 8_600,
			},
		],
		receipts: [
			{
				receiptId: 'receipt-room-main-1',
				dispatchId: 'dispatch-room-main-1',
				contextId: 'ctx-room-main',
				commitId: 'commit-room-main-2',
				cycleId: 18,
				attemptIndex: 1,
				agentCallId: 'agent-call-room-main',
				sessionModelCallId: 118,
				status: 'completed',
				providerEventKind: 'run_finished',
				timestamp: baseTimestamp + 9_400,
				finishReason: 'stop',
			},
		],
		watches: [
			{
				id: 1,
				watchId: 'watch-room-main',
				ownerActionId: 'action-watch-room-main',
				ownerActionKind: 'message_follow_up',
				ownerActorId: 'assistant',
				ownerCycleId: 17,
				ownerSessionModelCallId: 117,
				target: 'room:room-main',
				predicate: {
					kind: 'message_latest_visible',
					chatId: 'room-main',
					anchorMessageId: 10,
				},
				dueAt: baseTimestamp + 8_000,
				status: 'expired',
				createdAt: baseTimestamp + 4_500,
				updatedAt: baseTimestamp + 8_100,
				resolvedAt: baseTimestamp + 8_100,
				reminderContextId: 'ctx-room-main',
				reminderCommitId: 'commit-room-main-2',
				meta: {
					compatibilityAlias: 'followUpAfterMs',
				},
			},
		],
		effects: [
			{
				id: 1,
				effectId: 'effect-room-main-1',
				actionId: 'action-message-send-room-main',
				actionKind: 'message_send',
				actorId: 'assistant',
				cycleId: 18,
				sessionModelCallId: 118,
				target: 'room:room-main',
				effectKind: 'message_row_created',
				effectRecordId: 'room-main/11',
				timestamp: baseTimestamp + 9_300,
				meta: {
					chatId: 'room-main',
					messageId: 11,
					contextId: 'ctx-room-main',
					commitId: 'commit-room-main-2',
				},
			},
		],
	},
	schedulerSignals: {
		user: { version: 0, timestamp: null },
		terminal: { version: 2, timestamp: baseTimestamp + 7_000 },
		task: { version: 0, timestamp: null },
		attention: { version: 5, timestamp: baseTimestamp + 8_000 },
	},
	apiCallRecording: {
		enabled: false,
		refCount: 0,
	},
	attentionApi: {
		baseUrl: 'http://127.0.0.1:4040/runtime',
		principalId: 'principal-demo',
	},
	modelCapabilities: {
		streaming: true,
		tools: true,
		imageInput: false,
		nativeCompact: false,
		summarizeFallback: true,
		fileUpload: false,
		mcpCatalog: false,
	},
	activeCycle: null,
};

const meta = {
	title: 'Features/Runtime/Attention Stage',
	component: RuntimeStageAttentionStoryHarness,
	render: (args) => ({
		Component: RuntimeStageAttentionStoryHarness,
		props: args,
	}),
} satisfies Meta<typeof RuntimeStageAttentionStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DeliveryLedgerShowsObjectiveFacts = {
	name: 'Scenario: Given room attention with a watch reminder and explicit effect When the stage renders Then delivery facts stay separate from queued pushes and scheduler metadata',
	args: {
		runtime,
		channels,
		notifications,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByTestId('runtime-attention-selected-context')).toHaveTextContent('Main room');
		await expect(canvas.getByTestId('runtime-attention-delivery-ledger')).toHaveTextContent('Current projection');
		await expect(canvas.getByTestId('runtime-attention-delivery-ledger')).toHaveTextContent('completed');
		await expect(canvas.getByTestId('runtime-attention-delivery-effects')).toHaveTextContent('message_row_created');
		await expect(canvas.getByTestId('runtime-attention-delivery-watches')).toHaveTextContent(
			'message_latest_visible',
		);
		await expect(canvas.getByTestId('runtime-attention-queue')).toHaveTextContent(
			'Relay room received a queued follow-up for later handling.',
		);
	},
} satisfies Story;

export const QueueActionsStayExplicitInCompactViewport = {
	name: 'Scenario: Given the compact runtime attention stage When a queued terminal push is promoted Then visibility and open actions stay explicit on mobile',
	args: {
		frameClass: 'h-[58rem] w-[390px] max-w-full',
		runtime,
		channels,
		notifications,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(
			canvas.getByRole('button', {
				name: /Terminal finished a build and is ready for the next explicit step\./i,
			}),
		);
		await userEvent.click(canvas.getByRole('button', { name: 'Promote and open' }));

		await waitFor(() => {
			expect(canvas.getByTestId('runtime-attention-terminal-visibility')).toHaveTextContent(
				'terminal-main:focused',
			);
		});
		await expect(canvas.getByTestId('runtime-attention-opened-terminals')).toHaveTextContent('terminal-main');
	},
} satisfies Story;
