import type { RuntimeChatCycle, RuntimeClientState, SessionEntry } from '@agenter/client-sdk';

export type RuntimeTabId = 'attention' | 'cycles' | 'systems' | 'observability' | 'settings';

export interface RunningAvatarRailItem {
	sessionId: string;
	label: string;
	workspacePath: string;
	workspaceName: string;
	status: SessionEntry['status'];
	unreadCount: number;
	iconUrl: string | null;
	href: string;
	active: boolean;
}

export interface RuntimeTabItem {
	id: RuntimeTabId;
	label: string;
	badgeLabel?: string;
	badgeClassName?: string;
	badgeAnimated?: boolean;
}

export const RUNTIME_TAB_LABELS: Record<RuntimeTabId, string> = {
	attention: 'Attention',
	cycles: 'Cycles',
	systems: 'Systems',
	observability: 'Observability',
	settings: 'Settings',
};

export const basenameWorkspace = (workspacePath: string): string => {
	if (workspacePath === '~/') {
		return 'Global workspace';
	}
	return workspacePath.split(/[\\/]+/u).filter(Boolean).at(-1) ?? workspacePath;
};

export const normalizeRuntimeTab = (value: string | null | undefined): RuntimeTabId => {
	if (
		value === 'attention' ||
		value === 'cycles' ||
		value === 'systems' ||
		value === 'observability' ||
		value === 'settings'
	) {
		return value;
	}
	return 'attention';
};

export const extractRuntimeSessionId = (pathname: string): string | null => {
	const match = /^\/runtime\/([^/]+)(?:\/[^/]+)?$/u.exec(pathname);
	return match?.[1] ?? null;
};

export const extractRuntimeTab = (pathname: string): RuntimeTabId | null => {
	const match = /^\/runtime\/[^/]+\/([^/]+)$/u.exec(pathname);
	return match ? normalizeRuntimeTab(match[1]) : null;
};

export const resolveRuntimeStatusLabel = (status: SessionEntry['status']): string => {
	switch (status) {
		case 'running':
			return 'Running';
		case 'starting':
			return 'Starting';
		case 'error':
			return 'Error';
		case 'stopped':
			return 'Stopped';
		case 'paused':
			return 'Paused';
		default:
			return status;
	}
};

export const resolveRuntimeStatusTone = (status: SessionEntry['status']): string => {
	switch (status) {
		case 'running':
			return 'bg-emerald-500';
		case 'starting':
			return 'bg-amber-500';
		case 'error':
			return 'bg-rose-500';
		default:
			return 'bg-muted-foreground/50';
	}
};

export const resolveCycleBadgeClassName = (
	cycle: RuntimeChatCycle | null,
	active: boolean,
): string | undefined => {
	if (!cycle) {
		return undefined;
	}
	if (cycle.status === 'error') {
		return 'bg-rose-500 text-white';
	}
	if (cycle.kind === 'compact') {
		return active ? 'bg-amber-500 text-white' : 'bg-amber-400 text-black';
	}
	return active ? 'bg-teal-600 text-white' : 'bg-emerald-500 text-white';
};

export const buildRuntimeTabs = (input: {
	activeCycle: RuntimeChatCycle | null;
	latestCycle: RuntimeChatCycle | null;
}): RuntimeTabItem[] => {
	const cycle = input.activeCycle ?? input.latestCycle;
	return [
		{ id: 'attention', label: 'Attention' },
		{
			id: 'cycles',
			label: 'Cycles',
			badgeLabel: cycle ? (cycle.cycleId === null ? 'P' : String(cycle.cycleId)) : undefined,
			badgeClassName: resolveCycleBadgeClassName(cycle, Boolean(input.activeCycle)),
			badgeAnimated: Boolean(input.activeCycle),
		},
		{ id: 'systems', label: 'Systems' },
		{ id: 'observability', label: 'Observability' },
		{ id: 'settings', label: 'Settings' },
	];
};

export const buildRunningAvatarRailItems = (
	state: RuntimeClientState,
	input: {
		activeSessionId: string | null;
		resolveSessionIconUrl: (sessionId: string) => string | null;
	},
): RunningAvatarRailItem[] => {
	return state.sessions
		.filter((session) => session.status === 'running' || session.status === 'starting')
		.map((session) => ({
			sessionId: session.id,
			label: session.avatar || session.name,
			workspacePath: session.workspacePath,
			workspaceName: basenameWorkspace(session.workspacePath),
			status: session.status,
			unreadCount: state.unreadBySession[session.id] ?? 0,
			iconUrl: input.resolveSessionIconUrl(session.id),
			href: `/runtime/${encodeURIComponent(session.id)}/attention`,
			active: input.activeSessionId === session.id,
		}))
		.sort((left, right) => {
			if (left.active !== right.active) {
				return left.active ? -1 : 1;
			}
			if (left.unreadCount !== right.unreadCount) {
				return right.unreadCount - left.unreadCount;
			}
			return left.label.localeCompare(right.label);
		});
};
