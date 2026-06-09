import { mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type {
  CachedResourceState,
  GlobalAvatarCatalogEntry,
  HeartbeatGroupItem,
  HeartbeatPartItem,
  HeartbeatRecordDetail,
  HeartbeatRecordItem,
  HeartbeatRecordPage,
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
    heartbeatRecordsBySession: Record<string, CachedResourceState<HeartbeatRecordPage | null> | undefined>;
    heartbeatRecordDetailsBySession: Record<
      string,
      Record<number, CachedResourceState<HeartbeatRecordDetail | null>> | undefined
    >;
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
    avatarPrincipalId: "avatar-ada",
    runtimeId: "runtime-ada",
    nickname: "ada",
    displayName: "Ada",
    globalPath: "/avatars/ada",
    iconUrl: "http://127.0.0.1:4591/media/avatars/avatar-ada/icon",
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

  const compactGroup: HeartbeatGroupItem = {
    id: 2,
    groupId: "heartbeat-group:compact:2",
    kind: "compact",
    aiCallId: 1,
    createdAt: 2_000,
    updatedAt: 2_100,
    isComplete: false,
    items: [
      {
        id: 2,
        messageId: "message-compact",
        windowId: null,
        aiCallId: 1,
        roundIndex: 2,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 2_000,
        updatedAt: 2_100,
        isComplete: false,
        text: "New compact context is streaming.",
        parts: [
          {
            partId: 1,
            partIndex: 1,
            messageId: "message-compact",
            windowId: null,
            aiCallId: 1,
            roundIndex: 2,
            scope: "heartbeat_part",
            role: "assistant",
            partType: "compact",
            mimeType: null,
            payload: {
              newContext: "New compact context is streaming.",
              oldContext: "Old context snapshot.",
              error: "Partial compact warning",
            },
            createdAt: 2_000,
            updatedAt: 2_100,
            isComplete: false,
          },
        ],
      },
    ],
  };

  const configGroup: HeartbeatGroupItem = {
    id: 3,
    groupId: "heartbeat-group:config:3",
    kind: "config",
    aiCallId: null,
    createdAt: 3_000,
    updatedAt: 3_100,
    isComplete: true,
    items: [
      {
        id: 3,
        messageId: "message-config",
        windowId: null,
        aiCallId: null,
        roundIndex: 3,
        scope: "heartbeat_part",
        role: "config",
        createdAt: 3_000,
        updatedAt: 3_100,
        isComplete: true,
        text: "Next call config changed.",
        parts: [
          {
            partId: 1,
            partIndex: 1,
            messageId: "message-config",
            windowId: null,
            aiCallId: null,
            roundIndex: 3,
            scope: "heartbeat_part",
            role: "config",
            partType: "config",
            mimeType: null,
            payload: {
              oldConfig: { thinking: false, maxToken: 2000 },
              newConfig: { thinking: "auto", maxToken: "adaptive" },
            },
            createdAt: 3_000,
            updatedAt: 3_100,
            isComplete: true,
          },
        ],
      },
    ],
  };

  const recordFromGroup = (item: HeartbeatGroupItem): HeartbeatRecordItem => ({
    id: item.id,
    recordKey: `mock-record:${item.groupId}`,
    kind: item.kind === "compact" ? "compact" : item.kind === "config" ? "config" : "model_call",
    status: item.isComplete ? "completed" : "running",
    primaryAiCallId: item.aiCallId,
    aiCallIds: item.aiCallId === null ? [] : [item.aiCallId],
    sourceRefs: [],
    featureFlags: {},
    summary: {
      provider: item.aiCallId === null ? null : "openai",
      model: item.aiCallId === null ? null : "gpt-test",
      parts: item.items.flatMap((message) =>
        message.parts.map((part) => ({
          messageId: part.messageId,
          partId: String(part.partId),
          role: part.role,
          type: part.partType,
          mimeType: part.mimeType,
          aiCallId: part.aiCallId,
          startedAt: part.createdAt,
          completedAt: part.isComplete ? part.updatedAt : null,
          label: message.text || part.partType,
          isComplete: part.isComplete,
        })),
      ),
      counts: {
        parts: item.items.reduce((sum, message) => sum + message.parts.length, 0),
        toolCalls: item.items.reduce(
          (sum, message) => sum + message.parts.filter((part) => part.partType === "tool_call").length,
          0,
        ),
        toolResults: item.items.reduce(
          (sum, message) => sum + message.parts.filter((part) => part.partType === "tool_result").length,
          0,
        ),
        errors: 0,
      },
      firstFrameMs: null,
      thinkingDurationMs: 0,
    },
    previewText: item.items.map((message) => message.text).find((text) => text.length > 0) ?? null,
    startedAt: item.createdAt,
    updatedAt: item.updatedAt,
    completedAt: item.isComplete ? item.updatedAt : null,
    isComplete: item.isComplete,
  });

  const recordsPageFromGroups = (
    items: HeartbeatGroupItem[],
    pageSize = 20,
    anchor: HeartbeatRecordPage["anchor"] = { kind: "latest" },
  ): HeartbeatRecordPage => {
    const records = items.map(recordFromGroup);
    return {
      records,
      pageIndex: 0,
      pageSize,
      totalRecords: records.length,
      totalPages: records.length > 0 ? Math.ceil(records.length / pageSize) : 0,
      windowTotalRecords: records.length,
      windowTotalPages: records.length > 0 ? Math.ceil(records.length / pageSize) : 0,
      latestRecordId: records[0]?.id ?? null,
      anchor,
      hasOlder: false,
      hasNewer: false,
      newRecordsAvailable: false,
    };
  };

  const modelCalls: ModelCallItem[] = [
    {
      id: 10,
      kind: "chat",
      status: "done",
      provider: "openai",
      model: "gpt-test",
      roundIndex: 1,
      createdAt: 1_000,
      updatedAt: 1_100,
      isComplete: true,
      providerSnapshot: null,
      request: null,
      response: { usage: { outputTokens: 32_000 } },
    },
    {
      id: 11,
      kind: "chat",
      status: "done",
      provider: "openai",
      model: "gpt-test",
      roundIndex: 2,
      createdAt: 1_200,
      updatedAt: 1_300,
      isComplete: true,
      providerSnapshot: null,
      request: null,
      response: { usage: { outputTokens: 8_000 } },
    },
  ];

  const createInitialState = (): MockState => ({
    connected: false,
    connectionStatus: "connecting",
    sessions: [],
    runtimes: {},
    globalAvatarCatalog: coldResource<GlobalAvatarCatalogEntry[]>([]),
    heartbeatGroupsBySession: {},
    heartbeatRecordsBySession: {},
    heartbeatRecordDetailsBySession: {},
    modelCallsBySession: {},
    attentionBySession: {},
    attentionDeliveryBySession: {},
  });

  let compactRequests = 0;
  let startRequests = 0;
  let stopRequests = 0;
  let savedConfigContent = "";
  let avatarCatalogFailure: string | null = null;
  let heartbeatGroups: HeartbeatGroupItem[] = [group];
  let heartbeatRecordPageRequests: Array<{
    sessionId: string;
    input?: { pageSize?: number; anchor?: HeartbeatRecordPage["anchor"] | null };
  }> = [];
  let sessionStatus: SessionEntry["status"] = "stopped";
  let authToken: string | null = null;
  let connectDelayMs = 0;
  let state = createInitialState();
  let listeners = new Set<Listener>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const reset = (): void => {
    compactRequests = 0;
    startRequests = 0;
    stopRequests = 0;
    savedConfigContent = "";
    avatarCatalogFailure = null;
    heartbeatGroups = [group];
    heartbeatRecordPageRequests = [];
    sessionStatus = "stopped";
    authToken = null;
    connectDelayMs = 0;
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
      if (connectDelayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, connectDelayMs));
      }
      if (!authToken) {
        throw new Error("auth token missing");
      }
      const connectedSessions: SessionEntry[] =
        sessionStatus === "running"
          ? [
              {
                id: avatar.runtimeId,
                status: sessionStatus,
                avatar: avatar.nickname,
                avatarPrincipalId: avatar.avatarPrincipalId,
                cwd: avatar.globalPath,
              },
            ]
          : [];
      state = {
        ...state,
        connected: true,
        connectionStatus: "connected",
        sessions: connectedSessions,
        runtimes:
          sessionStatus === "running"
            ? {
                [avatar.runtimeId]: {
                  schedulerState: { runtimeStatus: "running" },
                  attention: { snapshot: { contexts: [] } },
                  attentionDelivery: null,
                },
              }
            : state.runtimes,
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
        avatar: avatar.nickname,
        avatarPrincipalId: avatar.avatarPrincipalId,
        cwd: avatar.globalPath,
      };
      state = {
        ...state,
        sessions: [session],
      };
      emit();
      return session;
    },
    async startSession(sessionId: string) {
      startRequests += 1;
      sessionStatus = "running";
      const session: SessionEntry = {
        id: sessionId,
        status: "running",
        avatar: avatar.nickname,
        avatarPrincipalId: avatar.avatarPrincipalId,
        cwd: avatar.globalPath,
      };
      state = {
        ...state,
        sessions: [session],
        runtimes: {
          ...state.runtimes,
          [sessionId]: {
            schedulerState: { runtimeStatus: "running" },
            attention: { snapshot: { contexts: [] } },
            attentionDelivery: null,
          },
        },
      };
      emit();
    },
    async stopSession(sessionId: string) {
      stopRequests += 1;
      sessionStatus = "stopped";
      const session: SessionEntry = {
        id: sessionId,
        status: "stopped",
        avatar: avatar.nickname,
        avatarPrincipalId: avatar.avatarPrincipalId,
        cwd: avatar.globalPath,
      };
      state = {
        ...state,
        sessions: [session],
        runtimes: {},
      };
      emit();
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
        modelCallsBySession: {
          ...state.modelCallsBySession,
          [sessionId]: modelCalls,
        },
      };
      emit();
    },
    async loadMoreHeartbeatGroups() {
      return { items: 0, hasMore: false };
    },
    async loadHeartbeatRecords(
      sessionId: string,
      input?: { pageSize?: number; anchor?: HeartbeatRecordPage["anchor"] | null },
    ) {
      heartbeatRecordPageRequests.push({ sessionId, input });
      const pageSize = input?.pageSize ?? 20;
      const anchor = input?.anchor ?? { kind: "latest" };
      state = {
        ...state,
        heartbeatRecordsBySession: {
          ...state.heartbeatRecordsBySession,
          [sessionId]: loadedResource(recordsPageFromGroups(heartbeatGroups, pageSize, anchor)),
        },
      };
      emit();
    },
    async loadHeartbeatRecordDetail(sessionId: string, recordId: number) {
      const record = recordsPageFromGroups(heartbeatGroups).records.find((item) => item.id === recordId) ?? null;
      state = {
        ...state,
        heartbeatRecordDetailsBySession: {
          ...state.heartbeatRecordDetailsBySession,
          [sessionId]: {
            ...(state.heartbeatRecordDetailsBySession[sessionId] ?? {}),
            [recordId]: loadedResource(
              record
                ? {
                    record,
                    aiCalls: modelCalls,
                    messages: heartbeatGroups.flatMap((item) => item.items),
                    sourceRefs: record.sourceRefs,
                  }
                : null,
            ),
          },
        },
      };
      emit();
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
                  maxContextTokens: 128000,
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
    useCompactHeartbeat() {
      heartbeatGroups = [compactGroup];
    },
    useConfigHeartbeat() {
      heartbeatGroups = [configGroup];
    },
    useRunningSession() {
      sessionStatus = "running";
    },
    delayConnect(ms: number) {
      connectDelayMs = ms;
    },
    get compactRequests() {
      return compactRequests;
    },
    get startRequests() {
      return startRequests;
    },
    get stopRequests() {
      return stopRequests;
    },
    get savedConfigContent() {
      return savedConfigContent;
    },
    get heartbeatRecordPageRequests() {
      return heartbeatRecordPageRequests;
    },
  };
});

