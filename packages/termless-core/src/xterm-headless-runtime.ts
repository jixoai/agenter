type BunRuntimeGlobal = typeof globalThis & {
  Bun?: unknown;
  window?: typeof globalThis;
};

const runtimeGlobal = globalThis as BunRuntimeGlobal;

if (runtimeGlobal.Bun && typeof runtimeGlobal.window === "undefined") {
  Object.defineProperty(runtimeGlobal, "window", {
    value: globalThis,
    configurable: true,
    writable: true,
  });
}

export {};
