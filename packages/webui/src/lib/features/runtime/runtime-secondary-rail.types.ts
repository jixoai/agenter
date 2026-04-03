import type {
	MessageChannelEntry,
	RuntimeSnapshotEntry,
	SessionEntry,
} from '@agenter/client-sdk';

export interface RuntimeSecondaryRailProps {
	session: SessionEntry;
	runtime: RuntimeSnapshotEntry | null;
	channels: MessageChannelEntry[];
	workspaceLabel: string;
	unreadCount: number;
	onOpenRoom: (chatId: string) => void;
	onOpenTerminal: (terminalId: string) => void;
}