vi.mock("@agenter/client-sdk", () => ({
  createAgenterClient: mockSdk.createAgenterClient,
  createRuntimeStore: mockSdk.createRuntimeStore,
}));

import HeartbeatExampleApp from "../src/lib/HeartbeatExampleApp.svelte";

const flush = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

const documentTextIncludingShadow = (): string => {
  const chunks = [document.body.textContent ?? ""];
  const collectShadowText = (root: ParentNode): void => {
    for (const element of Array.from(root.querySelectorAll("*"))) {
      if (element.shadowRoot) {
        chunks.push(element.shadowRoot.textContent ?? "");
        collectShadowText(element.shadowRoot);
      }
    }
  };
  collectShadowText(document.body);
  return chunks.join(" ");
};

const waitForText = async (text: string): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (documentTextIncludingShadow().includes(text)) {
      return;
    }
    await flush();
  }
  throw new Error(`Timed out waiting for text: ${text}\nBody: ${documentTextIncludingShadow()}`);
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

const connectionSheet = (): HTMLElement | null => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-connection-phase]"));
  return elements.at(-1) ?? null;
};

const findConnectionButton = (): HTMLElement | undefined =>
  Array.from(document.querySelectorAll<HTMLElement>("button, a.button")).find((button) =>
    button.textContent?.includes("Connect"),
  );

