export const TERMINAL_USERS_PANE_COMPACT_WIDTH = 480;

export type TerminalUsersPaneLayout = 'compact' | 'wide';

export const resolveTerminalUsersPaneLayout = (width: number): TerminalUsersPaneLayout =>
	width < TERMINAL_USERS_PANE_COMPACT_WIDTH ? 'compact' : 'wide';
