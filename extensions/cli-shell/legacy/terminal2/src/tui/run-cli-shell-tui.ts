import { createCliRenderer } from "@opentui/core";

import type { CliShellBootstrapResult } from "../bootstrap";
import { CliShellCoreApp } from "./core-app";
import { resolveCliShellInteractionEnhancementProfile } from "./interaction-capabilities";
import { resolveCliShellTuiKeybindings } from "./keybindings";
import type { CliShellObservationReadyBaseline, CliShellTuiStore } from "./types";

export interface CliShellTuiController {
  finished: Promise<void>;
  destroy(): void;
}

export const startCliShellTui = async (input: {
  store: CliShellTuiStore;
  shellName: string;
  attached: CliShellBootstrapResult;
  observationReadyBaseline?: CliShellObservationReadyBaseline | null;
  preconnected?: boolean;
  debug?: boolean;
  debugFilters?: readonly string[];
  experimentalDynamicRefresh?: boolean;
}): Promise<CliShellTuiController> => {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  const settingsFile = await input.store.readSettings(input.attached.session.id, "settings").catch(() => null);
  const keybindings = resolveCliShellTuiKeybindings(settingsFile?.content);
  const interactionProfile = resolveCliShellInteractionEnhancementProfile(input.attached.shellTruthTerminal.entry.backend);
  let done = false;
  let resolveFinished = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  const destroy = () => {
    if (done) {
      return;
    }
    done = true;
    app.dispose();
    input.store.disconnect();
    renderer.destroy();
    resolveFinished();
  };

  const app = new CliShellCoreApp({
    renderer,
    store: input.store,
    sessionId: input.attached.session.id,
    shellName: input.shellName,
    fallbackTerminalId: input.attached.visibleTerminal.entry.terminalId,
    roomChatId: input.attached.room.entry.chatId,
    roomAccessToken: input.attached.room.entry.accessToken,
    runtimeId: input.attached.avatar.runtimeId,
    avatarActorId: input.attached.avatarActorId,
    managed: input.attached.managed,
    keybindings,
    interactionProfile,
    onQuit: destroy,
    observationReadyBaseline: input.observationReadyBaseline ?? null,
    debug: input.debug ?? false,
    debugFilters: input.debugFilters,
    experimentalDynamicRefresh: input.experimentalDynamicRefresh ?? true,
  });
  app.start();

  if (!input.preconnected) {
    try {
      await input.store.connect();
      await input.store.hydrateSessionArtifacts(input.attached.session.id, {
        includeChatHistory: false,
        observabilityMode: "heartbeat",
      });
    } catch (error) {
      destroy();
      throw error;
    }
  }

  return {
    finished,
    destroy,
  };
};
