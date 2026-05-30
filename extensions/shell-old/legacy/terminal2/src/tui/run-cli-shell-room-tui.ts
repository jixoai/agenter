import type { CliRenderer } from "@opentui/core";

import type { CliShellRoomBootstrapResult } from "../bootstrap";
import { resolveCliShellTuiKeybindings } from "./keybindings";
import { CliShellRoomApp, startCliShellRoomApp } from "./room-app";
import type { CliShellTuiController } from "./run-cli-shell-tui";
import type { CliShellTuiStore } from "./types";

export const startCliShellRoomTui = async (input: {
  store: CliShellTuiStore;
  shellName: string;
  attached: CliShellRoomBootstrapResult;
  debug?: boolean;
  debugFilters?: readonly string[];
}): Promise<CliShellTuiController> => {
  const settingsFile = await input.store.readSettings(input.attached.session.id, "settings").catch(() => null);
  const keybindings = resolveCliShellTuiKeybindings(settingsFile?.content);
  let done = false;
  let resolveFinished = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  let activeApp: CliShellRoomApp | null = null;
  let activeRenderer: CliRenderer | null = null;
  const destroy = () => {
    if (done) {
      return;
    }
    done = true;
    activeApp?.dispose();
    input.store.disconnect();
    activeRenderer?.destroy();
    resolveFinished();
  };
  const { app, renderer } = await startCliShellRoomApp({
    store: input.store,
    shellName: input.shellName,
    attached: input.attached,
    keybindings,
    debug: input.debug ?? false,
    debugFilters: input.debugFilters,
    onQuit: () => {
      destroy();
    },
  });
  activeApp = app;
  activeRenderer = renderer;

  try {
    await input.store.connect();
    app.start();
  } catch (error) {
    destroy();
    throw error;
  }

  return {
    finished,
    destroy,
  };
};
