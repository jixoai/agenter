/** @jsxImportSource @opentui/react */

import type { RuntimeStore } from "@agenter/client-sdk";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import type { CliShellBootstrapResult } from "../bootstrap";
import { CliShellTuiApp } from "./app";

export interface CliShellTuiController {
  finished: Promise<void>;
  destroy(): void;
}

export const startCliShellTui = async (input: {
  store: RuntimeStore;
  shellName: string;
  attached: CliShellBootstrapResult;
}): Promise<CliShellTuiController> => {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  const root = createRoot(renderer);
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
    input.store.disconnect();
    renderer.destroy();
    resolveFinished();
  };

  root.render(
    <CliShellTuiApp
      store={input.store}
      sessionId={input.attached.session.id}
      shellName={input.shellName}
      fallbackTerminalId={input.attached.terminal.entry.terminalId}
      managed={input.attached.managed.managed}
      onQuit={destroy}
    />,
  );

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

  return {
    finished,
    destroy,
  };
};
