import type { GlobalTerminalEntry, GlobalTerminalGrantEntry } from '@agenter/client-sdk';

import {
	fallbackActorLabel,
	resolveActorKind,
	type ActorDirectoryEntry,
} from '$lib/features/collaboration/actor-directory';

import type {
	TerminalSystemCallAsOption,
	TerminalSystemSeatState,
} from './terminal-system-surface.types';

type TerminalProjectionEntry = Pick<GlobalTerminalEntry, 'terminalId' | 'access' | 'actors'>;
type TerminalProjectionGrant = Pick<
	GlobalTerminalGrantEntry,
	'accessToken' | 'participantId' | 'role' | 'label' | 'grantId'
>;

const describeProjectedActor = (
	actorDirectoryMap: ReadonlyMap<string, ActorDirectoryEntry>,
	actorId: string | undefined,
	fallback: string,
): ActorDirectoryEntry => {
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

export const buildTerminalCallAsOptions = (input: {
	terminal: TerminalProjectionEntry | null;
	grants: readonly TerminalProjectionGrant[];
	actorDirectoryMap: ReadonlyMap<string, ActorDirectoryEntry>;
}): TerminalSystemCallAsOption[] => {
	const { terminal, grants, actorDirectoryMap } = input;
	if (!terminal) {
		return [];
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

	for (const grant of grants) {
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
};

export const resolveSelectedCallerToken = (input: {
	terminal: Pick<GlobalTerminalEntry, 'terminalId' | 'access'> | null;
	selectedCallerTokenByTerminalId: Readonly<Record<string, string>>;
	callAsOptions: readonly TerminalSystemCallAsOption[];
}): string | null => {
	const { terminal, selectedCallerTokenByTerminalId, callAsOptions } = input;
	if (!terminal) {
		return null;
	}

	const selected = selectedCallerTokenByTerminalId[terminal.terminalId];
	if (selected && callAsOptions.some((option) => option.accessToken === selected)) {
		return selected;
	}
	return callAsOptions[0]?.accessToken ?? terminal.access?.accessToken ?? null;
};

export const buildTerminalSeatStates = (input: {
	terminal: TerminalProjectionEntry | null;
	grants: readonly TerminalProjectionGrant[];
	actorDirectoryMap: ReadonlyMap<string, ActorDirectoryEntry>;
}): TerminalSystemSeatState[] => {
	const { terminal, grants, actorDirectoryMap } = input;
	if (!terminal) {
		return [];
	}

	const grantByActorId = new Map(
		grants
			.filter((grant): grant is TerminalProjectionGrant & { participantId: string } => Boolean(grant.participantId))
			.map((grant) => [grant.participantId, grant] as const),
	);

	return (terminal.actors ?? []).map((state) => {
		const actor = describeProjectedActor(actorDirectoryMap, state.actorId, state.label ?? state.actorId);
		const grant = grantByActorId.get(state.actorId);
		return {
			actorId: state.actorId,
			actorKind: actor.actorKind,
			label: actor.label,
			subtitle: actor.subtitle,
			iconUrl: actor.iconUrl,
			role: state.role,
			currentAdmin: state.currentAdmin,
			online: state.online,
			focused: state.focused,
			invalidCredential: state.invalidCredential ?? false,
			accessToken: grant?.accessToken,
			grantId: grant?.grantId,
			adminCandidateRank: state.adminCandidateRank,
			leaseExpiresAt: state.leaseExpiresAt,
		} satisfies TerminalSystemSeatState;
	});
};
