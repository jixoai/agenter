<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import TerminalSystemSurface from './terminal-system-surface.svelte';

	const { Story } = defineMeta({
		title: 'Features/Terminals/TerminalSystemSurface',
		component: TerminalSystemSurface,
	});
</script>

<script lang="ts">
	import type {
		CachedResourceState,
		GlobalTerminalApprovalRequest,
		GlobalTerminalEntry,
		GlobalTerminalGrantEntry,
		TerminalActivityItem,
	} from '@agenter/client-sdk';
	import { expect, userEvent, waitFor, within } from 'storybook/test';

	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';

	import type {
		TerminalSystemCallAsOption,
		TerminalSystemNotice,
		TerminalSystemSeatState,
	} from './terminal-system-surface.types';

	const actorCatalog: ActorDirectoryEntry[] = [
		{
			actorId: 'auth:wallet_evm',
			actorKind: 'auth',
			label: 'Wallet Operator',
			subtitle: 'auth:wallet_evm',
			iconUrl: null,
		},
		{
			actorId: 'auth:observer',
			actorKind: 'auth',
			label: 'Observer',
			subtitle: 'auth:observer',
			iconUrl: null,
		},
		{
			actorId: 'session:reviewer',
			actorKind: 'session',
			label: 'Reviewer Session',
			subtitle: '/repo/reviewer',
			iconUrl: null,
		},
	];

	const createTerminalEntry = (input: {
		terminalId: string;
		title: string;
		cwd: string;
		seatCount: number;
		pendingRequestCount: number;
	}): GlobalTerminalEntry => ({
		terminalId: input.terminalId,
		processKind: 'shell',
		command: ['/bin/bash'],
		cwd: input.cwd,
		workspace: null,
		running: true,
		status: 'IDLE',
		seq: 1,
		snapshot: {
			seq: 1,
			timestamp: 1_710_000_000_000,
			cols: 80,
			rows: 24,
			lines: Array.from({ length: 24 }, () => ''),
			cursor: { x: 0, y: 0 },
		},
		focused: false,
		icon: undefined,
		title: input.title,
		shortcuts: undefined,
		rendererEngine: 'xterm',
		transportUrl: `ws://127.0.0.1:7777/pty/${input.terminalId}?token=token:${input.terminalId}:admin`,
		currentAdminId: 'system:trusted-terminal-bootstrap',
		approvalTimeoutMs: 90_000,
		pendingRequestCount: input.pendingRequestCount,
		access: {
			role: 'admin',
			accessToken: `token:${input.terminalId}:admin`,
			participantId: 'system:trusted-terminal-bootstrap',
			currentAdmin: true,
		},
		actors: input.seatCount > 0
			? [
					{
						actorId: 'session:reviewer',
						role: 'writer',
						label: 'Reviewer Session',
						currentAdmin: false,
						adminCandidateRank: 1,
						online: true,
						focused: false,
						invalidCredential: false,
					},
				]
			: [],
	});

	const initialTerminalId = 'term-story';
	const terminalFallbackActor = (actorId: string) => actorCatalog.find((actor) => actor.actorId === actorId);

	let terminalCounter = $state(1);
	let activityCounter = $state(2);
	let selectedTerminalId = $state(initialTerminalId);
	let routeNotice = $state<TerminalSystemNotice | null>(null);
	let selectedCallerTokenByTerminalId = $state<Record<string, string>>({
		[initialTerminalId]: `token:${initialTerminalId}:admin`,
	});
	let terminalsState = $state<CachedResourceState<GlobalTerminalEntry[]>>({
		data: [
			createTerminalEntry({
				terminalId: initialTerminalId,
				title: 'Ops terminal',
				cwd: '/repo/ops',
				seatCount: 1,
				pendingRequestCount: 0,
			}),
		],
		loaded: true,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: 1_710_000_000_000,
	});
	let terminalGrantsById = $state<Record<string, GlobalTerminalGrantEntry[]>>({
		[initialTerminalId]: [
			{
				grantId: 'grant-reviewer',
				terminalId: initialTerminalId,
				role: 'writer',
				label: 'Reviewer Session',
				participantId: 'session:reviewer',
				accessToken: `token:${initialTerminalId}:reviewer`,
				createdAt: 1_710_000_000_100,
			},
		],
	});
	let terminalApprovalsById = $state<Record<string, GlobalTerminalApprovalRequest[]>>({
		[initialTerminalId]: [],
	});
	let terminalActivityById = $state<Record<string, TerminalActivityItem[]>>({
		[initialTerminalId]: [
			{
				id: 1,
				terminalId: initialTerminalId,
				createdAt: 1_710_000_000_100,
				kind: 'terminal_write',
				cycleId: null,
				actorId: 'system:trusted-terminal-bootstrap',
				title: 'Terminal write + submit',
				content: 'echo bootstrap',
				detail: { submit: true, submitKey: 'enter' },
			},
		],
	});
	let terminalSeatStatesById = $state<Record<string, TerminalSystemSeatState[]>>({
		[initialTerminalId]: [
			{
				actorId: 'system:trusted-terminal-bootstrap',
				actorKind: 'system',
				label: 'Bootstrap admin',
				subtitle: 'System seat',
				iconUrl: null,
				role: 'admin',
				currentAdmin: true,
				online: true,
				focused: false,
				invalidCredential: false,
				accessToken: `token:${initialTerminalId}:admin`,
			},
			{
				actorId: 'session:reviewer',
				actorKind: 'session',
				label: 'Reviewer Session',
				subtitle: '/repo/reviewer',
				iconUrl: null,
				role: 'writer',
				currentAdmin: false,
				online: true,
				focused: false,
				invalidCredential: false,
				accessToken: `token:${initialTerminalId}:reviewer`,
				grantId: 'grant-reviewer',
				adminCandidateRank: 1,
			},
		],
	});

	const selectedTerminal = $derived(terminalsState.data.find((terminal) => terminal.terminalId === selectedTerminalId) ?? null);
	const terminalGrantsState = $derived<CachedResourceState<GlobalTerminalGrantEntry[]>>({
		data: terminalGrantsById[selectedTerminalId] ?? [],
		loaded: true,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: Date.now(),
	});
	const terminalApprovalsState = $derived<CachedResourceState<GlobalTerminalApprovalRequest[]>>({
		data: terminalApprovalsById[selectedTerminalId] ?? [],
		loaded: true,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: Date.now(),
	});
	const terminalActivityState = $derived<CachedResourceState<TerminalActivityItem[]>>({
		data: terminalActivityById[selectedTerminalId] ?? [],
		loaded: true,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: Date.now(),
	});
	const seatStates = $derived(terminalSeatStatesById[selectedTerminalId] ?? []);
	const callAsOptions = $derived.by(() => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return [] as TerminalSystemCallAsOption[];
		}
		return [
			{
				accessToken: terminal.access?.accessToken ?? `token:${terminal.terminalId}:admin`,
				participantId: terminal.access?.participantId,
				role: terminal.access?.role ?? 'admin',
				label: 'Bootstrap admin',
			},
			...(terminalGrantsById[terminal.terminalId] ?? [])
				.filter((grant) => Boolean(grant.accessToken))
				.map((grant) => ({
					accessToken: grant.accessToken ?? '',
					participantId: grant.participantId,
					role: grant.role,
					label: grant.label ?? terminalFallbackActor(grant.participantId ?? '')?.label ?? grant.participantId ?? grant.grantId,
				})),
		].filter((option) => option.accessToken);
	});
	const selectedCallerToken = $derived(
		selectedCallerTokenByTerminalId[selectedTerminalId] ?? callAsOptions[0]?.accessToken ?? null,
	);

	const updateTerminalEntry = (terminalId: string, updater: (terminal: GlobalTerminalEntry) => GlobalTerminalEntry): void => {
		terminalsState = {
			...terminalsState,
			data: terminalsState.data.map((terminal) => (terminal.terminalId === terminalId ? updater(terminal) : terminal)),
			refreshedAt: Date.now(),
		};
	};

	const syncSeatFacts = (terminalId: string): void => {
		const seats = terminalSeatStatesById[terminalId] ?? [];
		const approvals = terminalApprovalsById[terminalId] ?? [];
		updateTerminalEntry(terminalId, (terminal) => ({
			...terminal,
			actors: seats
				.filter((seat) => seat.actorId !== 'system:trusted-terminal-bootstrap')
				.map((seat) => ({
					actorId: seat.actorId as `auth:${string}` | `session:${string}` | `system:${string}`,
					role: seat.role,
					label: seat.label,
					currentAdmin: seat.currentAdmin,
					adminCandidateRank: seat.adminCandidateRank,
					online: seat.online,
					focused: seat.focused,
					invalidCredential: seat.invalidCredential,
					leaseExpiresAt: seat.leaseExpiresAt,
				})),
			pendingRequestCount: approvals.length,
		}));
	};

	const appendActivity = (terminalId: string, input: Omit<TerminalActivityItem, 'id'>): void => {
		activityCounter += 1;
		terminalActivityById = {
			...terminalActivityById,
			[terminalId]: [
				...(terminalActivityById[terminalId] ?? []),
				{
					id: activityCounter,
					...input,
				},
			],
		};
	};

	const handleSelectTerminal = (terminalId: string): void => {
		selectedTerminalId = terminalId;
		routeNotice = null;
	};

	const handleChangeCallerToken = (accessToken: string): void => {
		selectedCallerTokenByTerminalId = {
			...selectedCallerTokenByTerminalId,
			[selectedTerminalId]: accessToken,
		};
	};

	const handleCreateTerminal = async (input: {
		terminalId?: string;
		processKind?: string;
		cwd?: string;
	}): Promise<void> => {
		terminalCounter += 1;
		const terminalId = input.terminalId ?? `term-story-${terminalCounter}`;
		terminalsState = {
			...terminalsState,
			data: [
				createTerminalEntry({
					terminalId,
					title: `Story terminal ${terminalCounter}`,
					cwd: input.cwd ?? `/repo/story-${terminalCounter}`,
					seatCount: 0,
					pendingRequestCount: 0,
				}),
				...terminalsState.data,
			],
			refreshedAt: Date.now(),
		};
		terminalGrantsById = {
			...terminalGrantsById,
			[terminalId]: [],
		};
		terminalApprovalsById = {
			...terminalApprovalsById,
			[terminalId]: [],
		};
		terminalActivityById = {
			...terminalActivityById,
			[terminalId]: [],
		};
		terminalSeatStatesById = {
			...terminalSeatStatesById,
			[terminalId]: [
				{
					actorId: 'system:trusted-terminal-bootstrap',
					actorKind: 'system',
					label: 'Bootstrap admin',
					subtitle: 'System seat',
					iconUrl: null,
					role: 'admin',
					currentAdmin: true,
					online: true,
					focused: false,
					invalidCredential: false,
					accessToken: `token:${terminalId}:admin`,
				},
			],
		};
		selectedCallerTokenByTerminalId = {
			...selectedCallerTokenByTerminalId,
			[terminalId]: `token:${terminalId}:admin`,
		};
		selectedTerminalId = terminalId;
	};

	const handleDeleteTerminal = async (): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		terminalsState = {
			...terminalsState,
			data: terminalsState.data.filter((entry) => entry.terminalId !== terminal.terminalId),
			refreshedAt: Date.now(),
		};
		selectedTerminalId = terminalsState.data[0]?.terminalId ?? '';
	};

	const handleGrantSeat = async (input: {
		participantId: string;
		role: 'admin' | 'writer' | 'requester' | 'readonly';
	}): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		const actor = terminalFallbackActor(input.participantId);
		const grantId = `${terminal.terminalId}:grant:${input.participantId}`;
		terminalGrantsById = {
			...terminalGrantsById,
			[terminal.terminalId]: [
				...(terminalGrantsById[terminal.terminalId] ?? []).filter((grant) => grant.participantId !== input.participantId),
				{
					grantId,
					terminalId: terminal.terminalId,
					role: input.role,
					label: actor?.label,
					participantId: input.participantId as `auth:${string}` | `session:${string}` | `system:${string}`,
					accessToken: `token:${terminal.terminalId}:${input.participantId}`,
					createdAt: Date.now(),
				},
			],
		};
		terminalSeatStatesById = {
			...terminalSeatStatesById,
			[terminal.terminalId]: [
				...(terminalSeatStatesById[terminal.terminalId] ?? []).filter((seat) => seat.actorId !== input.participantId),
				{
					actorId: input.participantId,
					actorKind: actor?.actorKind ?? 'auth',
					label: actor?.label ?? input.participantId,
					subtitle: actor?.subtitle ?? input.participantId,
					iconUrl: actor?.iconUrl ?? null,
					role: input.role,
					currentAdmin: false,
					online: false,
					focused: false,
					invalidCredential: false,
					accessToken: `token:${terminal.terminalId}:${input.participantId}`,
					grantId,
				},
			],
		};
		syncSeatFacts(terminal.terminalId);
	};

	const handleToggleSeatFocus = async (input: {
		actorId: string;
		accessToken: string;
		focused: boolean;
	}): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		terminalSeatStatesById = {
			...terminalSeatStatesById,
			[terminal.terminalId]: (terminalSeatStatesById[terminal.terminalId] ?? []).map((seat) =>
				seat.actorId === input.actorId
					? {
							...seat,
							focused: !input.focused,
						}
					: seat,
			),
		};
		syncSeatFacts(terminal.terminalId);
	};

	const handleRevokeSeat = async (input: { actorId: string; grantId: string }): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		terminalGrantsById = {
			...terminalGrantsById,
			[terminal.terminalId]: (terminalGrantsById[terminal.terminalId] ?? []).filter((grant) => grant.grantId !== input.grantId),
		};
		terminalSeatStatesById = {
			...terminalSeatStatesById,
			[terminal.terminalId]: (terminalSeatStatesById[terminal.terminalId] ?? []).filter((seat) => seat.grantId !== input.grantId),
		};
		syncSeatFacts(terminal.terminalId);
	};

	const handleApproveRequest = async (input: { requestId: string; durationMs?: number }): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		const request = (terminalApprovalsById[terminal.terminalId] ?? []).find((approval) => approval.requestId === input.requestId);
		if (!request) {
			return;
		}
		terminalApprovalsById = {
			...terminalApprovalsById,
			[terminal.terminalId]: (terminalApprovalsById[terminal.terminalId] ?? []).filter((approval) => approval.requestId !== input.requestId),
		};
		terminalSeatStatesById = {
			...terminalSeatStatesById,
			[terminal.terminalId]: (terminalSeatStatesById[terminal.terminalId] ?? []).map((seat) =>
				seat.actorId === request.participantId
					? {
							...seat,
							leaseExpiresAt: Date.now() + (input.durationMs ?? 30 * 60 * 1000),
						}
					: seat,
			),
		};
		routeNotice = null;
		syncSeatFacts(terminal.terminalId);
	};

	const handleDenyRequest = async (input: { requestId: string }): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		terminalApprovalsById = {
			...terminalApprovalsById,
			[terminal.terminalId]: (terminalApprovalsById[terminal.terminalId] ?? []).filter((approval) => approval.requestId !== input.requestId),
		};
		routeNotice = {
			tone: 'warning',
			message: `Denied ${input.requestId}`,
		};
		syncSeatFacts(terminal.terminalId);
	};

	const handleWriteToolCall = async (input: { text: string }) => {
		const terminal = selectedTerminal;
		const caller = callAsOptions.find((option) => option.accessToken === selectedCallerToken);
		if (!terminal || !caller) {
			return;
		}
		const lease = (terminalSeatStatesById[terminal.terminalId] ?? []).find((seat) => seat.actorId === caller.participantId)
			?.leaseExpiresAt;
		if (caller.role === 'requester' && (!lease || lease <= Date.now())) {
			const requestId = `approval-${Date.now()}`;
			terminalApprovalsById = {
				...terminalApprovalsById,
				[terminal.terminalId]: [
					...(terminalApprovalsById[terminal.terminalId] ?? []),
					{
						requestId,
						terminalId: terminal.terminalId,
						participantId: caller.participantId as `auth:${string}` | `session:${string}` | `system:${string}`,
						assignedAdminId: 'system:trusted-terminal-bootstrap',
						status: 'pending',
						requestedInput: {
							text: input.text,
							submit: true,
							submitKey: 'enter',
						},
						createdAt: Date.now(),
						expiresAt: Date.now() + 90_000,
					},
				],
			};
			routeNotice = {
				tone: 'warning',
				message: `Write approval requested: ${requestId}`,
			};
			syncSeatFacts(terminal.terminalId);
			return {
				approvalRequested: true,
				message: requestId,
			};
		}
		appendActivity(terminal.terminalId, {
			terminalId: terminal.terminalId,
			createdAt: Date.now(),
			kind: 'terminal_write',
			cycleId: null,
			actorId: caller.participantId ?? 'system:trusted-terminal-bootstrap',
			title: 'Terminal write + submit',
			content: input.text,
			detail: {
				submit: true,
				submitKey: 'enter',
			},
		});
		routeNotice = null;
		return {
			approvalRequested: false,
		};
	};

	const handleReadToolCall = async (input: { mode: 'auto' | 'diff' | 'snapshot' }): Promise<void> => {
		const terminal = selectedTerminal;
		const caller = callAsOptions.find((option) => option.accessToken === selectedCallerToken);
		if (!terminal || !caller) {
			return;
		}
		appendActivity(terminal.terminalId, {
			terminalId: terminal.terminalId,
			createdAt: Date.now(),
			kind: 'terminal_read',
			cycleId: null,
			actorId: caller.participantId ?? 'system:trusted-terminal-bootstrap',
			title: 'Terminal read',
			content: JSON.stringify(
				{
					kind: input.mode === 'diff' ? 'terminal-diff' : 'terminal-snapshot',
					terminalId: terminal.terminalId,
				},
				null,
				2,
			),
			detail: {
				representation: input.mode,
			},
		});
		routeNotice = null;
	};
