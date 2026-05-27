import type { CliRenderer } from "@opentui/core";

import {
  buildShellNextNavigationModel,
  type ShellNextNavigationStore,
} from "./navigation-model";
import { defaultShellNextSettings, type ShellNextSettings } from "../product-room/settings";
import { startShellNextNavigationApp, type ShellNextNavigationSelection } from "./navigation-app";

export type { ShellNextNavigationSelection } from "./navigation-app";

export interface ShellNextNavigationTuiController {
  finished: Promise<ShellNextNavigationSelection>;
  destroy(): void;
}

export const startShellNextNavigationTui = async (input: {
  store: ShellNextNavigationStore;
  settings?: ShellNextSettings;
  needsShell: boolean;
  needsAvatar: boolean;
  initialShellName?: string;
  initialAvatarNickname?: string;
  renderer?: CliRenderer;
}): Promise<ShellNextNavigationTuiController> => {
  const settings = input.settings ?? defaultShellNextSettings();
  const model = await buildShellNextNavigationModel(input.store, settings);
  let done = false;
  let activeApp: Awaited<ReturnType<typeof startShellNextNavigationApp>>["app"] | null = null;
  let resolveFinished: (value: ShellNextNavigationSelection) => void = () => {};
  let rejectFinished: (error: Error) => void = () => {};
  const finished = new Promise<ShellNextNavigationSelection>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  const destroy = () => {
    if (done) {
      return;
    }
    done = true;
    activeApp?.dispose();
  };

  try {
    const { app } = await startShellNextNavigationApp({
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
        rejectFinished(new Error("shell-next navigation cancelled"));
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
