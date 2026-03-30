import type {
  AttentionQueryItem,
  DraftResolutionOutput,
  MessageChannelEntry,
  MessageChannelGrantEntry,
  RuntimeClientState,
  RuntimeStore,
  WorkspaceSessionCounts,
  WorkspaceSessionEntry,
  WorkspaceSessionTab,
} from "@agenter/client-sdk";
import { createContext, useContext, useRef, useSyncExternalStore } from "react";

import type { AIInputSuggestion } from "./features/chat/AIInput";
import type { QuickstartBootstrapConfig } from "./features/quickstart/quickstart-bootstrap-types";
import type { SettingsEffectiveGraph, SettingsLayerItem } from "./features/settings/settings-graph-types";
import type { LongListPagingInput, LongListPagingState } from "./shared/long-list-paging";

export interface AppController {
  runtimeStore: RuntimeStore;
  notice: string;
  setNotice: (value: string) => void;
  quickstartWorkspacePath: string;
  setQuickstartWorkspacePath: (path: string) => void;
  quickstartDraft: DraftResolutionOutput | null;
  quickstartDraftLoading: boolean;
  quickstartBootstrapConfig: QuickstartBootstrapConfig;
  quickstartBootstrapLoading: boolean;
  quickstartRecentSessions: WorkspaceSessionEntry[];
  quickstartBusy: boolean;
  selectedWorkspacePath: string | null;
  setSelectedWorkspacePath: (path: string | null) => void;
  selectedWorkspaceSessionId: string | null;
  setSelectedWorkspaceSessionId: (sessionId: string | null) => void;
  workspaceSessionsTab: WorkspaceSessionTab;
  setWorkspaceSessionsTab: (tab: WorkspaceSessionTab) => void;
  workspaceSessions: WorkspaceSessionEntry[];
  workspaceSessionCounts: WorkspaceSessionCounts;
  workspaceSessionCursor: number | null;
  workspaceSessionsLoading: boolean;
  workspaceSessionsLoadingMore: boolean;
  settingsLayers: SettingsLayerItem[];
  settingsEffective: SettingsEffectiveGraph;
  settingsLoading: boolean;
  selectedLayerId: string | null;
  setSelectedLayerId: (layerId: string | null) => void;
  layerDraft: string;
  setLayerDraft: (content: string) => void;
  settingsStatus: string;
  getLongListPagingState: (input: LongListPagingInput) => LongListPagingState;
  searchWorkspacePaths: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
  createWorkspaceSession: (workspacePath: string) => Promise<string | null>;
  quickstartSubmit: (payload: { text: string; assets: File[] }) => Promise<string | null>;
  enterWorkspace: () => Promise<string | null>;
  saveQuickstartBootstrapConfig: (config: QuickstartBootstrapConfig) => Promise<void>;
  resumeSession: (sessionId: string, workspacePath?: string) => Promise<void>;
  startSession: (sessionId: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  abortSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendChat: (sessionId: string, payload: { text: string; assets: File[] }) => Promise<void>;
  ensureMessageChannels: (sessionId: string) => Promise<void>;
  listMessageChannels: (sessionId: string, input?: { includeArchived?: boolean }) => Promise<MessageChannelEntry[]>;
  createMessageChannel: (input: {
    sessionId: string;
    kind: "direct" | "room";
    title?: string;
    participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }) => Promise<MessageChannelEntry>;
  focusMessageChannels: (input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken: string }>;
  }) => Promise<MessageChannelEntry[]>;
  sendMessageChannel: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    payload: { text: string; assets: File[] };
  }) => Promise<void>;
  updateMessageChannel: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
      metadata?: Record<string, unknown>;
    };
  }) => Promise<MessageChannelEntry>;
  listMessageChannelGrants: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
  }) => Promise<MessageChannelGrantEntry[]>;
  issueMessageChannelGrant: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
    accessTokenHint?: string;
  }) => Promise<{
    grantId: string;
    chatId: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
    createdAt: number;
    accessRole: "admin" | "member" | "readonly";
    accessToken: string;
    transportUrl?: string;
  }>;
  archiveMessageChannel: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    archivedBy?: string;
  }) => Promise<MessageChannelEntry>;
  listTerminals: (sessionId: string) => Promise<
    Array<{
      terminalId: string;
      processKind: string;
      command: string[];
      cwd: string;
      workspace: string | null;
      running: boolean;
      status: "IDLE" | "BUSY";
      seq: number;
      focused: boolean;
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
      transportUrl?: string;
    }>
  >;
  createTerminal: (input: {
    sessionId: string;
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: {
      command?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
      gitLog?: false | "none" | "normal" | "verbose";
      logStyle?: "plain" | "rich";
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
    };
    focus?: boolean;
  }) => Promise<{ ok: boolean; message: string; terminal?: unknown }>;
  focusTerminals: (input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }) => Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  deleteTerminal: (input: { sessionId: string; terminalId: string }) => Promise<{ ok: boolean; message: string }>;
  revokeMessageChannelGrant: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    grantId: string;
  }) => Promise<{ ok: boolean }>;
  loadMoreChatMessages: (sessionId: string) => Promise<void>;
  loadMoreChatCycles: (sessionId: string) => Promise<void>;
  loadMoreTrace: (sessionId: string) => Promise<void>;
  loadMoreModel: (sessionId: string) => Promise<void>;
  loadTerminalActivity: (sessionId: string, terminalId: string) => Promise<void>;
  loadMoreTerminalActivity: (sessionId: string, terminalId: string) => Promise<void>;
  toggleWorkspaceFavorite: (path: string) => Promise<void>;
  deleteWorkspace: (path: string) => Promise<void>;
  cleanMissingWorkspaces: () => Promise<void>;
  toggleSessionFavorite: (sessionId: string) => Promise<void>;
  stopWorkspaceSession: (sessionId: string) => Promise<void>;
  archiveWorkspaceSession: (sessionId: string) => Promise<void>;
  restoreWorkspaceSession: (sessionId: string) => Promise<void>;
  deleteWorkspaceSession: (sessionId: string) => Promise<void>;
  loadMoreWorkspaceSessions: () => Promise<void>;
  ensureSettingsLayers: (workspacePath: string) => Promise<void>;
  refreshSettingsLayers: (workspacePath: string) => Promise<void>;
  loadSelectedLayer: (workspacePath: string, layerId: string) => Promise<void>;
  saveSelectedLayer: (workspacePath: string, layerId: string) => Promise<void>;
  setChatVisibility: (input: {
    sessionId: string;
    chatId?: string;
    visible: boolean;
    focused: boolean;
  }) => Promise<void>;
  setTerminalVisibility: (input: {
    sessionId: string;
    terminalId?: string;
    visible: boolean;
    focused: boolean;
  }) => Promise<void>;
  consumeNotifications: (input: {
    sessionId: string;
    chatId?: string;
    terminalId?: string;
    upToMessageId?: string | null;
  }) => Promise<void>;
  hydrateSession: (sessionId: string) => Promise<void>;
  queryAttention: (input: {
    sessionId: string;
    query: string;
    offset?: number;
    limit?: number;
  }) => Promise<AttentionQueryItem[]>;
  listDirectories: (input?: {
    path?: string;
    includeHidden?: boolean;
  }) => Promise<Array<{ name: string; path: string }>>;
  validateDirectory: (path: string) => Promise<{ ok: boolean; path: string }>;
}

