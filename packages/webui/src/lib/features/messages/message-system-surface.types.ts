import type {
	CachedResourceState,
	GlobalRoomEntry,
	GlobalRoomSnapshotOutput,
} from '@agenter/client-sdk';
import type { WebChatComposerSubmitPayload, WebChatNotice } from '@agenter/web-chat-view';

import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';

export type MessageSystemGrantRole = 'admin' | 'member' | 'readonly';

export interface MessageSystemSendAsOption {
	accessToken: string;
	participantId?: string;
	role: MessageSystemGrantRole;
	label: string;
}

export interface MessageSystemRoomSeatState extends ActorDirectoryEntry {
	role: MessageSystemGrantRole;
	currentAdmin: boolean;
	online: boolean;
	focused: boolean;
	invalidCredential: boolean;
	readAt?: number;
	hasReadLatestVisible: boolean;
	accessToken?: string;
	grantId?: string;
}

export interface MessageSystemCreateRoomInput {
	title?: string;
	participantIds: string[];
}

export interface MessageSystemGrantSeatInput {
	participantId: string;
	role: MessageSystemGrantRole;
}

export interface MessageSystemSeatFocusInput {
	actorId: string;
	accessToken: string;
	focused: boolean;
}

export interface MessageSystemSeatRevokeInput {
	actorId: string;
	grantId: string;
}

export interface MessageSystemSurfaceProps {
	roomsState: CachedResourceState<GlobalRoomEntry[]>;
	selectedRoomId: string;
	selectedRoom: GlobalRoomEntry | null;
	initialMessages: GlobalRoomSnapshotOutput['items'];
	initialSnapshotResolved: boolean;
	routeNotice: WebChatNotice | null;
	readSeatCount: number;
	readSeatTotal: number;
	sendAsOptions: MessageSystemSendAsOption[];
	selectedCallerToken: string | null;
	selectableActors: ActorDirectoryEntry[];
	roomSeatStates: MessageSystemRoomSeatState[];
	onSelectRoom: (chatId: string) => void;
	onChangeCallerToken: (accessToken: string) => void;
	onSaveRoomTitle: (title: string) => Promise<void>;
	onArchiveRoom: () => Promise<void>;
	onDeleteRoom: () => Promise<void>;
	onCreateRoom: (input: MessageSystemCreateRoomInput) => Promise<void>;
	onGrantSeat: (input: MessageSystemGrantSeatInput) => Promise<void>;
	onToggleSeatFocus: (input: MessageSystemSeatFocusInput) => Promise<void>;
	onRevokeSeat: (input: MessageSystemSeatRevokeInput) => Promise<void>;
	onSendMessage: (payload: WebChatComposerSubmitPayload) => Promise<void>;
	onLatestVisibleMessageIdChange: (messageId: string | null) => Promise<void> | void;
}
