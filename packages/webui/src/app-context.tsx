import type {
  DraftResolutionOutput,
  ModelDebugOutput,
  RuntimeClientState,
  RuntimeStore,
  WorkspaceSessionCounts,
  WorkspaceSessionEntry,
  WorkspaceSessionTab,
} from "@agenter/client-sdk";
import { createContext, useContext, useRef, useSyncExternalStore } from "react";

import type { AIInputSuggestion } from "./features/chat/AIInput";
import type { SettingsLayerItem } from "./features/settings/SettingsPanel";

export interface AppController {
  runtimeStore: RuntimeStore;
  notice: string;
  setNotice: (value: string) => void;
  quickstartWorkspacePath: string;
  setQuickstartWorkspacePath: (path: string) => void;
  quickstartDraft: DraftResolutionOutput | null;
  quickstartDraftLoading: boolean;
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
  settingsEffective: string;
  settingsLoading: boolean;
  selectedLayerId: string | null;
  setSelectedLayerId: (layerId: string | null) => void;
  layerDraft: string;
  setLayerDraft: (content: string) => void;
  settingsStatus: string;
  modelDebug: ModelDebugOutput | null;
  modelDebugSessionId: string | null;
  modelDebugLoading: boolean;
  modelDebugError: string | null;
  tracePaging: Record<string, { hasMore: boolean; loading: boolean }>;
  modelPaging: Record<string, { hasMore: boolean; loading: boolean }>;
  chatPaging: Record<string, { hasMore: boolean; loading: boolean }>;
  searchWorkspacePaths: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
  createWorkspaceSession: (workspacePath: string) => Promise<string | null>;
  quickstartSubmit: (payload: { text: string; assets: File[] }) => Promise<string | null>;
  enterWorkspace: () => Promise<string | null>;
  resumeSession: (sessionId: string, workspacePath?: string) => Promise<void>;
  startSession: (sessionId: string) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendChat: (sessionId: string, payload: { text: string; assets: File[] }) => Promise<void>;
  loadMoreChatMessages: (sessionId: string) => Promise<void>;
  loadMoreChatCycles: (sessionId: string) => Promise<void>;
  loadMoreTrace: (sessionId: string) => Promise<void>;
  loadMoreModel: (sessionId: string) => Promise<void>;
  refreshModelDebug: (sessionId: string) => Promise<void>;
  toggleWorkspaceFavorite: (path: string) => Promise<void>;
  deleteWorkspace: (path: string) => Promise<void>;
  cleanMissingWorkspaces: () => Promise<void>;
  toggleSessionFavorite: (sessionId: string) => Promise<void>;
  stopWorkspaceSession: (sessionId: string) => Promise<void>;
  archiveWorkspaceSession: (sessionId: string) => Promise<void>;
  restoreWorkspaceSession: (sessionId: string) => Promise<void>;
  deleteWorkspaceSession: (sessionId: string) => Promise<void>;
  loadMoreWorkspaceSessions: () => Promise<void>;
  refreshSettingsLayers: (workspacePath: string) => Promise<void>;
  loadSelectedLayer: (workspacePath: string, layerId: string) => Promise<void>;
  saveSelectedLayer: (workspacePath: string, layerId: string) => Promise<void>;
  setChatVisibility: (input: { sessionId: string; visible: boolean; focused: boolean }) => Promise<void>;
  consumeNotifications: (input: { sessionId: string; upToMessageId?: string | null }) => Promise<void>;
  hydrateSession: (sessionId: string) => Promise<void>;
  retainApiCallStream: (sessionId: string) => () => void;
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