export const AppControllerContext = createContext<AppController | null>(null);

export const useAppController = (): AppController => {
  const controller = useContext(AppControllerContext);
  if (!controller) {
    throw new Error("AppControllerContext is not available");
  }
  return controller;
};

type EqualityFn<T> = (left: T, right: T) => boolean;
export type RuntimeStoreReader = Pick<RuntimeStore, "getState" | "subscribe">;

export const useRuntimeStoreSelector = <TSelected,>(
  runtimeStore: RuntimeStoreReader,
  selector: (state: RuntimeClientState) => TSelected,
  isEqual: EqualityFn<TSelected> = Object.is,
): TSelected => {
  const selectorRef = useRef(selector);
  const equalityRef = useRef(isEqual);
  const snapshotRef = useRef<TSelected | null>(null);
  const storeStateRef = useRef<RuntimeClientState | null>(null);

  selectorRef.current = selector;
  equalityRef.current = isEqual;

  return useSyncExternalStore(
    (onStoreChange) =>
      runtimeStore.subscribe((state) => {
        storeStateRef.current = state;
        const next = selectorRef.current(state);
        if (snapshotRef.current !== null && equalityRef.current(snapshotRef.current, next)) {
          return;
        }
        snapshotRef.current = next;
        onStoreChange();
      }),
    () => {
      const state = runtimeStore.getState();
      if (storeStateRef.current === state && snapshotRef.current !== null) {
        return snapshotRef.current;
      }
      storeStateRef.current = state;
      const next = selectorRef.current(state);
      if (snapshotRef.current === null || !equalityRef.current(snapshotRef.current, next)) {
        snapshotRef.current = next;
      }
      return snapshotRef.current;
    },
    () => {
      const state = runtimeStore.getState();
      if (storeStateRef.current === state && snapshotRef.current !== null) {
        return snapshotRef.current;
      }
      storeStateRef.current = state;
      const next = selectorRef.current(state);
      if (snapshotRef.current === null || !equalityRef.current(snapshotRef.current, next)) {
        snapshotRef.current = next;
      }
      return snapshotRef.current;
    },
  );
};

export const useRuntimeSelector = <TSelected,>(
  selector: (state: RuntimeClientState) => TSelected,
  isEqual?: EqualityFn<TSelected>,
): TSelected => {
  const controller = useAppController();
  return useRuntimeStoreSelector(controller.runtimeStore, selector, isEqual);
};
