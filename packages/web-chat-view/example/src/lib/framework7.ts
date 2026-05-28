import Framework7 from "framework7/lite-bundle";
import type { Framework7Plugin } from "framework7/types";
import Framework7Svelte from "framework7-svelte/shared/plugin.js";

let framework7Installed = false;

export const ensureFramework7 = (): void => {
  if (framework7Installed) {
    return;
  }
  Framework7.use(Framework7Svelte as Framework7Plugin);
  framework7Installed = true;
};
