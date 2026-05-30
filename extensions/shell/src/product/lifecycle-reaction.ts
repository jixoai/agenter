import type { GlobalRoomEntry, GlobalTerminalEntry, RuntimeClientState } from "@agenter/client-sdk";

import type { ShellBindingProjection } from "./bootstrap";
import type { ShellRuntimeStore } from "./runtime-dependencies";

type ShellLifecycleReactionStore = Pick<
  ShellRuntimeStore,
  "archiveGlobalRoom" | "getState" | "listGlobalTerminalHistory" | "subscribe"
>;

export interface ShellTerminalRoomLifecycleReaction {
  archiveBoundRoom(): Promise<void>;
  dispose(): void;
}

const containsKilledTerminal = (terminals: readonly GlobalTerminalEntry[] | undefined, terminalId: string): boolean =>
  terminals?.some((terminal) => terminal.terminalId === terminalId && terminal.processPhase === "killed") === true;

const stateContainsKilledTerminal = (state: Partial<RuntimeClientState>, terminalId: string): boolean =>
  containsKilledTerminal(state.globalTerminalHistory?.data, terminalId) ||
  containsKilledTerminal(state.globalTerminalIndex?.data, terminalId) ||
  containsKilledTerminal(state.globalTerminalArchive?.data, terminalId) ||
  containsKilledTerminal(state.globalTerminals?.data, terminalId);

const isProtectedRoom = (room: GlobalRoomEntry): boolean =>
  room.metadata?.builtIn === true || room.metadata?.primaryRoom === true;

export const createShellTerminalRoomLifecycleReaction = (input: {
  store: ShellLifecycleReactionStore;
  binding: ShellBindingProjection;
  room: GlobalRoomEntry;
}): ShellTerminalRoomLifecycleReaction => {
  let disposed = false;
  let archived = false;
  let archiveTask: Promise<void> | null = null;

  const archiveBoundRoom = async (): Promise<void> => {
    if (disposed || archived || isProtectedRoom(input.room)) {
      return;
    }
    if (archiveTask) {
      return await archiveTask;
    }
    archived = true;
    archiveTask = input.store
      .archiveGlobalRoom({
        chatId: input.binding.roomId,
        accessToken: input.room.accessToken,
        archivedBy: input.binding.avatarActorId,
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        archived = false;
        throw error;
      })
      .finally(() => {
        archiveTask = null;
      });
    await archiveTask;
  };

  const archiveWhenBoundTerminalIsKilled = async (): Promise<void> => {
    if (disposed || archived) {
      return;
    }
    if (stateContainsKilledTerminal(input.store.getState(), input.binding.terminalId)) {
      // Shell-next owns only this product binding reaction; room archive then enters kernel lifecycle law.
      await archiveBoundRoom();
    }
  };

  const unsubscribe = input.store.subscribe(() => {
    void archiveWhenBoundTerminalIsKilled();
  });
  void input.store
    .listGlobalTerminalHistory()
    .then(archiveWhenBoundTerminalIsKilled)
    .catch(() => undefined);

  return {
    archiveBoundRoom,
    dispose: () => {
      disposed = true;
      unsubscribe();
    },
  };
};
