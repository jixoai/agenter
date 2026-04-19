import type {
  CachedResourceState,
  GlobalRoomActorId,
  GlobalRoomAssetEntry,
  GlobalRoomEntry,
  GlobalRoomSnapshotOutput,
  MessageChannelEntry,
} from "@agenter/client-sdk";
import type { WebChatComposerSubmitPayload, WebChatNotice, WebChatVisibleMessageFact } from "@agenter/web-chat-view";

import type { ActorDirectoryEntry } from "$lib/features/collaboration/actor-directory";

export type MessageSystemGrantRole = "admin" | "member" | "readonly";
export type MessageSystemManageSection = "overview" | "users" | "permissions";

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
  trackedByLatestVisible: boolean;
  hasReadLatestVisible: boolean;
  accessToken?: string;
  grantId?: string;
}

export interface MessageSystemRoomAssetItem extends GlobalRoomAssetEntry {
  uploaderLabel: string;
  uploaderSubtitle?: string;
  uploaderIconUrl?: string | null;
}

export interface MessageSystemCreateRoomInput {
  title?: string;
  initialUsers: Array<{
    actorId: GlobalRoomActorId;
    role: MessageSystemGrantRole;
    focused?: boolean;
  }>;
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
  selectedRoom: GlobalRoomEntry | MessageChannelEntry | null;
  authenticated: boolean;
  selectedRoomIconUrl?: string | null;
  resolveProfileIconUrl?: (reference: string) => string | null;
  resolveSessionIconUrl?: (sessionId: string) => string | null;
  disableManageDialogPortal?: boolean;
  initialManageDialogSection?: MessageSystemManageSection | null;
  initialMessages: GlobalRoomSnapshotOutput["items"];
  initialSnapshotResolved: boolean;
  roomAssetsState: CachedResourceState<MessageSystemRoomAssetItem[]>;
  routeNotice: WebChatNotice | null;
  readSeatCount: number;
  readSeatTotal: number;
  selectedCallerToken: string | null;
  selectedViewerActorId: string | null;
  selectableActors: ActorDirectoryEntry[];
  roomSeatStates: MessageSystemRoomSeatState[];
  onChangeViewerActorId: (actorId: string) => void;
  onSaveRoomTitle: (title: string) => Promise<void>;
  onArchiveRoom: () => Promise<void>;
  onDeleteRoom: () => Promise<void>;
  onGrantSeat: (input: MessageSystemGrantSeatInput) => Promise<void>;
  onToggleSeatFocus: (input: MessageSystemSeatFocusInput) => Promise<void>;
  onRevokeSeat: (input: MessageSystemSeatRevokeInput) => Promise<void>;
  onSendMessage: (payload: WebChatComposerSubmitPayload) => Promise<void>;
  onLatestVisibleMessageIdChange: (message: WebChatVisibleMessageFact | null) => Promise<void> | void;
}
