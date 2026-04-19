<script lang="ts">
	import type {
		CachedResourceState,
		GlobalTerminalApprovalRequest,
		GlobalTerminalActorId,
		GlobalTerminalEntry,
		GlobalTerminalGrantEntry,
		TerminalActivityItem,
	} from '@agenter/client-sdk';
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import {
		buildActorDirectory,
		buildActorDirectoryMap,
		fallbackActorLabel,
		isPrincipalActorId,
		resolveActorKind,
		type ActorDirectoryEntry,
	} from '$lib/features/collaboration/actor-directory';
	import TerminalViewHost from '$lib/components/terminal-view-host.svelte';

	import TerminalSystemSurface from './terminal-system-surface.svelte';
	import type {
		TerminalSystemCallAsOption,
		TerminalSystemNotice,
		TerminalSystemSeatState,
	} from './terminal-system-surface.types';

	let {
		terminalId,
	}: {
		terminalId: string;
	} = $props();

	const controller = getAppControllerContext();
	const AUTH_REQUIRED_MESSAGE = 'auth token required';

	const emptyTerminalGrantState: CachedResourceState<GlobalTerminalGrantEntry[]> = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};
	const emptyTerminalApprovalState: CachedResourceState<GlobalTerminalApprovalRequest[]> = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};
	const emptyTerminalActivityState: CachedResourceState<TerminalActivityItem[]> = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};

	type TerminalSeatState = {
		actorId: string;
		role: 'admin' | 'writer' | 'requester' | 'readonly';
		label?: string;
		currentAdmin: boolean;
		online: boolean;
		focused: boolean;
		invalidCredential: boolean;
		accessToken?: string;
		grantId?: string;
		adminCandidateRank?: number;
		leaseExpiresAt?: number;
	};

	let selectedCallerTokenByTerminalId = $state<Record<string, string>>({});
	let routeNotice = $state<TerminalSystemNotice | null>(null);
	const authReady = $derived(!controller.initializing);
	const isAuthenticated = $derived(Boolean(controller.authSession));
	const authRequired = $derived(authReady && !isAuthenticated);

	const actorDirectory = $derived(
		buildActorDirectory({
			sessions: controller.runtimeState.sessions,
			authActors: controller.authActors,
			profileIconUrl: (reference) => controller.runtimeStore.profileIconUrl(reference ?? ''),
			sessionIconUrl: (sessionId) => (sessionId ? controller.runtimeStore.sessionIconUrl(sessionId) : null),
		}),
	);
	const actorDirectoryMap = $derived(buildActorDirectoryMap(actorDirectory));
	const selectableActors = $derived(actorDirectory.filter((actor) => actor.actorKind !== 'system'));
	const terminals = $derived(controller.runtimeState.globalTerminals.data);
	const selectedTerminal = $derived(terminals.find((terminal) => terminal.terminalId === terminalId) ?? null);
	const selectedTerminalGrantsState = $derived(
		terminalId ? (controller.runtimeState.globalTerminalGrantsById[terminalId] ?? emptyTerminalGrantState) : emptyTerminalGrantState,
	);
	const selectedTerminalApprovalsState = $derived(
		terminalId
			? (controller.runtimeState.globalTerminalApprovalsById[terminalId] ?? emptyTerminalApprovalState)
			: emptyTerminalApprovalState,
	);
	const selectedTerminalActivityState = $derived(
		terminalId
			? (controller.runtimeState.globalTerminalActivityById[terminalId] ?? emptyTerminalActivityState)
			: emptyTerminalActivityState,
	);

	const asTerminalActorId = (value: string): GlobalTerminalActorId | null =>
		/^(auth|session|system):.+$/u.test(value) || isPrincipalActorId(value)
			? (value as GlobalTerminalActorId)
			: null;

	const describeActor = (actorId: string | undefined, fallback: string): ActorDirectoryEntry => {
		if (actorId && actorDirectoryMap.has(actorId)) {
			return actorDirectoryMap.get(actorId)!;
		}
		return {
			actorId: actorId ?? fallback,
			actorKind: resolveActorKind(actorId ?? fallback),
			label: fallbackActorLabel(actorId ?? fallback),
			subtitle: actorId,
			iconUrl: null,
		};
	};

	const describeTerminalError = (error: unknown, fallback: string): TerminalSystemNotice => ({
		tone: 'destructive',
		message: error instanceof Error ? error.message : fallback,
	});

	const callAsOptions = $derived.by(() => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return [] as TerminalSystemCallAsOption[];
		}
		const options: TerminalSystemCallAsOption[] = [];
		if (terminal.access?.accessToken) {
			options.push({
				accessToken: terminal.access.accessToken,
				participantId: terminal.access.participantId,
				role: terminal.access.role,
				label:
					(terminal.access.participantId
						? actorDirectoryMap.get(terminal.access.participantId)?.label ??
							fallbackActorLabel(terminal.access.participantId)
						: undefined) ?? 'Bootstrap admin',
			});
		}
		for (const grant of selectedTerminalGrantsState.data) {
			if (!grant.accessToken) {
				continue;
			}
			options.push({
				accessToken: grant.accessToken,
				participantId: grant.participantId,
				role: grant.role,
				label:
					(grant.participantId ? actorDirectoryMap.get(grant.participantId)?.label : undefined) ??
					grant.label ??
					fallbackActorLabel(grant.participantId ?? grant.grantId),
			});
		}
		return options;
	});

	const selectedCallerToken = $derived.by(() => {
		if (!isAuthenticated) {
			return null;
		}
		const terminal = selectedTerminal;
		if (!terminal) {
			return null;
		}
		const selected = selectedCallerTokenByTerminalId[terminal.terminalId];
		if (selected && callAsOptions.some((option) => option.accessToken === selected)) {
			return selected;
		}
		return callAsOptions[0]?.accessToken ?? terminal.access?.accessToken ?? null;
	});

	const terminalSeatStates = $derived.by(() => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return [] as TerminalSeatState[];
		}

		const seats = new Map<string, TerminalSeatState>();
		const mergeSeat = (seat: TerminalSeatState): void => {
			const current = seats.get(seat.actorId);
			seats.set(seat.actorId, {
				...current,
				...seat,
				accessToken: seat.accessToken ?? current?.accessToken,
				grantId: seat.grantId ?? current?.grantId,
				adminCandidateRank: seat.adminCandidateRank ?? current?.adminCandidateRank,
				leaseExpiresAt: seat.leaseExpiresAt ?? current?.leaseExpiresAt,
			});
		};

		if (terminal.access?.participantId) {
			mergeSeat({
				actorId: terminal.access.participantId,
				role: terminal.access.role,
				label: actorDirectoryMap.get(terminal.access.participantId)?.label ?? fallbackActorLabel(terminal.access.participantId),
				currentAdmin: terminal.access.currentAdmin,
				online: false,
				focused: false,
				invalidCredential: false,
				accessToken: terminal.access.accessToken,
				adminCandidateRank: terminal.access.adminCandidateRank,
				leaseExpiresAt: terminal.access.leaseExpiresAt,
			});
		}

		for (const grant of selectedTerminalGrantsState.data) {
			if (!grant.participantId) {
				continue;
			}
			mergeSeat({
				actorId: grant.participantId,
				role: grant.role,
				label: grant.label,
				currentAdmin: false,
				online: false,
				focused: false,
				invalidCredential: !grant.accessToken,
				accessToken: grant.accessToken,
				grantId: grant.grantId,
			});
		}

		for (const state of terminal.actors ?? []) {
			mergeSeat({
				actorId: state.actorId,
				role: state.role,
				label: state.label,
				currentAdmin: state.currentAdmin,
				online: state.online,
				focused: state.focused,
				invalidCredential: state.invalidCredential ?? false,
				adminCandidateRank: state.adminCandidateRank,
				leaseExpiresAt: state.leaseExpiresAt,
			});
		}

		const roleRank = {
			admin: 0,
			writer: 1,
			requester: 2,
			readonly: 3,
		} as const;
		return [...seats.values()].sort((left, right) => {
			if (left.currentAdmin !== right.currentAdmin) {
				return left.currentAdmin ? -1 : 1;
			}
			const leftCandidateRank = left.adminCandidateRank ?? Number.MAX_SAFE_INTEGER;
			const rightCandidateRank = right.adminCandidateRank ?? Number.MAX_SAFE_INTEGER;
			if (leftCandidateRank !== rightCandidateRank) {
				return leftCandidateRank - rightCandidateRank;
			}
			if (roleRank[left.role] !== roleRank[right.role]) {
				return roleRank[left.role] - roleRank[right.role];
			}
			return (left.label ?? left.actorId).localeCompare(right.label ?? right.actorId);
		});
	});

	const resolvedTerminalSeatStates = $derived.by(() => {
		return terminalSeatStates.map((state) => {
			const actor = describeActor(state.actorId, state.label ?? state.actorId);
			return {
				...state,
				actorKind: actor.actorKind,
				label: actor.label,
				subtitle: actor.subtitle,
				iconUrl: actor.iconUrl,
			} satisfies TerminalSystemSeatState;
		});
	});

	const terminalNotice = $derived.by(() => {
		if (routeNotice) {
			return routeNotice;
		}
		if (authRequired) {
			return {
				tone: 'destructive',
				message: AUTH_REQUIRED_MESSAGE,
			} satisfies TerminalSystemNotice;
		}
		const error =
			selectedTerminalActivityState.error ??
			selectedTerminalApprovalsState.error ??
			selectedTerminalGrantsState.error ??
			controller.runtimeState.globalTerminals.error;
		if (!error) {
			return null;
		}
		return {
			tone: 'destructive',
			message: error,
		} satisfies TerminalSystemNotice;
	});

	const ensureAuthenticated = (): void => {
		if (!isAuthenticated) {
			throw new Error(AUTH_REQUIRED_MESSAGE);
		}
	};

	const navigateToTerminal = async (nextTerminalId: string): Promise<void> => {
		await goto(`/terminals/${encodeURIComponent(nextTerminalId)}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const navigateToFallbackTerminal = async (removedTerminalId?: string): Promise<void> => {
		const nextTerminal = terminals.find((terminal) => terminal.terminalId !== removedTerminalId) ?? null;
		if (nextTerminal) {
			await navigateToTerminal(nextTerminal.terminalId);
			return;
		}
		await goto('/terminals/new', {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const handleDeleteTerminal = async (): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		try {
			ensureAuthenticated();
			await controller.runtimeStore.deleteGlobalTerminal({
				terminalId: terminal.terminalId,
			});
			routeNotice = null;
			await navigateToFallbackTerminal(terminal.terminalId);
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal delete failed');
		}
	};

	const handleChangeCallerToken = (accessToken: string): void => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		selectedCallerTokenByTerminalId = {
			...selectedCallerTokenByTerminalId,
			[terminal.terminalId]: accessToken,
		};
	};

	const handleGrantSeat = async (input: { participantId: string; role: 'admin' | 'writer' | 'requester' | 'readonly' }): Promise<void> => {
		const terminal = selectedTerminal;
		const participantId = asTerminalActorId(input.participantId);
		if (!terminal || !participantId) {
			return;
		}
		try {
			ensureAuthenticated();
			const grant = await controller.runtimeStore.issueGlobalTerminalGrant({
				terminalId: terminal.terminalId,
				role: input.role,
				participantId,
				label: actorDirectoryMap.get(input.participantId)?.label,
			});
			if (
				grant.accessToken &&
				input.role !== 'readonly' &&
				(selectedCallerToken === null || selectedCallerToken === terminal.access?.accessToken)
			) {
				selectedCallerTokenByTerminalId = {
					...selectedCallerTokenByTerminalId,
					[terminal.terminalId]: grant.accessToken,
				};
			}
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'grant seat failed');
			throw error;
		}
	};

	const handleToggleSeatFocus = async (input: {
		accessToken: string;
		focused: boolean;
	}): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		try {
			ensureAuthenticated();
			await controller.runtimeStore.focusGlobalTerminals({
				op: input.focused ? 'remove' : 'add',
				terminalIds: [terminal.terminalId],
				accessToken: input.accessToken,
			});
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'seat focus update failed');
		}
	};

	const handleRevokeSeat = async (input: { grantId: string }): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		try {
			ensureAuthenticated();
			await controller.runtimeStore.revokeGlobalTerminalGrant({
				terminalId: terminal.terminalId,
				grantId: input.grantId,
			});
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'seat revoke failed');
		}
	};

	const handleApproveRequest = async (input: { requestId: string; durationMs?: number }): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		try {
			ensureAuthenticated();
			await controller.runtimeStore.approveGlobalTerminalRequest({
				terminalId: terminal.terminalId,
				requestId: input.requestId,
				durationMs: input.durationMs ?? 30 * 60 * 1000,
			});
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'approval decision failed');
		}
	};

	const handleDenyRequest = async (input: { requestId: string }): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		try {
			ensureAuthenticated();
			await controller.runtimeStore.denyGlobalTerminalRequest({
				terminalId: terminal.terminalId,
				requestId: input.requestId,
			});
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'approval denial failed');
		}
	};

	const isTerminalWriteResult = (
		value: unknown,
	): value is { ok?: boolean; message?: string; approvalRequest?: { requestId: string } } => {
		return Boolean(value && typeof value === 'object');
	};

	const handleWriteToolCall = async (input: { text: string }): Promise<{ approvalRequested?: boolean; message?: string } | void> => {
		ensureAuthenticated();
		const terminal = selectedTerminal;
		const accessToken = selectedCallerToken;
		const selectedSeat = callAsOptions.find((option) => option.accessToken === accessToken);
		if (!terminal || !accessToken) {
			throw new Error('terminal-system seat token is unavailable');
		}
		try {
			const result = await controller.runtimeStore.writeGlobalTerminal({
				terminalId: terminal.terminalId,
				accessToken,
				text: input.text,
				createApprovalRequest: selectedSeat?.role === 'requester',
				returnRead: false,
			});
			if (isTerminalWriteResult(result) && result.approvalRequest) {
				routeNotice = {
					tone: 'warning',
					message: `Write approval requested: ${result.approvalRequest.requestId}`,
				};
				return {
					approvalRequested: true,
					message: result.message,
				};
			}
			if (isTerminalWriteResult(result) && result.ok === false) {
				throw new Error(result.message ?? 'terminal write failed');
			}
			routeNotice = null;
			return {
				approvalRequested: false,
				message: isTerminalWriteResult(result) ? result.message : undefined,
			};
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal write failed');
			return {
				approvalRequested: false,
				message: error instanceof Error ? error.message : 'terminal write failed',
			};
		}
	};

	const handleReadToolCall = async (input: { mode: 'auto' | 'diff' | 'snapshot' }): Promise<void> => {
		ensureAuthenticated();
		const terminal = selectedTerminal;
		const accessToken = selectedCallerToken;
		if (!terminal || !accessToken) {
			throw new Error('terminal-system seat token is unavailable');
		}
		try {
			await controller.runtimeStore.readGlobalTerminal({
				terminalId: terminal.terminalId,
				accessToken,
				mode: input.mode,
			});
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal read failed');
		}
	};

	$effect(() => {
		if (!controller.runtimeState.globalTerminals.loaded) {
			return;
		}
		if (selectedTerminal || controller.runtimeState.globalTerminals.loading) {
			return;
		}
		void navigateToFallbackTerminal(terminalId);
	});

	$effect(() => {
		const currentTerminalId = selectedTerminal?.terminalId;
		if (!isAuthenticated || !currentTerminalId) {
			return;
		}
		const releaseGrants = controller.runtimeStore.retainGlobalTerminalGrants(currentTerminalId);
		const releaseApprovals = controller.runtimeStore.retainGlobalTerminalApprovals(currentTerminalId);
		const releaseActivity = controller.runtimeStore.retainGlobalTerminalActivity(currentTerminalId);
		void controller.runtimeStore.hydrateGlobalTerminalGrants({ terminalId: currentTerminalId }).catch(() => undefined);
		void controller.runtimeStore
			.hydrateGlobalTerminalApprovals({ terminalId: currentTerminalId })
			.catch(() => undefined);
		void controller.runtimeStore
			.hydrateGlobalTerminalActivity({ terminalId: currentTerminalId, limit: 120 })
			.catch(() => undefined);
		return () => {
			releaseActivity();
			releaseApprovals();
			releaseGrants();
		};
	});
</script>

<TerminalSystemSurface
	{selectedTerminal}
	terminalViewportComponent={TerminalViewHost}
	terminalGrantsState={selectedTerminalGrantsState}
	terminalApprovalsState={selectedTerminalApprovalsState}
	terminalActivityState={selectedTerminalActivityState}
	routeNotice={terminalNotice}
	{selectableActors}
	{callAsOptions}
	{selectedCallerToken}
	seatStates={resolvedTerminalSeatStates}
	onChangeCallerToken={handleChangeCallerToken}
	onDeleteTerminal={handleDeleteTerminal}
	onGrantSeat={handleGrantSeat}
	onToggleSeatFocus={handleToggleSeatFocus}
	onRevokeSeat={handleRevokeSeat}
	onApproveRequest={handleApproveRequest}
	onDenyRequest={handleDenyRequest}
	onWriteToolCall={handleWriteToolCall}
	onReadToolCall={handleReadToolCall}
/>
