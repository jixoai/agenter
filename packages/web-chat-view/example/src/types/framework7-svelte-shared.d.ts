declare module "framework7-svelte/shared/f7.js" {
  export interface Framework7SharedApp {
    f7?: unknown;
  }

  export const app: Framework7SharedApp;
  export const f7init: (
    rootEl: HTMLElement | null,
    params?: Record<string, unknown>,
    init?: boolean,
  ) => void;
}
