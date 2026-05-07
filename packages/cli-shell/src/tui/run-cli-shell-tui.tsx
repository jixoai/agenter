/** @jsxImportSource @opentui/react */

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import type { CliShellBootstrapResult } from "../bootstrap";
import { resolveCliShellTuiKeybindings } from "./keybindings";
import type { CliShellTuiStore } from "./types";
import { CliShellTuiApp } from "./app";

export interface CliShellTuiController {
  finished: Promise<void>;
  destroy(): void;
}

export const startCliShellTui = async (input: {
  store: CliShellTuiStore;
  shellName: string;
  attached: CliShellBootstrapResult;
}): Promise<CliShellTuiController> => {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  const root = createRoot(renderer);
  const settingsFile = await input.store.readSettings(input.attached.session.id, "settings").catch(() => null);
  const keybindings = resolveCliShellTuiKeybindings(settingsFile?.content);
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
      roomChatId={input.attached.room.entry.chatId}
      roomAccessToken={input.attached.room.entry.accessToken}
      runtimeId={input.attached.avatar.runtimeId}
      avatarActorId={input.attached.avatar.avatarPrincipalId ?? input.attached.avatar.nickname}
      managed={input.attached.managed}
      keybindings={keybindings}
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