</script>

<Story
	name="Scenario: Given a live terminal operator surface When requester access is granted and a lease is approved Then users and actions stay synchronized"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const requestedWrite = 'echo requester approval';
		const leasedWrite = 'echo requester after lease';
		await expect(canvas.getByRole('button', { name: /Select terminal Ops terminal/i })).toBeInTheDocument();

		await userEvent.click(canvas.getByRole('tab', { name: 'Users' }));
		await userEvent.selectOptions(canvas.getByLabelText('Grant actor'), 'auth:wallet_evm');
		await userEvent.selectOptions(canvas.getByLabelText('Grant role'), 'requester');
		await userEvent.click(canvas.getByRole('button', { name: 'Grant seat' }));

		await waitFor(async () => {
			await expect(canvas.getByTestId('terminal-seat-auth:wallet_evm')).toBeInTheDocument();
		});

		await userEvent.click(canvas.getByRole('tab', { name: 'Actions' }));
		await userEvent.selectOptions(canvas.getAllByLabelText('Call tool as')[0], `token:${initialTerminalId}:auth:wallet_evm`);
		await userEvent.type(canvas.getByPlaceholderText('Type terminal input…'), requestedWrite);
		await userEvent.click(canvas.getByRole('button', { name: 'Call tool' }));

		await waitFor(async () => {
			await expect(canvas.getByText(/Write approval requested:/)).toBeInTheDocument();
		});

		await userEvent.click(canvas.getByRole('tab', { name: 'Users' }));
		await waitFor(async () => {
			await expect(canvas.getByText('Pending approvals')).toBeInTheDocument();
		});
		await userEvent.click(canvas.getByRole('button', { name: 'Approve 30m' }));
		await waitFor(async () => {
			await expect(canvas.getByText(/Lease until/)).toBeInTheDocument();
		});

		await userEvent.click(canvas.getByRole('tab', { name: 'Actions' }));
		await userEvent.type(canvas.getByPlaceholderText('Type terminal input…'), leasedWrite);
		await userEvent.click(canvas.getByRole('button', { name: 'Call tool' }));
		await waitFor(async () => {
			await expect(canvas.getByText(leasedWrite)).toBeInTheDocument();
		});
	}}
>
	<div class="h-[54rem] w-full min-w-[76rem] bg-background">
		<TerminalSystemSurface
			{terminalsState}
			{selectedTerminalId}
			{selectedTerminal}
			{terminalGrantsState}
			{terminalApprovalsState}
			{terminalActivityState}
			{routeNotice}
			selectableActors={actorCatalog}
			{callAsOptions}
			{selectedCallerToken}
			{seatStates}
			onSelectTerminal={handleSelectTerminal}
			onChangeCallerToken={handleChangeCallerToken}
			onCreateTerminal={handleCreateTerminal}
			onDeleteTerminal={handleDeleteTerminal}
			onGrantSeat={handleGrantSeat}
			onToggleSeatFocus={handleToggleSeatFocus}
			onRevokeSeat={handleRevokeSeat}
			onApproveRequest={handleApproveRequest}
			onDenyRequest={handleDenyRequest}
			onWriteToolCall={handleWriteToolCall}
			onReadToolCall={handleReadToolCall}
		/>
	</div>
</Story>
