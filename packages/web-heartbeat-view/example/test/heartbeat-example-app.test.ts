import { mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type {
  CachedResourceState,
  GlobalAvatarCatalogEntry,
  HeartbeatGroupItem,
  HeartbeatPartItem,
  ModelCallItem,
  RuntimeConnectionStatus,
  RuntimeSnapshotEntry,
  SessionEntry,
} from "@agenter/web-heartbeat-view";

const mockSdk = vi.hoisted(() => {
  type Listener = () => void;

  interface MockClient {
    wsUrl: string;
    httpUrl: string;
    close(): void;
  }

  interface MockState {
    connected: boolean;
    connectionStatus: RuntimeConnectionStatus;
    sessions: SessionEntry[];
    runtimes: Record<string, RuntimeSnapshotEntry | undefined>;
    globalAvatarCatalog: CachedResourceState<GlobalAvatarCatalogEntry[]>;
    heartbeatGroupsBySession: Record<string, CachedResourceState<HeartbeatGroupItem[]> | undefined>;
    modelCallsBySession: Record<string, ModelCallItem[] | undefined>;
    attentionBySession: Record<string, RuntimeSnapshotEntry["attention"] | undefined>;
    attentionDeliveryBySession: Record<string, RuntimeSnapshotEntry["attentionDelivery"] | undefined>;
  }

  const loadedResource = <T>(data: T): CachedResourceState<T> => ({
    data,
    loaded: true,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: 1_000,
  });

  const coldResource = <T>(data: T): CachedResourceState<T> => ({
    data,
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  });

  const heartbeatPart = (text: string): HeartbeatPartItem => ({
    id: 1,
    messageId: "message-1",
    windowId: null,
    aiCallId: 1,
    roundIndex: 1,
    scope: "heartbeat_part",
    role: "assistant",
    createdAt: 1_000,
    updatedAt: 1_000,
    isComplete: true,
    text,
    parts: [
      {
        partId: 1,
        partIndex: 1,
        messageId: "message-1",
        windowId: null,
        aiCallId: 1,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        partType: "text",
        mimeType: null,
        payload: { text },
        createdAt: 1_000,
        updatedAt: 1_000,
        isComplete: true,
      },
    ],
  });

  const avatar: GlobalAvatarCatalogEntry = {
    runtimeId: "runtime-ada",
    nickname: "ada",
    displayName: "Ada",
    globalPath: "/avatars/ada",
    iconUrl: null,
    defaultAvatar: true,
  };

  const group: HeartbeatGroupItem = {
    id: 1,
    groupId: "heartbeat-group:call:1",
    kind: "call",
    aiCallId: 1,
    createdAt: 1_000,
    updatedAt: 1_000,
    isComplete: true,
    items: [heartbeatPart("LoopBus heartbeat row")],
  };

  const createInitialState = (): MockState => ({
    connected: false,
    connectionStatus: "connecting",
    sessions: [],
    runtimes: {},
    globalAvatarCatalog: coldResource<GlobalAvatarCatalogEntry[]>([]),
    heartbeatGroupsBySession: {},
    modelCallsBySession: {},
    attentionBySession: {},
    attentionDeliveryBySession: {},
  });

  let compactRequests = 0;
  let savedConfigContent = "";
  let avatarCatalogFailure: string | null = null;
  let heartbeatGroups: HeartbeatGroupItem[] = [group];
  let sessionStatus: SessionEntry["status"] = "stopped";
  let authToken: string | null = null;
  let state = createInitialState();
  let listeners = new Set<Listener>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const reset = (): void => {
    compactRequests = 0;
    savedConfigContent = "";
    avatarCatalogFailure = null;
    heartbeatGroups = [group];
    sessionStatus = "stopped";
    authToken = null;
    state = createInitialState();
    listeners = new Set<Listener>();
  };

  const createAgenterClient = (options: { wsUrl: string }): MockClient => ({
    wsUrl: options.wsUrl,
    httpUrl: options.wsUrl.replace(/^ws/u, "http"),
    close: () => undefined,
  });

  const createRuntimeStore = () => ({
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setAuthToken(token: string | null | undefined) {
      authToken = token?.trim() ? token.trim() : null;
    },
    async autoLogin() {
      return {
        ok: true,
        session: {
          token: "mock-token",
        },
        source: "managed_local",
      } as const;
    },
    async connect() {
      if (!authToken) {
        throw new Error("auth token missing");
      }
      state = {
        ...state,
        connected: true,
        connectionStatus: "connected",
      };
      emit();
    },
    disconnect() {
      state = {
        ...state,
        connected: false,
        connectionStatus: "offline",
      };
      emit();
    },
    async hydrateGlobalAvatarCatalog() {
      if (avatarCatalogFailure) {
        throw new Error(avatarCatalogFailure);
      }
      state = {
        ...state,
        globalAvatarCatalog: loadedResource([avatar]),
      };
      emit();
    },
    async createSession() {
      const session: SessionEntry = {
        id: avatar.runtimeId,
        status: sessionStatus,
      };
      state = {
        ...state,
        sessions: [session],
      };
      emit();
      return session;
    },
    async hydrateSessionArtifacts() {
      state = {
        ...state,
        runtimes: {
          [avatar.runtimeId]: {
            schedulerState: null,
            attention: { snapshot: { contexts: [] } },
            attentionDelivery: null,
          },
        },
      };
      emit();
    },
    async loadHeartbeatGroups(sessionId: string) {
      state = {
        ...state,
        heartbeatGroupsBySession: {
          ...state.heartbeatGroupsBySession,
          [sessionId]: loadedResource(heartbeatGroups),
        },
      };
      emit();
    },
    async loadMoreHeartbeatGroups() {
      return { items: 0, hasMore: false };
    },
    async requestRuntimeCompact() {
      compactRequests += 1;
      return { ok: true };
    },
    async listRuntimeSettingsScope() {
      return {
        scope: "global",
        effective: {
          value: {
            ai: {
              temperature: 0.7,
              maxToken: 1000,
              providers: {
                openai: {
                  model: "gpt-test",
                  maxContextTokens: 2000,
                },
              },
              activeProvider: "openai",
            },
          },
        },
        layers: [
          {
            layerId: "user:avatar",
            sourceId: "user:avatar",
            kind: "avatar",
            editable: true,
          },
        ],
      };
    },
    async readRuntimeSettingsLayer() {
      return {
        layer: {
          layerId: "user:avatar",
          sourceId: "user:avatar",
        },
        path: "/avatars/ada/settings.json",
        content: '{"ai":{"temperature":0.7,"maxToken":1000}}\n',
        mtimeMs: 100,
      };
    },
    async saveRuntimeSettingsLayer(input: { content: string }) {
      savedConfigContent = input.content;
      return {
        ok: true,
        file: {
          layer: {
            layerId: "user:avatar",
            sourceId: "user:avatar",
          },
          path: "/avatars/ada/settings.json",
          content: input.content,
          mtimeMs: 101,
        },
      } as const;
    },
    getState(): MockState {
      return state;
    },
  });

  return {
    reset,
    createAgenterClient,
    createRuntimeStore,
    failAvatarCatalog(message: string) {
      avatarCatalogFailure = message;
    },
    useEmptyHeartbeat() {
      heartbeatGroups = [];
    },
    useRunningSession() {
      sessionStatus = "running";
    },
    get compactRequests() {
      return compactRequests;
    },
    get savedConfigContent() {
      return savedConfigContent;
    },
  };
});

vi.mock("@agenter/client-sdk", () => ({
  createAgenterClient: mockSdk.createAgenterClient,
  createRuntimeStore: mockSdk.createRuntimeStore,
}));

import HeartbeatExampleApp from "../src/lib/HeartbeatExampleApp.svelte";

const flush = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

const waitForText = async (text: string): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (document.body.textContent?.includes(text)) {
      return;
    }
    await flush();
  }
  throw new Error(`Timed out waiting for text: ${text}\nBody: ${document.body.textContent ?? ""}`);
};

