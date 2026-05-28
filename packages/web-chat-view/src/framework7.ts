import Framework7 from "framework7/lite-bundle";
import Framework7Svelte from "framework7-svelte";

let framework7Installed = false;

export const ensureFramework7 = (): void => {
  if (framework7Installed) {
    return;
  }
  Framework7.use(Framework7Svelte);
  framework7Installed = true;
};
