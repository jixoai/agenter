import type { CliRenderer } from "@opentui/core";

import type { CliShellRoomBootstrapResult } from "../bootstrap";
import type { CliShellTopLayerAppStore } from "./top-layer-app";
import { startCliShellTopLayerApp } from "./top-layer-app";

export interface CliShellTopLayerTuiController {
  finished: Promise<void>;
  destroy(): void;
}

export const startCliShellTopLayerTui = async (input: {
  store: CliShellTopLayerAppStore & { connect(): Promise<void>; disconnect(): void };
  shellName: string;
  attached: CliShellRoomBootstrapResult;
  renderer?: CliRenderer;
}): Promise<CliShellTopLayerTuiController> => {
  let done = false;
  let resolveFinished = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  let activeApp: Awaited<ReturnType<typeof startCliShellTopLayerApp>>["app"] | null = null;

  const destroy = () => {
    if (done) {
      return;
    }
    done = true;
    activeApp?.dispose();
    input.store.disconnect();
    resolveFinished();
  };

  try {
    await input.store.connect();
    const { app } = await startCliShellTopLayerApp({
      store: input.store,
      shellName: input.shellName,
      terminalId: input.attached.terminal.entry.terminalId,
      renderer: input.renderer,
      onQuit: destroy,
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
