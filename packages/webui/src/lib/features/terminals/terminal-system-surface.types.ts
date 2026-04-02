import type {
	CachedResourceState,
	GlobalTerminalApprovalRequest,
	GlobalTerminalEntry,
	GlobalTerminalGrantEntry,
	TerminalActivityItem,
} from '@agenter/client-sdk';

import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';

export type TerminalSystemGrantRole = 'admin' | 'writer' | 'requester' | 'readonly';
export type TerminalSystemReadMode = 'auto' | 'diff' | 'snapshot';

export interface TerminalSystemNotice {
	tone: 'default' | 'warning' | 'destructive';
	message: string;
}

export interface TerminalSystemCallAsOption {
	accessToken: string;
	participantId?: string;
	role: TerminalSystemGrantRole;
	label: string;
}

export interface TerminalSystemSeatState extends ActorDirectoryEntry {
	role: TerminalSystemGrantRole;
	currentAdmin: boolean;
	online: boolean;
	focused: boolean;
	invalidCredential: boolean;
	accessToken?: string;
	grantId?: string;
	adminCandidateRank?: number;
	leaseExpiresAt?: number;
}

export interface TerminalSystemCreateTerminalInput {
	terminalId?: string;
	processKind?: string;
	cwd?: string;
}

export interface TerminalSystemGrantSeatInput {
	participantId: string;
	role: TerminalSystemGrantRole;
}

export interface TerminalSystemSeatFocusInput {
	actorId: string;
	accessToken: string;
	focused: boolean;
}

export interface TerminalSystemSeatRevokeInput {
	actorId: string;
	grantId: string;
}

export interface TerminalSystemApprovalDecisionInput {
	requestId: string;
	durationMs?: number;
}

export interface TerminalSystemWriteToolResult {
	approvalRequested?: boolean;
	message?: string;
}

export interface TerminalSystemSurfaceProps {
	terminalsState: CachedResourceState<GlobalTerminalEntry[]>;
	selectedTerminalId: string;
	selectedTerminal: GlobalTerminalEntry | null;
	terminalGrantsState: CachedResourceState<GlobalTerminalGrantEntry[]>;
	terminalApprovalsState: CachedResourceState<GlobalTerminalApprovalRequest[]>;
	terminalActivityState: CachedResourceState<TerminalActivityItem[]>;
	routeNotice: TerminalSystemNotice | null;
	selectableActors: ActorDirectoryEntry[];
	callAsOptions: TerminalSystemCallAsOption[];
	selectedCallerToken: string | null;
	seatStates: TerminalSystemSeatState[];
	onSelectTerminal: (terminalId: string) => void;
	onChangeCallerToken: (accessToken: string) => void;
	onCreateTerminal: (input: TerminalSystemCreateTerminalInput) => Promise<void>;
	onDeleteTerminal: () => Promise<void>;
	onGrantSeat: (input: TerminalSystemGrantSeatInput) => Promise<void>;
	onToggleSeatFocus: (input: TerminalSystemSeatFocusInput) => Promise<void>;
	onRevokeSeat: (input: TerminalSystemSeatRevokeInput) => Promise<void>;
	onApproveRequest: (input: TerminalSystemApprovalDecisionInput) => Promise<void>;
	onDenyRequest: (input: TerminalSystemApprovalDecisionInput) => Promise<void>;
	onWriteToolCall: (input: { text: string }) => Promise<TerminalSystemWriteToolResult | void>;
	onReadToolCall: (input: { mode: TerminalSystemReadMode }) => Promise<void>;
}
