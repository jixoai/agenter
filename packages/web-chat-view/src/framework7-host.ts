import { readable } from "svelte/store";
import { app } from "framework7-svelte";

type Framework7RuntimeApp = {
  $el?: {
    find?: (selector: string) => unknown;
  };
};

const isJsdomEnvironment = (): boolean =>
  typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom");

export const canInitializeFramework7Runtime = (): boolean =>
  typeof window !== "undefined" && !isJsdomEnvironment();

const hasUsableFramework7Runtime = (): boolean => {
  if (!canInitializeFramework7Runtime()) {
    return false;
  }
  const runtimeApp = app.f7 as Framework7RuntimeApp | undefined;
  return typeof runtimeApp?.$el?.find === "function";
};

const framework7RuntimeStore = readable(hasUsableFramework7Runtime(), (set) => {
  set(hasUsableFramework7Runtime());

  if (hasUsableFramework7Runtime() || !canInitializeFramework7Runtime()) {
    return undefined;
  }

  let frameId = 0;
  const sync = (): void => {
    const ready = hasUsableFramework7Runtime();
    set(ready);
    if (ready) {
      return;
    }
    frameId = window.requestAnimationFrame(sync);
  };

  frameId = window.requestAnimationFrame(sync);

  return () => {
    window.cancelAnimationFrame(frameId);
  };
});

export const framework7Runtime = (): boolean => {
  return hasUsableFramework7Runtime();
};

export const useFramework7Runtime = () => framework7RuntimeStore;
