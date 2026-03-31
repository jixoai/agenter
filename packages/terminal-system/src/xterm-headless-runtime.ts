type BunRuntimeGlobal = typeof globalThis & {
  Bun?: unknown;
  window?: typeof globalThis;
};

const runtimeGlobal = globalThis as BunRuntimeGlobal;

/**
 * Bun exposes browser-like globals but does not define `window` in test/runtime
 * contexts. `@xterm/headless` probes `window` during module evaluation, so we
 * normalize that host quirk once at the terminal platform boundary.
 */
if (runtimeGlobal.Bun && typeof runtimeGlobal.window === "undefined") {
  Object.defineProperty(runtimeGlobal, "window", {
    value: globalThis,
    configurable: true,
    writable: true,
  });
}
