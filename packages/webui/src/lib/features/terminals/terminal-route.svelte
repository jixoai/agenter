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
	isPrincipalActorId,
} from '$lib/features/collaboration/actor-directory';
	import TerminalViewHost from '$lib/components/terminal-view-host.svelte';

import TerminalSystemSurface from './terminal-system-surface.svelte';
import {
	buildTerminalCallAsOptions,
	buildTerminalSeatStates,
	resolveSelectedCallerToken,
} from './terminal-route.projection';
import type {
	TerminalSystemCallAsOption,
	TerminalSystemNotice,
	TerminalSystemResizeToolResult,
	TerminalSystemSeatState,
	TerminalSystemWriteToolResult,
} from './terminal-system-surface.types';

	let {
		terminalId,
	}: {
		terminalId: string;
	} = $props();

	const controller = getAppControllerContext();
	const AUTH_REQUIRED_MESSAGE = 'auth token required';
	const GLOBAL_TERMINAL_ACTIVITY_LIMIT = 20;

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

	const describeTerminalError = (error: unknown, fallback: string): TerminalSystemNotice => ({
		tone: 'destructive',
		message: error instanceof Error ? error.message : fallback,
	});

	const callAsOptions = $derived.by(
		() =>
			buildTerminalCallAsOptions({
				terminal: selectedTerminal,
				grants: selectedTerminalGrantsState.data,
				actorDirectoryMap,
				}) as TerminalSystemCallAsOption[],
	);

	const parseTransportUrl = (value?: string): URL | null => {
		if (!value) {
			return null;
		}
		try {
			return new URL(value);
		} catch {
			return null;
		}
	};

	const buildTransportUrlForToken = (token?: string | null): string | null => {
		if (!token) {
			return null;
		}
		const url = parseTransportUrl(selectedTerminal?.transportUrl);
		if (!url) {
			return null;
		}
		url.searchParams.set('token', token);
		return url.toString();
	};

	const selectedCallerToken = $derived.by(() =>
		isAuthenticated
			? resolveSelectedCallerToken({
					terminal: selectedTerminal,
					selectedCallerTokenByTerminalId,
					callAsOptions,
				})
			: null,
	);
	const selectedTransportUrl = $derived(buildTransportUrlForToken(selectedCallerToken));

	const terminalSeatStates = $derived.by(
		() =>
			buildTerminalSeatStates({
				terminal: selectedTerminal,
				grants: selectedTerminalGrantsState.data,
				actorDirectoryMap,
			}) as TerminalSystemSeatState[],
	);

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

	const handleBootstrapTerminal = async (): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		try {
			ensureAuthenticated();
			await controller.runtimeStore.bootstrapGlobalTerminal({
				terminalId: terminal.terminalId,
			});
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal bootstrap failed');
			throw error;
		}
	};

	const handleStopTerminal = async (): Promise<void> => {
		const terminal = selectedTerminal;
		if (!terminal) {
			return;
		}
		try {
			ensureAuthenticated();
			await controller.runtimeStore.stopGlobalTerminal({
				terminalId: terminal.terminalId,
			});
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal stop failed');
			throw error;
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

	const handleWriteToolCall = async (input: { text: string }): Promise<TerminalSystemWriteToolResult> => {
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
					ok: false,
					approvalRequested: true,
					message: result.message,
				};
			}
			if (isTerminalWriteResult(result) && result.ok === false) {
				throw new Error(result.message ?? 'terminal write failed');
			}
			routeNotice = null;
			return {
				ok: true,
				approvalRequested: false,
				message: isTerminalWriteResult(result) ? result.message : undefined,
			};
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal write failed');
			return {
				ok: false,
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
				remark: true,
			});
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal read failed');
		}
	};

	const handleResizeToolCall = async (input: { cols: number; rows: number }): Promise<TerminalSystemResizeToolResult> => {
		ensureAuthenticated();
		const terminal = selectedTerminal;
		if (!terminal) {
			throw new Error('terminal is unavailable');
		}
		try {
			const result = await controller.runtimeStore.setGlobalTerminalConfig({
				terminalId: terminal.terminalId,
				cols: input.cols,
				rows: input.rows,
			});
			routeNotice = null;
			return {
				ok: true,
				cols: result.config.profile.cols ?? input.cols,
				rows: result.config.profile.rows ?? input.rows,
				appliedLiveFields: [...result.appliedLiveFields],
				nextBootstrapFields: [...result.nextBootstrapFields],
			};
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal resize failed');
			throw error;
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
			.hydrateGlobalTerminalActivity({ terminalId: currentTerminalId, limit: GLOBAL_TERMINAL_ACTIVITY_LIMIT })
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
	{selectedTransportUrl}
	terminalGrantsState={selectedTerminalGrantsState}
	terminalApprovalsState={selectedTerminalApprovalsState}
	terminalActivityState={selectedTerminalActivityState}
	routeNotice={terminalNotice}
	{selectableActors}
	{callAsOptions}
	{selectedCallerToken}
	seatStates={terminalSeatStates}
	onChangeCallerToken={handleChangeCallerToken}
	onBootstrapTerminal={handleBootstrapTerminal}
	onStopTerminal={handleStopTerminal}
	onDeleteTerminal={handleDeleteTerminal}
	onGrantSeat={handleGrantSeat}
	onToggleSeatFocus={handleToggleSeatFocus}
	onRevokeSeat={handleRevokeSeat}
	onApproveRequest={handleApproveRequest}
	onDenyRequest={handleDenyRequest}
	onWriteToolCall={handleWriteToolCall}
	onReadToolCall={handleReadToolCall}
	onResizeToolCall={handleResizeToolCall}
/>
