import type { CliRenderer } from "@opentui/core";

import { startCliShellHelpPanelApp } from "./help-panel-app";

export interface CliShellHelpPanelTuiController {
  finished: Promise<void>;
  destroy(): void;
}

export const startCliShellHelpPanelTui = async (input: {
  shellName: string;
  avatarNickname: string;
  renderer?: CliRenderer;
}): Promise<CliShellHelpPanelTuiController> => {
  let done = false;
  let resolveFinished = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  let activeApp: Awaited<ReturnType<typeof startCliShellHelpPanelApp>>["app"] | null = null;

  const destroy = () => {
    if (done) {
      return;
    }
    done = true;
    activeApp?.dispose();
    resolveFinished();
  };

  try {
    const { app } = await startCliShellHelpPanelApp({
      shellName: input.shellName,
      avatarNickname: input.avatarNickname,
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