const waitForConnectionButton = async (): Promise<HTMLElement> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const target = findConnectionButton();
    if (target) {
      return target;
    }
    await flush();
  }
  throw new Error(`Connection button not found\nBody: ${document.body.innerHTML}`);
};

const findTabByText = (root: ParentNode | null | undefined, text: string): HTMLElement | undefined =>
  Array.from(root?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []).find((tab) => tab.textContent?.includes(text));

const waitForConnectionPhase = async (phase: string): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (connectionSheet()?.dataset.connectionPhase === phase) {
      return;
    }
    await flush();
  }
  throw new Error(`Timed out waiting for connection phase: ${phase}\nBody: ${document.body.innerHTML}`);
};

const clickConnectionButton = async (): Promise<void> => {
  const target = await waitForConnectionButton();
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

  test("Scenario: Given visible connection mode When Connect succeeds Then connecting and success states appear before Avatars are usable", async () => {
    mockSdk.delayConnect(24);
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForConnectionButton();
    await clickConnectionButton();
    await waitForConnectionPhase("connecting");
    await waitForConnectionPhase("success");
    await waitForText("Ada");
  });

  test("Scenario: Given a mobile directory When an Avatar is tapped Then HeartbeatPage renders LoopBus rows", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    expect(document.body.textContent).toContain("Not running");
    expect(document.querySelector<HTMLImageElement>('img[alt="Ada"]')?.src).toContain("/media/avatars/avatar-ada/icon");
    clickFirstAvatar();
    await waitForText("LoopBus heartbeat row");

    expect(document.querySelector('.page[data-name="heartbeat"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Stopped");
    expect(document.body.textContent).toContain("No live push");
    expect(document.querySelector('[title="Request compact"]')).toBeNull();
  });

  test("Scenario: Given a direct Heartbeat record URL When connection hydrates Then the example opens a dedicated record detail route", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialRuntimeId: "runtime-ada",
        initialRecordId: 1,
        initialRecordPageSize: "2",
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Record #1");
    expect(document.querySelector('.page[data-name="heartbeat-record-detail"]')).not.toBeNull();
    expect(document.querySelector('.page[data-name="heartbeat-record-detail"] .navbar .link.back')).not.toBeNull();
    expect(location.pathname).toContain("/heartbeat/runtime-ada/records/1");
    expect(location.search).toContain("pageSize=2");
    expect(mockSdk.heartbeatRecordPageRequests.at(-1)?.input?.pageSize).toBe(2);
  });

  test("Scenario: Given a Compact record detail route When tabs switch Then Framework7 subnavbar owns the context tabs", async () => {
    mockSdk.useCompactHeartbeat();
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialRuntimeId: "runtime-ada",
        initialRecordId: 2,
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Record #2");
    await waitForText("New compact context is streaming.");
    const detailPage = document.querySelector<HTMLElement>('.page[data-name="heartbeat-record-detail"]');
    const subnavbar = detailPage?.querySelector<HTMLElement>(".navbar .subnavbar");
    expect(subnavbar).not.toBeNull();
    expect(subnavbar?.querySelector(".segmented")).not.toBeNull();
    expect(subnavbar?.textContent).toContain("New Context");
    expect(subnavbar?.textContent).toContain("Old Context");
    expect(subnavbar?.textContent).not.toContain("Record #2");

    const oldTab = findTabByText(subnavbar, "Old Context");
    oldTab?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await waitForText("Old context snapshot.");
  });

  test("Scenario: Given a Config record detail route When tabs switch Then Framework7 subnavbar owns the config tabs", async () => {
    mockSdk.useConfigHeartbeat();
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialRuntimeId: "runtime-ada",
        initialRecordId: 3,
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Record #3");
    await waitForText("Diff Config");
    const detailPage = document.querySelector<HTMLElement>('.page[data-name="heartbeat-record-detail"]');
    const subnavbar = detailPage?.querySelector<HTMLElement>(".navbar .subnavbar");
    expect(subnavbar).not.toBeNull();
    expect(subnavbar?.querySelector(".segmented")).not.toBeNull();
    expect(subnavbar?.textContent).toContain("Diff Config");
    expect(subnavbar?.textContent).toContain("New Config");
    expect(subnavbar?.textContent).toContain("Old Config");
    expect(subnavbar?.textContent).not.toContain("Record #3");

    const newTab = findTabByText(subnavbar, "New Config");
    newTab?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await waitForText("thinking: auto");
    const oldTab = findTabByText(subnavbar, "Old Config");
    oldTab?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await waitForText("thinking: false");
  });

  test("Scenario: Given a Heartbeat record list When a record row is tapped Then Framework7 opens the dedicated record detail route", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialRecordPageSize: 2,
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    clickFirstAvatar();
    await waitForText("LoopBus heartbeat row");

    const recordCard = document.querySelector<HTMLElement>('[data-testid="heartbeat-record-1"]');
    expect(recordCard).not.toBeNull();
    recordCard?.closest("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    await waitForText("Record #1");
    expect(document.querySelector('.page[data-name="heartbeat-record-detail"]')).not.toBeNull();
    expect(document.querySelector('.page[data-name="heartbeat"] [data-testid="heartbeat-record-detail"]')).toBeNull();
    expect(location.pathname).toContain("/heartbeat/runtime-ada/records/1");
    expect(location.search).toContain("pageSize=2");
    expect(mockSdk.heartbeatRecordPageRequests.at(-1)?.input?.pageSize).toBe(2);
  });

  test("Scenario: Given a running Avatar When the directory and detail render Then Avatar startup state is visible", async () => {
    mockSdk.useRunningSession();
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    expect(document.body.textContent).toContain("Running");
    clickFirstAvatar();
    await waitForText("LoopBus heartbeat row");
    expect(document.body.textContent).toContain("Live push active");
  });

  test("Scenario: Given a connection failure When the example opens Then the target error is explicit", async () => {
    mockSdk.failAvatarCatalog("catalog offline");
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("catalog offline");
    expect(connectionSheet()?.dataset.connectionOpen).toBe("true");
    expect(connectionSheet()?.dataset.connectionPhase).toBe("failed");
    expect(document.body.textContent).toContain("offline");
  });

  test("Scenario: Given a non-running Avatar with loaded empty Heartbeat When opened Then the page remains a valid DB target with no live push", async () => {
    mockSdk.useEmptyHeartbeat();
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    clickFirstAvatar();
    await waitForText("No Heartbeat records yet");
    expect(document.body.textContent).toContain("valid Heartbeat target");
    expect(document.body.textContent).toContain("No live push");
  });

  test("Scenario: Given a direct Heartbeat URL for an unavailable target When connection hydrates Then the route shows an explicit unavailable target state", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialRuntimeId: "runtime-missing",
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Heartbeat target runtime-missing was not returned by this Agenter target.");
  });

  test("Scenario: Given configable launch mode When an Avatar opens Then context usage Sheet owns compact and config remains reachable", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialMode: "configable",
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    clickFirstAvatar();
    await waitForText("LoopBus heartbeat row");
    const contextUsageButton = document.querySelector<HTMLButtonElement>('[title="Context usage"]');
    const configButton = document.querySelector<HTMLButtonElement>('[title="Configure next call"]');
    const statusTitle = document.querySelector<HTMLElement>(".heartbeat-example-status-subnavbar");

    expect(contextUsageButton).not.toBeNull();
    expect(configButton).not.toBeNull();
    expect(document.querySelector('[role="toolbar"][data-testid="heartbeat-statusbar"]')).not.toBeNull();
    expect(document.querySelectorAll(".ag-heartbeat-toolbar__action")).toHaveLength(2);
    expect(contextUsageButton?.style.getPropertyValue("--ag-heartbeat-context-progress")).toBe("0.3125");
    expect(statusTitle?.textContent).not.toContain("tokens");
    contextUsageButton?.click();
    await waitForText("Context usage");
    expect(document.body.textContent).toContain("31.3%");
    expect(document.body.textContent).toContain("40K / 128K");
    expect(document.body.textContent).not.toContain("Cost");
    const contextSheet = document.querySelector<HTMLElement>('[data-testid="heartbeat-context-usage-sheet"]');
    expect(contextSheet?.classList.contains("ag-heartbeat-modal-sheet")).toBe(true);
    expect(contextSheet?.querySelectorAll(".list").length).toBeGreaterThanOrEqual(2);
    expect(contextSheet?.querySelectorAll(".item-content").length).toBeGreaterThanOrEqual(5);
    expect(contextSheet?.querySelector(".ag-heartbeat-context-meter")).toBeNull();
    expect(contextSheet?.querySelector(".ag-heartbeat-context-progressbar.progressbar")).not.toBeNull();
    expect(contextSheet?.querySelector(".ag-heartbeat-context-sheet__ring")).toBeNull();
    expect(contextSheet?.querySelector(".ag-heartbeat-context-compact .list-button")).not.toBeNull();
    const compactButton = Array.from(document.querySelectorAll<HTMLElement>("button, a")).find((element) =>
      element.textContent?.includes("Request compact"),
    );
    expect(compactButton).not.toBeNull();
    compactButton?.click();
    await waitForText("Compact Heartbeat");
    const confirmButton = Array.from(document.querySelectorAll<HTMLElement>(".dialog-button")).find((button) =>
      button.textContent?.includes("OK"),
    );
    expect(confirmButton).not.toBeNull();
    confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    expect(mockSdk.compactRequests).toBe(1);
    document
      .querySelector<HTMLElement>('[aria-label="Close context usage"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    configButton?.click();
    await waitForText("Next call config");
    expect(document.querySelector(".ag-heartbeat-config-sheet .toggle")).not.toBeNull();
    const saveButton = Array.from(document.querySelectorAll<HTMLElement>("button, a.button")).find((button) =>
      button.textContent?.includes("Save"),
    );
    expect(saveButton).not.toBeNull();
    saveButton?.click();
    await flush();
    expect(mockSdk.savedConfigContent).toContain('"temperature": 0.7');
  });

  test("Scenario: Given configable launch mode When runtime controls are used Then Start and Stop call the adapter lifecycle actions", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialMode: "configable",
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    clickFirstAvatar();
    await waitForText("LoopBus heartbeat row");

    const startButton = document.querySelector<HTMLElement>('[title="Start runtime"]');
    expect(startButton).not.toBeNull();
    startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await waitForText("Live push active");
    expect(mockSdk.startRequests).toBe(1);

    const stopButton = document.querySelector<HTMLElement>('[title="Stop runtime"]');
    expect(stopButton).not.toBeNull();
    stopButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await waitForText("No live push");
    expect(mockSdk.stopRequests).toBe(1);
  });

  test("Scenario: Given a long Heartbeat page When Scroll to bottom is tapped Then PageContent owns the scroll action", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialMode: "configable",
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    clickFirstAvatar();
    await waitForText("LoopBus heartbeat row");

    const pageContent = document.querySelector<HTMLElement>(".heartbeat-example-heartbeat-content");
    const toolbar = document.querySelector<HTMLElement>('[role="toolbar"][data-testid="heartbeat-statusbar"]');
    expect(pageContent).not.toBeNull();
    expect(toolbar).not.toBeNull();
    expect(
      toolbar && pageContent
        ? Boolean(toolbar.compareDocumentPosition(pageContent) & Node.DOCUMENT_POSITION_FOLLOWING)
        : false,
    ).toBe(true);
    const scrollTo = vi.fn();
    if (pageContent) {
      Object.defineProperty(pageContent, "scrollHeight", {
        configurable: true,
        value: 2048,
      });
      Object.defineProperty(pageContent, "clientHeight", {
        configurable: true,
        value: 640,
      });
      Object.defineProperty(pageContent, "scrollTo", {
        configurable: true,
        value: scrollTo,
      });
      pageContent.dispatchEvent(new Event("scroll"));
    }
    await flush();

    const scrollFab = document.querySelector<HTMLElement>(".ag-heartbeat-scroll-fab");
    const scrollFabLink = scrollFab?.querySelector<HTMLElement>("a") ?? scrollFab;
    expect(scrollFab).not.toBeNull();
    expect(scrollFab?.textContent).toContain("Scroll to bottom");
    scrollFabLink?.click();
    await flush();

    expect(scrollTo).toHaveBeenCalledWith({
      top: 2048,
      behavior: "smooth",
    });
  });

  test("Scenario: Given a direct Heartbeat URL When connection hydrates Then the selected Avatar page opens", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialRuntimeId: "runtime-ada",
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("LoopBus heartbeat row");
    expect(document.body.textContent).toContain("Ada Heartbeat");
  });

  test("Scenario: Given silent connect is enabled When config exists Then Avatars load without opening the Connection Sheet", async () => {
    component = mount(HeartbeatExampleApp, {
      target: document.body,
      props: {
        initialSilentConnect: true,
        initialWsUrl: "ws://127.0.0.1:3000/trpc",
      },
    });

    await waitForText("Ada");
    expect(connectionSheet()?.dataset.connectionOpen).toBe("false");
    expect(connectionSheet()?.dataset.connectionPhase).toBe("success");
  });
});
