import type { CliRenderer } from "@opentui/core";

import {
  buildShellNavigationModel,
  buildShellNavigationShellItems,
  type ShellNavigationStore,
  type ShellNavigationShellItem,
} from "./navigation-model";
import { defaultShellSettings, type ShellSettings } from "../app-room/settings";
import { startShellNavigationApp, type ShellNavigationSelection } from "./navigation-app";

export type { ShellNavigationSelection } from "./navigation-app";

export interface ShellNavigationTuiController {
  finished: Promise<ShellNavigationSelection>;
  destroy(): void;
}

export const startShellNavigationTui = async (input: {
  store: ShellNavigationStore;
  settings?: ShellSettings;
  needsShell: boolean;
  needsAvatar: boolean;
  initialShellName?: string;
  initialAvatarNickname?: string;
  renderer?: CliRenderer;
}): Promise<ShellNavigationTuiController> => {
  const settings = input.settings ?? defaultShellSettings();
  const model = await buildShellNavigationModel(input.store, settings);
  let shellItems: readonly ShellNavigationShellItem[] = model.shellItems;
  let done = false;
  let activeApp: Awaited<ReturnType<typeof startShellNavigationApp>>["app"] | null = null;
  let resolveFinished: (value: ShellNavigationSelection) => void = () => {};
  let rejectFinished: (error: Error) => void = () => {};
  let refreshTimer: Timer | null = null;
  let refreshingShellItems = false;
  let pendingShellRefresh = false;
  const releaseRetainers = [input.store.retainGlobalTerminals?.(), input.store.retainGlobalRooms?.()].filter(
    (release): release is () => void => typeof release === "function",
  );
  let roomGrantRetainers: Array<() => void> = [];
  const updateRoomGrantRetainers = (items: readonly ShellNavigationShellItem[]): void => {
    while (roomGrantRetainers.length > 0) {
      roomGrantRetainers.pop()?.();
    }
    const roomIds = [
      ...new Set(items.flatMap((item) => (item.kind === "shell" && item.roomId ? [item.roomId] : []))),
    ];
    roomGrantRetainers = roomIds
      .map((roomId) => input.store.retainGlobalRoomGrants?.(roomId))
      .filter((release): release is () => void => typeof release === "function");
  };
  updateRoomGrantRetainers(shellItems);
  const readCachedShellItems = async (): Promise<{
    shellItems: readonly ShellNavigationShellItem[];
    defaultShellIndex: number;
  } | null> => {
    const terminalsState = input.store.getGlobalTerminalsState?.();
    if (!terminalsState?.loaded) {
      return null;
    }
    const roomsState = input.store.getGlobalRoomsState?.();
    const rooms = roomsState?.loaded ? roomsState.data : [];
    const roomGrantsByChatId = new Map(
      rooms.map((room) => [room.chatId, input.store.getGlobalRoomGrantsState?.(room.chatId).data ?? []]),
    );
    const auth = (await input.store.getAuthSession?.()) ?? null;
    const next = buildShellNavigationShellItems(
      terminalsState.data,
      settings,
      terminalsState.data,
      rooms,
      auth,
      roomGrantsByChatId,
    );
    const currentNewShell = shellItems.find((item) => item.kind === "new-shell");
    if (currentNewShell && next.items[0]?.kind === "new-shell") {
      return {
        shellItems: [currentNewShell, ...next.items.slice(1)],
        defaultShellIndex: next.defaultIndex,
      };
    }
    return {
      shellItems: next.items,
      defaultShellIndex: next.defaultIndex,
    };
  };
  const refreshShellItems = async (): Promise<void> => {
    if (done || !activeApp) {
      return;
    }
    if (refreshingShellItems) {
      pendingShellRefresh = true;
      return;
    }
    refreshingShellItems = true;
    try {
      const next = await readCachedShellItems();
      if (next && !done && activeApp) {
        shellItems = next.shellItems;
        updateRoomGrantRetainers(shellItems);
        activeApp.updateShellItems(next);
      }
    } finally {
      refreshingShellItems = false;
      if (pendingShellRefresh) {
        pendingShellRefresh = false;
        scheduleShellRefresh();
      }
    }
  };
  const scheduleShellRefresh = (): void => {
    if (done || !input.needsShell || !input.store.subscribe) {
      return;
    }
    if (refreshTimer) {
      return;
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refreshShellItems();
    }, 50);
  };
  const unsubscribe = input.store.subscribe?.(scheduleShellRefresh);
  const finished = new Promise<ShellNavigationSelection>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  const destroy = () => {
    if (done) {
      return;
    }
    done = true;
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    unsubscribe?.();
    while (releaseRetainers.length > 0) {
      releaseRetainers.pop()?.();
    }
    while (roomGrantRetainers.length > 0) {
      roomGrantRetainers.pop()?.();
    }
    activeApp?.dispose();
  };

  try {
    const { app } = await startShellNavigationApp({
      shellItems: model.shellItems,
      defaultShellIndex: model.defaultShellIndex,
      needsShell: input.needsShell,
      avatarItems: model.avatarItems,
      defaultAvatarIndex: model.defaultAvatarIndex,
      needsAvatar: input.needsAvatar,
      initialShellName: input.initialShellName,
      initialAvatarNickname: input.initialAvatarNickname,
      renderer: input.renderer,
      createAvatar: async (nickname) => {
        await input.store.createGlobalAvatar({
          nickname,
          displayName: nickname,
          classify: null,
        });
      },
      onComplete: (selection) => {
        if (done) {
          return;
        }
        resolveFinished(selection);
        destroy();
      },
      onCancel: () => {
        if (done) {
          return;
        }
        rejectFinished(new Error("shell navigation cancelled"));
        destroy();
      },
    });
    activeApp = app;
  } catch (error) {
    destroy();
    throw error;
  }

  return {
    finished,
    destroy,
  };
};
