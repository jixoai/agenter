import { afterEach } from "vitest";
import { unmount } from "svelte";

const mounted = new Set<Record<string, unknown>>();

export const trackMountedComponent = (component: Record<string, unknown>): void => {
  mounted.add(component);
};

afterEach(() => {
  for (const component of mounted) {
    unmount(component);
  }
  mounted.clear();
  document.body.replaceChildren();
});
