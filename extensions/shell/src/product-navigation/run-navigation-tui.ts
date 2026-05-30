import type { CliRenderer } from "@opentui/core";

import {
  buildShellNavigationModel,
  type ShellNavigationStore,
} from "./navigation-model";
import { defaultShellSettings, type ShellSettings } from "../product-room/settings";
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
  let done = false;
  let activeApp: Awaited<ReturnType<typeof startShellNavigationApp>>["app"] | null = null;
  let resolveFinished: (value: ShellNavigationSelection) => void = () => {};
  let rejectFinished: (error: Error) => void = () => {};
  const finished = new Promise<ShellNavigationSelection>((resolve, reject) => {
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