const clickFirstAvatar = (): void => {
  const target = Array.from(document.querySelectorAll<HTMLElement>("a.item-link")).find((element) =>
    element.textContent?.includes("Ada"),
  );
  if (!target) {
    throw new Error(`Avatar link not found\nBody: ${document.body.innerHTML}`);
  }
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};

describe("Feature: Web heartbeat view example route flow", () => {
  let component: ReturnType<typeof mount> | null = null;

  beforeEach(() => {
    mockSdk.reset();
    history.replaceState({}, "", "/");
    document.body.innerHTML = "";
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(async () => {
    if (component) {
      await unmount(component);
      component = null;
    }
    document.body.innerHTML = "";
  });

  test("Scenario: Given a mobile directory When an Avatar is tapped Then HeartbeatPage renders LoopBus rows", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    clickFirstAvatar();
    await waitForText("LoopBus heartbeat row");

    expect(location.pathname).toBe("/heartbeat/runtime-ada");
    expect(document.body.textContent).toContain("No live push is active");
    expect(document.querySelector('[title="Request compact"]')).toBeNull();
  });

  test("Scenario: Given a connection failure When the example opens Then the target error is explicit", async () => {
    mockSdk.failAvatarCatalog("catalog offline");
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("catalog offline");
    expect(document.body.textContent).toContain("offline");
  });

  test("Scenario: Given a non-running Avatar with loaded empty Heartbeat When opened Then the page remains a valid DB target with no live push", async () => {
    mockSdk.useEmptyHeartbeat();
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    clickFirstAvatar();
    await waitForText("No Heartbeat rows yet");
    expect(document.body.textContent).toContain("valid Heartbeat target");
    expect(document.body.textContent).toContain("No live push is active");
  });

  test("Scenario: Given a direct Heartbeat URL for an unavailable target When connection hydrates Then the route shows an explicit unavailable target state", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialRuntimeId: "runtime-missing",
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Heartbeat target runtime-missing was not returned by this Agenter target.");
  });

  test("Scenario: Given configable launch mode When an Avatar opens Then compact uses the adapter action", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialMode: "configable",
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    clickFirstAvatar();
    await waitForText("LoopBus heartbeat row");
    const compactButton = document.querySelector<HTMLButtonElement>('[title="Request compact"]');
    const configButton = document.querySelector<HTMLButtonElement>('[title="Configure next call"]');

    expect(compactButton).not.toBeNull();
    expect(configButton).not.toBeNull();
    compactButton?.click();
    await flush();
    expect(mockSdk.compactRequests).toBe(1);
    configButton?.click();
    await waitForText("Next call config");
    const saveButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Save"),
    );
    expect(saveButton).not.toBeNull();
    saveButton?.click();
    await flush();
    expect(mockSdk.savedConfigContent).toContain('"temperature": 0.7');
  });

  test("Scenario: Given a direct Heartbeat URL When connection hydrates Then the selected Avatar page opens", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialRuntimeId: "runtime-ada",
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("LoopBus heartbeat row");
    expect(document.body.textContent).toContain("Ada Heartbeat");
  });
});
