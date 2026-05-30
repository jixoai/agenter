import type { CliRenderer } from "@opentui/core";

import {
  buildCliShellNavigationModel,
  type CliShellNavigationStore,
} from "../navigation-model";
import { defaultCliShellSettings, type CliShellSettings } from "./settings";
import { startCliShellNavigationApp, type CliShellNavigationSelection } from "./navigation-app";

export type { CliShellNavigationSelection } from "./navigation-app";

export interface CliShellNavigationTuiController {
  finished: Promise<CliShellNavigationSelection>;
  destroy(): void;
}

export const startCliShellNavigationTui = async (input: {
  store: CliShellNavigationStore;
  settings?: CliShellSettings;
  needsShell: boolean;
  needsAvatar: boolean;
  initialShellName?: string;
  initialAvatarNickname?: string;
  renderer?: CliRenderer;
}): Promise<CliShellNavigationTuiController> => {
  const settings = input.settings ?? defaultCliShellSettings();
  const model = await buildCliShellNavigationModel(input.store, settings);
  let done = false;
  let activeApp: Awaited<ReturnType<typeof startCliShellNavigationApp>>["app"] | null = null;
  let resolveFinished: (value: CliShellNavigationSelection) => void = () => {};
  let rejectFinished: (error: Error) => void = () => {};
  const finished = new Promise<CliShellNavigationSelection>((resolve, reject) => {
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
    const { app } = await startCliShellNavigationApp({
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
        rejectFinished(new Error("cli-shell navigation cancelled"));
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
