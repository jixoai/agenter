const createMatchMediaList = (query: string): MediaQueryList => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const registerListener = (
    listener: EventListenerOrEventListenerObject | ((event: MediaQueryListEvent) => void) | null | undefined,
  ): void => {
    if (!listener) {
      return;
    }
    if (typeof listener === "function") {
      listeners.add(listener as (event: MediaQueryListEvent) => void);
      return;
    }
    if ("handleEvent" in listener) {
      listeners.add((event) => listener.handleEvent(event));
    }
  };

  const unregisterListener = (
    listener: EventListenerOrEventListenerObject | ((event: MediaQueryListEvent) => void) | null | undefined,
  ): void => {
    if (!listener) {
      return;
    }
    if (typeof listener === "function") {
      listeners.delete(listener as (event: MediaQueryListEvent) => void);
      return;
    }
    if ("handleEvent" in listener) {
      listeners.forEach((candidate) => {
        if ((candidate as unknown as { handleEvent?: unknown }).handleEvent === listener.handleEvent) {
          listeners.delete(candidate);
        }
      });
    }
  };

  const mediaQueryList = {
    matches: false,
    media: query,
    onchange: null,
    addListener: (listener: ((event: MediaQueryListEvent) => void) | null) => {
      registerListener(listener);
    },
    removeListener: (listener: ((event: MediaQueryListEvent) => void) | null) => {
      unregisterListener(listener);
    },
    addEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject | ((event: MediaQueryListEvent) => void) | null,
    ) => {
      registerListener(listener);
    },
    removeEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject | ((event: MediaQueryListEvent) => void) | null,
    ) => {
      unregisterListener(listener);
    },
    dispatchEvent: (event: Event) => {
      const mediaEvent = event as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(mediaEvent);
      }
      return true;
    },
  } satisfies Partial<MediaQueryList>;

  return mediaQueryList as MediaQueryList;
};

type Framework7ReadyCallback = (...args: unknown[]) => void;

const createFramework7EventBus = () => {
  const listeners = new Map<string, Framework7ReadyCallback[]>();

  return {
    on(event: string, callback: Framework7ReadyCallback) {
      listeners.set(event, [...(listeners.get(event) ?? []), callback]);
    },
    once(event: string, callback: Framework7ReadyCallback) {
      const wrapped: Framework7ReadyCallback = (...args) => {
        this.off(event, wrapped);
        callback(...args);
      };
      this.on(event, wrapped);
    },
    off(event: string, callback?: Framework7ReadyCallback) {
      if (!callback) {
        listeners.delete(event);
        return;
      }
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((listener) => listener !== callback),
      );
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
  };
};

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => createMatchMediaList(query),
  });
}

if (typeof window !== "undefined" && !("Framework7ComponentsApp" in window)) {
  Object.defineProperty(window, "Framework7ComponentsApp", {
    configurable: true,
    writable: true,
    value: {
      Framework7: undefined,
      f7: undefined,
      f7events: createFramework7EventBus(),
      theme: {},
      f7routers: {
        views: [],
        tabs: [],
        modals: null,
      },
    },
  });
}
