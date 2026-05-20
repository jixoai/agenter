import type { GlobalTerminalEntry } from '@agenter/client-sdk';

export type TerminalLifecycleTone = 'neutral' | 'accent' | 'positive' | 'warning' | 'critical';

export type TerminalDisplayStatusFact = {
	label: string;
	title: string;
	tone: TerminalLifecycleTone;
	caps?: boolean;
};

export const isTerminalRunning = (terminal: GlobalTerminalEntry | null | undefined): boolean =>
	terminal?.processPhase === 'running';

export const resolveTerminalInstanceName = (terminal: GlobalTerminalEntry | null | undefined): string => {
	if (!terminal) {
		return 'Shared terminal';
	}
	return terminal.configuredTitle?.trim() || terminal.terminalId;
};

export const resolveTerminalWindowTitle = (terminal: GlobalTerminalEntry | null | undefined): string => {
	if (!terminal) {
		return 'Shared terminal';
	}
	return terminal.currentTitle?.trim() || resolveTerminalInstanceName(terminal);
};

export const resolveTerminalIdentitySubtitle = (terminal: GlobalTerminalEntry | null | undefined): string => {
	if (!terminal) {
		return 'Select an active terminal tab.';
	}
	if (terminal.processPhase === 'running' && terminal.currentPath?.trim()) {
		return terminal.currentPath;
	}
	return resolveTerminalInstanceName(terminal) === terminal.terminalId ? '' : terminal.terminalId;
};

export const resolveTerminalLifecycleFacts = (
	terminal: GlobalTerminalEntry | null | undefined,
): TerminalDisplayStatusFact[] => {
	if (!terminal) {
		return [
			{
				label: 'No terminal',
				title: 'No shared terminal is selected.',
				tone: 'neutral',
				caps: true,
			},
		];
	}

	const lifecycleFact = (() => {
		switch (terminal.processPhase) {
			case 'running':
				return {
					label: 'Running',
					title: 'PTY is currently running.',
					tone: 'positive',
					caps: true,
				} satisfies TerminalDisplayStatusFact;
			case 'stopped': {
				const stopReason = terminal.lastStopReason ?? 'exited';
				const reasonLabel =
					stopReason === 'killed' ? 'Killed' : stopReason === 'startup_failed' ? 'Failed' : 'Exited';
				return {
					label: 'Stopped',
					title: `PTY is currently stopped (${reasonLabel.toLowerCase()}).`,
					tone: stopReason === 'startup_failed' ? 'critical' : 'warning',
					caps: true,
				} satisfies TerminalDisplayStatusFact;
			}
			default:
				return {
					label: 'Provisioned',
					title: 'Terminal catalog entry exists but the PTY has not been started yet.',
					tone: 'neutral',
					caps: true,
				} satisfies TerminalDisplayStatusFact;
		}
	})();

	if (terminal.processPhase !== 'running') {
		const reason = terminal.lastStopReason;
		if (!reason) {
			return [lifecycleFact];
		}
		return [
			lifecycleFact,
			{
				label: reason === 'killed' ? 'Killed' : reason === 'startup_failed' ? 'Failed' : 'Exited',
				title:
					reason === 'startup_failed'
						? 'The last PTY bootstrap failed.'
						: reason === 'killed'
							? 'The PTY was explicitly stopped.'
							: 'The PTY exited normally.',
				tone: reason === 'startup_failed' ? 'critical' : 'neutral',
			},
		];
	}

	return [
		lifecycleFact,
		{
			label: terminal.status === 'BUSY' ? 'Busy' : 'Idle',
			title:
				terminal.status === 'BUSY'
					? 'Terminal is processing active work.'
					: 'Terminal is waiting for the next interaction.',
			tone: terminal.status === 'BUSY' ? 'accent' : 'neutral',
		},
	];
};

export const resolveTerminalTransportLabel = (terminal: GlobalTerminalEntry): string => {
	if (!terminal.transportUrl) {
		return 'No transport discovery';
	}
	return terminal.processPhase === 'running' ? 'Live websocket mirror' : 'Transport discoverable while stopped';
};
