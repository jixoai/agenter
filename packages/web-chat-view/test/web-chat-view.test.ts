import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getBottomAnchoredStartScrollTop } from "@agenter/svelte-components";

import { type WebChatMessage, type WebChatSocketFactory, type WebChatSocketLike, type WebChatVisibleMessageFact } from "../src";
import { defineWebChatView, WEB_CHAT_VIEW_TAG } from "../src/custom-element";
import WebChatViewHost from "../src/web-chat-view-host.svelte";
import WebChatHostHarness from "./web-chat-host-harness.svelte";

class WebSocketMock implements WebChatSocketLike {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: WebSocketMock[] = [];

  readyState = 0;
  closeCalls = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Array<(event: Event | MessageEvent) => void>>();

  constructor(readonly url: string) {
    WebSocketMock.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event | MessageEvent) => void): void {
    const queue = this.listeners.get(type) ?? [];
    queue.push(listener);
    this.listeners.set(type, queue);
  }

  removeEventListener(type: string, listener: (event: Event | MessageEvent) => void): void {
    const queue = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      queue.filter((entry) => entry !== listener),
    );
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = WebSocketMock.CLOSED;
    this.emit("close", new Event("close"));
  }

  open(): void {
    this.readyState = WebSocketMock.OPEN;
    this.emit("open", new Event("open"));
  }

  message(data: unknown): void {
    this.emit("message", new MessageEvent("message", { data }));
  }

  error(): void {
    this.emit("error", new Event("error"));
  }

  private emit(type: string, event: Event | MessageEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const socketFactory: WebChatSocketFactory = (url) => new WebSocketMock(url);

const parseBottomRootMargin = (value?: string): number => {
  if (!value) {
    return 0;
  }
  const parts = value.split(/\s+/u).filter((part) => part.length > 0);
  const candidate = parts[2] ?? parts[0] ?? "0";
  const parsed = Number.parseFloat(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isLatestSentinel = (target: Element): target is HTMLElement => {
  return target instanceof HTMLElement && target.dataset.bottomAnchoredTimelineLatestSentinel === "true";
};

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = [];

  private readonly observed = new Set<Element>();
  private readonly rootScrollHandler = (): void => {
    for (const target of this.observed) {
      if (isLatestSentinel(target)) {
        this.emit(target);
      }
    }
  };

  constructor(
    private readonly callback: IntersectionObserverCallback,
    private readonly options: IntersectionObserverInit = {},
  ) {
    IntersectionObserverMock.instances.push(this);
    if (this.options.root instanceof HTMLElement) {
      this.options.root.addEventListener("scroll", this.rootScrollHandler);
    }
  }

  observe(target: Element): void {
    this.observed.add(target);
    this.emit(target);
  }

  disconnect(): void {
    if (this.options.root instanceof HTMLElement) {
      this.options.root.removeEventListener("scroll", this.rootScrollHandler);
    }
    this.observed.clear();
  }

  unobserve(target?: Element): void {
    if (target) {
      this.observed.delete(target);
    }
  }

  private emit(target: Element): void {
    const visible = this.resolveVisibility(target);
    this.callback(
      [
        {
          target,
          isIntersecting: visible,
          intersectionRatio: visible ? 1 : 0,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }

  private resolveVisibility(target: Element): boolean {
    if (!isLatestSentinel(target)) {
      return true;
    }
    if (!(this.options.root instanceof HTMLElement)) {
      return true;
    }
    const threshold = parseBottomRootMargin(this.options.rootMargin);
    return Math.max(0, -this.options.root.scrollTop) <= threshold;
  }
}

class FirstObservationOnlyIntersectionObserverMock {
  private observedCount = 0;
  private readonly observed = new Set<Element>();
  private readonly rootScrollHandler = (): void => {
    for (const target of this.observed) {
      if (isLatestSentinel(target)) {
        this.emit(target, this.resolveLatestSentinelVisibility());
      }
    }
  };

  constructor(
    private readonly callback: IntersectionObserverCallback,
    private readonly options: IntersectionObserverInit = {},
  ) {
    if (this.options.root instanceof HTMLElement) {
      this.options.root.addEventListener("scroll", this.rootScrollHandler);
    }
  }

  observe(target: Element): void {
    this.observed.add(target);
    if (isLatestSentinel(target)) {
      this.emit(target, this.resolveLatestSentinelVisibility());
      return;
    }
    this.observedCount += 1;
    this.emit(target, this.observedCount === 1);
  }

  disconnect(): void {
    if (this.options.root instanceof HTMLElement) {
      this.options.root.removeEventListener("scroll", this.rootScrollHandler);
    }
    this.observed.clear();
  }

  unobserve(target?: Element): void {
    if (target) {
      this.observed.delete(target);
    }
  }

  private resolveLatestSentinelVisibility(): boolean {
    if (!(this.options.root instanceof HTMLElement)) {
      return true;
    }
    const threshold = parseBottomRootMargin(this.options.rootMargin);
    return Math.max(0, -this.options.root.scrollTop) <= threshold;
  }

  private emit(target: Element, visible: boolean): void {
    this.callback(
      [
        {
          target,
          isIntersecting: visible,
          intersectionRatio: visible ? 1 : 0,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 720,
            height: 420,
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 720,
            bottom: 420,
            toJSON: () => ({}),
          },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }

  disconnect(): void {}
  unobserve(): void {}
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const mountedComponents: object[] = [];

const mountHost = (props: Record<string, unknown>) => {
  const target = document.createElement("div");
  target.style.height = "520px";
  document.body.append(target);
  const component = mount(WebChatViewHost, {
    target,
    props: props as never,
  });
  mountedComponents.push(component);
  flushSync();
  return { target, component };
};

const assignFiles = (input: HTMLInputElement, files: File[]): void => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  } as FileList & { [index: number]: File };

  for (const [index, file] of files.entries()) {
    Object.defineProperty(fileList, index, {
      configurable: true,
      enumerable: true,
      value: file,
    });
  }

  Object.defineProperty(input, "files", {
    configurable: true,
    value: fileList,
  });
};

const readRenderedText = (root: Node | ShadowRoot | null): string => {
  if (!root) {
    return "";
  }

  let text = "";
  const visit = (node: Node | ShadowRoot): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      text += node.value;
    }
    if (node instanceof Element && node.shadowRoot) {
      visit(node.shadowRoot);
    }
    for (const child of node.childNodes) {
      visit(child);
    }
  };

  visit(root);
  return text.replace(/\s+/gu, " ").trim();
};

const settleLitUpdates = async (root: ParentNode = document): Promise<void> => {
  await Promise.resolve();

  const pending: Promise<unknown>[] = [];
  const visit = (scope: ParentNode): void => {
    for (const element of Array.from(scope.querySelectorAll("*"))) {
      const candidate = element as Element & {
        updateComplete?: Promise<unknown>;
        shadowRoot?: ShadowRoot | null;
      };
      if (candidate.updateComplete && typeof candidate.updateComplete.then === "function") {
        pending.push(candidate.updateComplete);
      }
      if (candidate.shadowRoot) {
        visit(candidate.shadowRoot);
      }
    }
  };

  visit(root);
  if (pending.length > 0) {
    await Promise.all(pending);
    await Promise.resolve();
  }
};

describe("Feature: web-chat-view package", () => {
  beforeEach(() => {
    WebSocketMock.instances.length = 0;
    IntersectionObserverMock.instances.length = 0;
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 1200;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get() {
        return Number(this.dataset.scrollTop ?? "0");
      },
      set(value: number) {
        this.dataset.scrollTop = String(value);
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value(topOrOptions: ScrollToOptions | number, y?: number) {
        const top =
          typeof topOrOptions === "number"
            ? (typeof y === "number" ? y : 0)
            : (topOrOptions.top ?? 0);
        this.scrollTop = top;
        this.dispatchEvent(new Event("scroll"));
      },
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value(callback: FrameRequestCallback) {
        return window.setTimeout(() => {
          callback(window.performance.now() + 200);
        }, 0);
      },
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value(handle: number) {
        window.clearTimeout(handle);
      },
    });
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("WebSocket", WebSocketMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => `blob:pending-${Math.random().toString(36).slice(2, 8)}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    while (mountedComponents.length > 0) {
      const component = mountedComponents.pop();
      if (component) {
        unmount(component);
      }
    }
    flushSync();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      });
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  test("Scenario: Given a transport snapshot and older page When the host hydrates Then it preserves newer messages and prepends older history", async () => {
    mountHost({
      socketFactory,
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
        transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
      },
    });

    await vi.waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const socket = WebSocketMock.instances[0]!;
    expect(socket.url).toBe("ws://localhost:7777/room/chat-main?token=msgtok_admin");

    socket.open();
    socket.message(
      JSON.stringify({
        type: "snapshot",
        chatId: "chat-main",
        snapshot: {
          channel: {
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "session:jane", label: "jane" },
              { id: "auth:user", label: "User" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          },
          items: [
            {
              rowId: 2,
              messageId: 2,
              chatId: "chat-main",
              from: "User",
              kind: "text",
              content: "latest user",
              createdAt: 200,
              updatedAt: 200,
              visibleAt: 200,
              metadata: {},
              attachments: [],
            },
            {
              rowId: 3,
              messageId: 3,
              chatId: "chat-main",
              from: "jane",
              kind: "text",
              content: "latest reply",
              createdAt: 300,
              updatedAt: 300,
              visibleAt: 300,
              metadata: {},
              attachments: [],
            },
          ],
          nextBefore: { beforeTimeMs: 200, beforeId: 2 },
          hasMoreBefore: true,
          headVersion: "3",
        },
      }),
    );
    flushSync();
    await settleLitUpdates();
    expect(readRenderedText(document.body)).toContain("latest reply");

    const viewport = document.body.querySelector("[data-testid='web-chat-scroll-viewport']") as HTMLDivElement;
    viewport.scrollTop = -40_000;
    viewport.dispatchEvent(new Event("scroll"));
    flushSync();

    expect(socket.sent.some((entry) => entry.includes('"type":"page"'))).toBe(true);

    socket.message(
      JSON.stringify({
        type: "page",
        chatId: "chat-main",
        page: {
          items: [
            {
              rowId: 1,
              messageId: 1,
              chatId: "chat-main",
              from: "User",
              kind: "text",
              content: "earliest message",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              metadata: {},
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
        },
      }),
    );
    flushSync();
    await settleLitUpdates();

    expect(readRenderedText(document.body)).toContain("earliest message");
    expect(readRenderedText(document.body)).toContain("latest reply");
    expect(
      (document.body.querySelector("[data-view-key='1']") as HTMLElement | null)?.dataset.insertMotion,
    ).toBe("older");
  });

  test("Scenario: Given the transcript moves away from latest When the viewport returns to latest Then the affordance appears only while away", async () => {
    mountHost({
      channel: {
        chatId: "chat-scroll-latest",
        kind: "room",
        title: "Scroll latest",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      initialSnapshotResolved: true,
      initialMessages: Array.from({ length: 120 }, (_unused, index) => ({
        rowId: index + 1,
        messageId: index + 1,
        chatId: "chat-scroll-latest",
        from: index % 2 === 0 ? "User" : "jane",
        to: index % 2 === 0 ? "jane" : undefined,
        kind: "text" as const,
        content: `scroll transcript row ${index + 1}`,
        createdAt: (index + 1) * 100,
        updatedAt: (index + 1) * 100,
        visibleAt: (index + 1) * 100,
        metadata: {},
        attachments: [],
      })),
    });

    await settleLitUpdates();

    const viewport = document.body.querySelector("[data-testid='web-chat-scroll-viewport']") as HTMLDivElement;
    const buttonShell = document.body.querySelector(".chat-scroll-latest") as HTMLElement | null;
    const button = document.body.querySelector("[aria-label='Scroll to latest']") as HTMLButtonElement | null;
    expect(buttonShell?.dataset.visible).toBe("false");
    expect(viewport.scrollTop).toBe(0);

    viewport.scrollTop = getBottomAnchoredStartScrollTop(viewport);
    viewport.dispatchEvent(new Event("scroll"));
    flushSync();
    await settleLitUpdates();

    await vi.waitFor(() => {
      expect(buttonShell?.dataset.visible).toBe("true");
    });

    expect(button).not.toBeNull();
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));
    flushSync();
    await settleLitUpdates();

    await vi.waitFor(() => {
      expect(buttonShell?.dataset.visible).toBe("false");
    });
  });

  test("Scenario: Given a host send handler When the composer submits text Then the package delegates to the host instead of raw transport send", async () => {
    const submitMessage = vi.fn(async () => undefined);
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      onSendMessage: submitMessage,
    });

    const editor = document.body.querySelector("[data-testid='web-chat-draft-editor']");
    if (!(editor instanceof HTMLTextAreaElement)) {
      throw new Error("composer editor missing");
    }
    editor.value = "hello channel";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    await Promise.resolve();

    const composerStatus = document.body.querySelector("[part='composer-status']");
    expect(readRenderedText(composerStatus)).not.toContain("Unavailable");
    expect(readRenderedText(composerStatus)).not.toContain("1 file ready");

    const sendButton = [...document.body.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Send"),
    );
    await vi.waitFor(() => {
      expect(sendButton?.hasAttribute("disabled")).toBe(false);
    });
    sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();

    await vi.waitFor(() => {
      expect(submitMessage).toHaveBeenCalledWith({ text: "hello channel", assets: [] });
    });
    expect(WebSocketMock.instances).toHaveLength(0);
  });

  test("Scenario: Given pending files in the shared composer When send is pressed Then the host receives attachment payloads", async () => {
    const submitMessage = vi.fn(async () => undefined);
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      onSendMessage: submitMessage,
    });

    const pendingFile = new File(["spec"], "notes.txt", { type: "text/plain" });
    const fileInput = document.body.querySelector("input[type='file']") as HTMLInputElement;
    assignFiles(fileInput, [pendingFile]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
    await Promise.resolve();

    await vi.waitFor(() => {
      expect(document.body.querySelector("[part='composer-asset']")).toBeTruthy();
    });
    expect(readRenderedText(document.body.querySelector("[part='composer-asset']"))).toContain("notes.txt");
    expect(readRenderedText(document.body.querySelector("[part='composer-status']"))).toContain("1 file ready");

    const sendButton = [...document.body.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Send"),
    );
    await vi.waitFor(() => {
      expect(sendButton?.hasAttribute("disabled")).toBe(false);
    });
    sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();

    await vi.waitFor(() => {
      expect(submitMessage).toHaveBeenCalledWith({ text: "", assets: [pendingFile] });
    });
  });

  test("Scenario: Given pending screenshots in the shared composer When previews render Then media assets use the constrained media rail layout", async () => {
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      onSendMessage: vi.fn(async () => undefined),
    });

    const screenshotFile = new File(["image"], "screenshot.png", { type: "image/png" });
    const fileInput = document.body.querySelector("input[type='file']") as HTMLInputElement;
    assignFiles(fileInput, [screenshotFile]);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
    await Promise.resolve();

    await vi.waitFor(() => {
      expect(document.body.querySelector("[part='composer-media-assets']")).toBeTruthy();
    });
    expect(document.body.querySelector("[part='composer-file-assets']")).toBeNull();
    expect(document.body.querySelector("[data-layout='media']")).toBeTruthy();
    expect(readRenderedText(document.body.querySelector("[data-layout='media']"))).toContain("screenshot.png");
  });

  test("Scenario: Given host actor presentation and attachment metadata When the transcript renders Then canonical avatars and attachment tiles follow host facts", async () => {
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      initialSnapshotResolved: true,
      initialMessages: [
        {
          rowId: 1,
          viewKey: "msg-user",
          messageId: 1,
          chatId: "chat-main",
          senderActorId: "auth:user",
          from: "User",
          kind: "text",
          content: "see attachment",
          createdAt: 100,
          updatedAt: 100,
          visibleAt: 100,
          metadata: {},
          attachments: [
            {
              assetId: "asset-1",
              kind: "image",
              name: "spec.png",
              mimeType: "image/png",
              sizeBytes: 1024,
              url: "https://example.com/spec.png",
            },
          ],
        },
      ],
      resolveActorPresentation: () => ({
        actorId: "auth:user",
        label: "Analyst",
        subtitle: "auth:user",
        iconUrl: "https://example.com/avatar.png",
        kind: "auth",
      }),
    });

    await settleLitUpdates();

    expect(document.body.querySelector("img[alt='Analyst']")).toBeTruthy();
    expect(document.body.querySelector("a[href='https://example.com/spec.png']")).toBeTruthy();
    expect(readRenderedText(document.body)).toContain("spec.png");
    expect(readRenderedText(document.body)).toContain("auth:user");
  });

  test("Scenario: Given edited and recalled room messages When the transcript renders Then revision state stays objective on the same rows", async () => {
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      initialSnapshotResolved: true,
      initialMessages: [
        {
          rowId: 1,
          viewKey: "msg-edited",
          messageId: 1,
          chatId: "chat-main",
          senderActorId: "auth:user",
          from: "User",
          kind: "text",
          content: "corrected answer",
          createdAt: 100,
          updatedAt: 120,
          visibleAt: 100,
          metadata: {},
          attachments: [],
        },
        {
          rowId: 2,
          viewKey: "msg-recalled",
          messageId: 2,
          chatId: "chat-main",
          senderActorId: "auth:user",
          from: "User",
          kind: "text",
          content: "",
          createdAt: 130,
          updatedAt: 140,
          recalledAt: 140,
          recalledByActorId: "auth:user",
          visibleAt: 130,
          metadata: {},
          attachments: [],
        },
      ],
    });

    await settleLitUpdates();

    const rendered = readRenderedText(document.body);
    expect(rendered).toContain("Edited");
    expect(rendered).toContain("corrected answer");
    expect(rendered).toContain("Recalled");
    expect(rendered).toContain("This message was recalled.");
  });

  test("Scenario: Given room read-state projections When the transcript renders Then each message can expose an inline-end read indicator", async () => {
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      initialSnapshotResolved: true,
      initialMessages: [
        {
          rowId: 3,
          viewKey: "msg-progress",
          messageId: 3,
          chatId: "chat-main",
          senderActorId: "auth:user",
          from: "User",
          kind: "text",
          content: "read me",
          createdAt: 100,
          updatedAt: 100,
          visibleAt: 100,
          metadata: {},
          attachments: [],
        },
      ],
      resolveMessageReadProgress: ({ message }: { message: WebChatMessage }) =>
        message.viewKey === "msg-progress"
          ? {
              readCount: 1,
              totalCount: 2,
              title: "1/2 read",
              readActors: [
                {
                  actorId: "auth:user",
                  label: "User",
                  subtitle: "auth:user",
                  iconUrl: null,
                },
              ],
              unreadActors: [
                {
                  actorId: "session:jane",
                  label: "Jane",
                  subtitle: "session:jane",
                  iconUrl: null,
                },
              ],
            }
          : null,
    });

    await settleLitUpdates();

    const indicator = document.body.querySelector("[data-testid='message-read-indicator']");
    expect(indicator).toBeTruthy();
    expect(indicator?.getAttribute("aria-label")).toBe("1/2 read");
    expect(indicator?.getAttribute("data-complete")).toBe("false");

    (indicator as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();
    await Promise.resolve();

    expect(readRenderedText(document.body)).toContain("Read");
    expect(readRenderedText(document.body)).toContain("Unread");
    expect(readRenderedText(document.body)).toContain("Jane");
  });

  test("Scenario: Given host message actions When the menu opens Then the shared row exposes those actions", async () => {
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      initialSnapshotResolved: true,
      initialMessages: [
        {
          rowId: 1,
          viewKey: "msg-user",
          messageId: 1,
          chatId: "chat-main",
          senderActorId: "auth:user",
          from: "User",
          kind: "text",
          content: "menu me",
          createdAt: 100,
          updatedAt: 100,
          visibleAt: 100,
          metadata: {},
          attachments: [],
        },
      ],
      resolveMessageActions: () => [
        {
          id: "inspect",
          label: "Inspect",
          detail: "host",
        },
      ],
    });

    await settleLitUpdates();

    const trigger = document.body.querySelector("button[aria-label='Message actions']") as HTMLButtonElement;
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();
    await Promise.resolve();

    expect(readRenderedText(document.body)).toContain("Inspect");
  });

  test("Scenario: Given shared message actions When the row opens its context menu Then the same action list is available from right click", async () => {
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      initialSnapshotResolved: true,
      initialMessages: [
        {
          rowId: 1,
          viewKey: "msg-user",
          messageId: 1,
          chatId: "chat-main",
          senderActorId: "auth:user",
          from: "User",
          kind: "text",
          content: "context me",
          createdAt: 100,
          updatedAt: 100,
          visibleAt: 100,
          metadata: {},
          attachments: [],
        },
      ],
      resolveMessageActions: () => [
        {
          id: "inspect",
          label: "Inspect",
          detail: "host",
        },
      ],
    });

    await settleLitUpdates();

    const bubble = document.body.querySelector('[part~="message-bubble"]') as HTMLElement;
    bubble.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, button: 2 }));
    flushSync();
    await Promise.resolve();

    expect(readRenderedText(document.body)).toContain("Inspect");
    expect(readRenderedText(document.body)).toContain("Copy message");
  });

  test("Scenario: Given the shared chat surface When it mounts Then transcript and composer regions expose durable styling parts", async () => {
    mountHost({
      channel: {
        chatId: "chat-parts",
        kind: "room",
        title: "Parts room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: false,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      onSendMessage: async () => undefined,
    });

    const surface = document.body.querySelector('[part~="surface"]');
    const transcriptShell = document.body.querySelector('[part~="transcript-shell"]');
    const composer = document.body.querySelector('[part~="composer"]');
    const composerSend = document.body.querySelector('[part~="composer-send"]');

    expect(surface).toBeTruthy();
    expect(transcriptShell).toBeTruthy();
    expect(composer).toBeTruthy();
    expect(composerSend).toBeTruthy();
  });

  test("Scenario: Given an embedded shared room surface When it mounts without the internal header Then the transcript stays primary and composer shortcuts remain visible", async () => {
    mountHost({
      channel: {
        chatId: "chat-embedded",
        kind: "room",
        title: "Embedded room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      showHeader: false,
      onSendMessage: async () => undefined,
    });

    const shell = document.body.querySelector('[part~="shell"]');
    const transcriptShell = document.body.querySelector('[part~="transcript-shell"]');
    const composer = document.body.querySelector('[part~="composer"]');
    const rendered = readRenderedText(document.body);

    expect(shell?.getAttribute("data-embedded")).toBe("true");
    expect(transcriptShell).toBeTruthy();
    expect(composer).toBeTruthy();
    expect(rendered).toContain("@ mention");
    expect(rendered).toContain("/ command");
  });

  test("Scenario: Given an empty room snapshot already resolved When the host mounts before any websocket snapshot arrives Then the transcript shows the empty state instead of infinite loading", async () => {
    mountHost({
      socketFactory,
      channel: {
        chatId: "chat-empty",
        kind: "room",
        title: "Empty room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
        transportUrl: "ws://localhost:7777/room/chat-empty?token=msgtok_admin",
      },
      initialMessages: [],
      initialSnapshotResolved: true,
      emptyTitle: "No room selected",
      emptyMessage: "Choose a room first.",
      emptyTranscriptTitle: "No room facts yet",
      emptyTranscriptMessage: "Send the first message to begin.",
    });

    await vi.waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    flushSync();
    await settleLitUpdates();

    const rendered = readRenderedText(document.body);
    expect(rendered).toContain("No room facts yet");
    expect(rendered).toContain("Send the first message to begin.");
    expect(rendered).not.toContain("Loading channel history...");
  });

  test("Scenario: Given a long room transcript When the host scrolls deep into history Then offscreen rows stay unmounted until the viewport reaches them", async () => {
    mountHost({
      channel: {
        chatId: "chat-virtualized",
        kind: "room",
        title: "Virtualized room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      initialSnapshotResolved: true,
      initialMessages: Array.from({ length: 200 }, (_value, index) => ({
        rowId: index + 1,
        viewKey: `virtual-${index + 1}`,
        messageId: index + 1,
        chatId: "chat-virtualized",
        from: index % 2 === 0 ? "User" : "jane",
        to: index % 2 === 0 ? "jane" : undefined,
        kind: "text" as const,
        content: `virtual transcript row ${index + 1}`,
        createdAt: (index + 1) * 100,
        updatedAt: (index + 1) * 100,
        visibleAt: (index + 1) * 100,
        metadata: {},
        attachments: [],
      })),
    });

    await settleLitUpdates();

    const viewport = document.body.querySelector("[data-testid='web-chat-scroll-viewport']") as HTMLDivElement;
    expect(viewport.querySelector("[data-view-key='virtual-200']")).toBeTruthy();
    expect(viewport.querySelector("[data-view-key='virtual-120']")).toBeNull();
    const firstVirtualWrapper = viewport.querySelector<HTMLElement>(".scroll-view-virtual-item");
    expect(firstVirtualWrapper?.getAttribute("style")).not.toContain("block-size:");
    Object.defineProperties(viewport, {
      clientHeight: {
        configurable: true,
        value: 600,
      },
      scrollHeight: {
        configurable: true,
        value: 40_600,
      },
    });

    viewport.scrollTop = getBottomAnchoredStartScrollTop(viewport);
    viewport.dispatchEvent(new Event("scroll"));
    flushSync();
    await settleLitUpdates();

    await vi.waitFor(() => {
      expect(viewport.querySelector("[data-view-key='virtual-1']")).toBeTruthy();
      expect(viewport.querySelector("[data-view-key='virtual-200']")).toBeNull();
    });
  });

  test("Scenario: Given queued room messages without visibleAt When the transcript renders Then they stay visible in createdAt order without a pending strip", async () => {
    mountHost({
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      initialMessages: [
        {
          rowId: 1,
          viewKey: "queued-1",
          messageId: 1,
          chatId: "chat-main",
          from: "User",
          to: "jane",
          kind: "text",
          content: "queued visible draft",
          createdAt: 100,
          updatedAt: 100,
          metadata: {},
          attachments: [],
        },
        {
          rowId: 2,
          viewKey: "reply-1",
          messageId: 2,
          chatId: "chat-main",
          from: "jane",
          kind: "text",
          content: "assistant reply",
          createdAt: 200,
          updatedAt: 200,
          visibleAt: 200,
          metadata: {},
          attachments: [],
        },
      ],
    });

    await settleLitUpdates();
    const queuedRow = document.body.querySelector("[data-view-key='queued-1']") as HTMLElement | null;
    const replyRow = document.body.querySelector("[data-view-key='reply-1']") as HTMLElement | null;
    expect(queuedRow).toBeTruthy();
    expect(replyRow).toBeTruthy();
    expect(
      Number(queuedRow?.closest<HTMLElement>("[data-source-index]")?.dataset.sourceIndex ?? "-1"),
    ).toBeLessThan(
      Number(replyRow?.closest<HTMLElement>("[data-source-index]")?.dataset.sourceIndex ?? "-1"),
    );
    expect(readRenderedText(document.body)).not.toContain("Pending for attention");
  });

  test("Scenario: Given duplicate-label participants and an explicit viewer actor When the transcript renders Then ownership follows senderActorId instead of labels", async () => {
    mountHost({
      channel: {
        chatId: "chat-duplicate-viewers",
        kind: "room",
        title: "Duplicate labels",
        owner: "ops-bot",
        participants: [
          { id: "auth:analyst-a", label: "Analyst" },
          { id: "session:reviewer", label: "Analyst" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
      },
      viewerActorId: "session:reviewer",
      initialMessages: [
        {
          rowId: 1,
          viewKey: "msg-analyst-a",
          messageId: 1,
          chatId: "chat-duplicate-viewers",
          senderActorId: "auth:analyst-a",
          from: "Analyst",
          kind: "text",
          content: "first analyst",
          createdAt: 100,
          updatedAt: 100,
          visibleAt: 100,
          metadata: {},
          attachments: [],
        },
        {
          rowId: 2,
          viewKey: "msg-reviewer",
          messageId: 2,
          chatId: "chat-duplicate-viewers",
          senderActorId: "session:reviewer",
          from: "Analyst",
          kind: "text",
          content: "viewer analyst",
          createdAt: 200,
          updatedAt: 200,
          visibleAt: 200,
          metadata: {},
          attachments: [],
        },
      ],
      initialSnapshotResolved: true,
    });

    await settleLitUpdates();

    const rows = [...document.body.querySelectorAll<HTMLElement>("[data-message-author]")];
    expect(rows).toHaveLength(2);
    const participantRow = rows.find((row) => readRenderedText(row).includes("first analyst")) ?? null;
    const viewerRow = rows.find((row) => readRenderedText(row).includes("viewer analyst")) ?? null;
    expect(participantRow?.dataset.messageAuthor).toBe("participant");
    expect(viewerRow?.dataset.messageAuthor).toBe("viewer");
  });

  test("Scenario: Given bootstrap transcript rows mirror the transport snapshot with legacy ids When the websocket snapshot arrives Then the view collapses semantic duplicates into one transcript", async () => {
    mountHost({
      socketFactory,
      channel: {
        chatId: "chat-main",
        kind: "room",
        title: "Room",
        owner: "jane",
        participants: [
          { id: "session:jane", label: "jane" },
          { id: "auth:user", label: "User" },
        ],
        createdAt: 1,
        updatedAt: 1,
        focused: true,
        accessRole: "admin",
        accessToken: "msgtok_admin",
        transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
      },
      initialMessages: [
        {
          rowId: 1,
          messageId: 101,
          chatId: "chat-main",
          from: "User",
          to: "jane",
          kind: "text",
          content: "bootstrap prompt",
          createdAt: 100,
          updatedAt: 100,
          visibleAt: 100,
          metadata: { channel: "user_input", format: "markdown", cycleId: 7 },
          attachments: [],
        },
        {
          rowId: 2,
          messageId: 102,
          chatId: "chat-main",
          from: "jane",
          kind: "text",
          content: "bootstrap reply",
          createdAt: 200,
          updatedAt: 200,
          visibleAt: 200,
          metadata: { channel: "to_user", format: "markdown", cycleId: 7 },
          attachments: [],
        },
      ],
    });

    await vi.waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const socket = WebSocketMock.instances[0]!;
    socket.open();
    socket.message(
      JSON.stringify({
        type: "snapshot",
        chatId: "chat-main",
        snapshot: {
          channel: {
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "session:jane", label: "jane" },
              { id: "auth:user", label: "User" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          },
          items: [
            {
              rowId: 11,
              messageId: 11,
              chatId: "chat-main",
              from: "User",
              to: "jane",
              kind: "text",
              content: "bootstrap prompt",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              metadata: { channel: "user_input", format: "markdown", cycleId: 7 },
              attachments: [],
            },
            {
              rowId: 12,
              messageId: 12,
              chatId: "chat-main",
              from: "jane",
              kind: "text",
              content: "bootstrap reply",
              createdAt: 200,
              updatedAt: 200,
              visibleAt: 200,
              metadata: { channel: "to_user", format: "markdown", cycleId: 7 },
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "12",
        },
      }),
    );
    flushSync();
    await settleLitUpdates();

    const renderedText = readRenderedText(document.body);
    expect(renderedText.match(/bootstrap prompt/g)?.length ?? 0).toBe(1);
    expect(renderedText.match(/bootstrap reply/g)?.length ?? 0).toBe(1);
  });

  test("Scenario: Given the active channel metadata refreshes without changing chatId When the host rerenders Then the existing transcript stays mounted and the websocket is not recreated", async () => {
    const target = document.createElement("div");
    target.style.height = "520px";
    document.body.append(target);

    const initialChannel = {
      chatId: "chat-main",
      kind: "room" as const,
      title: "Room",
      owner: "jane",
      participants: [
        { id: "session:jane", label: "jane" },
        { id: "auth:user", label: "User" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
    };

    const component = mount(WebChatHostHarness, {
      target,
      props: {
        socketFactory,
        initialChannel,
      },
    });
    flushSync();

    await vi.waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const socket = WebSocketMock.instances[0]!;
    socket.open();
    socket.message(
      JSON.stringify({
        type: "snapshot",
        chatId: "chat-main",
        snapshot: {
          channel: initialChannel,
          items: [
            {
              rowId: 1,
              messageId: 1,
              chatId: "chat-main",
              from: "jane",
              kind: "text",
              content: "stable transcript",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              metadata: {},
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "1",
        },
      }),
    );
    flushSync();
    await settleLitUpdates();
    expect(readRenderedText(document.body)).toContain("stable transcript");

    component.setChannel({
      ...initialChannel,
      focused: false,
      updatedAt: 2,
    });
    flushSync();
    await settleLitUpdates();

    expect(WebSocketMock.instances).toHaveLength(1);
    expect(readRenderedText(document.body)).toContain("stable transcript");
    unmount(component);
  });

  test("Scenario: Given the latest visible message is already known When channel metadata refreshes without changing chatId Then the host does not clear and re-emit the same visibility fact", async () => {
    const target = document.createElement("div");
    target.style.height = "520px";
    document.body.append(target);

    const latestVisibleMessageIdHandler = vi.fn<(message: WebChatVisibleMessageFact | null) => void>();
    const initialChannel = {
      chatId: "chat-main",
      kind: "room" as const,
      title: "Room",
      owner: "jane",
      participants: [
        { id: "session:jane", label: "jane" },
        { id: "auth:user", label: "User" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
    };

    const component = mount(WebChatHostHarness, {
      target,
      props: {
        socketFactory,
        initialChannel,
        onLatestVisibleMessageIdChange: latestVisibleMessageIdHandler,
      },
    });
    flushSync();

    await vi.waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const socket = WebSocketMock.instances[0]!;
    socket.open();
    socket.message(
      JSON.stringify({
        type: "snapshot",
        chatId: "chat-main",
        snapshot: {
          channel: initialChannel,
          items: [
            {
              rowId: 1,
              messageId: 1,
              chatId: "chat-main",
              from: "jane",
              kind: "text",
              content: "visibility anchor",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              metadata: {},
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "1",
        },
      }),
    );
    flushSync();
    await settleLitUpdates();

    await vi.waitFor(() => {
      expect(latestVisibleMessageIdHandler).toHaveBeenCalledWith({
        viewKey: "1",
        messageId: 1,
        rowId: 1,
      });
    });
    const stableCallCount = latestVisibleMessageIdHandler.mock.calls.length;

    component.setChannel({
      ...initialChannel,
      focused: false,
      updatedAt: 2,
    });
    flushSync();
    await settleLitUpdates();

    expect(latestVisibleMessageIdHandler.mock.calls).toHaveLength(stableCallCount);
    unmount(component);
  });

  test("Scenario: Given the latest visible message is already known When the viewer actor changes Then the host re-emits that same visibility fact for the new viewer exactly once", async () => {
    const target = document.createElement("div");
    target.style.height = "520px";
    document.body.append(target);

    const latestVisibleMessageIdHandler = vi.fn<(message: WebChatVisibleMessageFact | null) => void>();
    const initialChannel = {
      chatId: "chat-main",
      kind: "room" as const,
      title: "Room",
      owner: "jane",
      participants: [
        { id: "session:jane", label: "jane" },
        { id: "session:reviewer", label: "reviewer" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
    };

    const component = mount(WebChatHostHarness, {
      target,
      props: {
        socketFactory,
        initialChannel,
        initialViewerActorId: "session:jane",
        onLatestVisibleMessageIdChange: latestVisibleMessageIdHandler,
      },
    });
    flushSync();

    await vi.waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const socket = WebSocketMock.instances[0]!;
    socket.open();
    socket.message(
      JSON.stringify({
        type: "snapshot",
        chatId: "chat-main",
        snapshot: {
          channel: initialChannel,
          items: [
            {
              rowId: 1,
              messageId: 1,
              chatId: "chat-main",
              from: "jane",
              senderActorId: "session:jane",
              kind: "text",
              content: "visibility anchor",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              metadata: {},
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "1",
        },
      }),
    );
    flushSync();
    await settleLitUpdates();

    await vi.waitFor(() => {
      expect(latestVisibleMessageIdHandler).toHaveBeenCalledWith({
        viewKey: "1",
        messageId: 1,
        rowId: 1,
      });
    });
    const stableCallCount = latestVisibleMessageIdHandler.mock.calls.length;

    component.setViewerActorId("session:reviewer");
    flushSync();
    await settleLitUpdates();

    await vi.waitFor(() => {
      expect(latestVisibleMessageIdHandler.mock.calls).toHaveLength(stableCallCount + 1);
    });
    expect(latestVisibleMessageIdHandler.mock.calls.at(-1)).toEqual([
      {
        viewKey: "1",
        messageId: 1,
        rowId: 1,
      },
    ]);

    component.setViewerActorId("session:reviewer");
    flushSync();
    await settleLitUpdates();

    expect(latestVisibleMessageIdHandler.mock.calls).toHaveLength(stableCallCount + 1);
    unmount(component);
  });

  test("Scenario: Given the transcript stays pinned to the bottom When a newer message arrives before intersection observers report it Then the host still promotes the latest transcript row as visible", async () => {
    vi.stubGlobal("IntersectionObserver", FirstObservationOnlyIntersectionObserverMock);

    const target = document.createElement("div");
    target.style.height = "520px";
    document.body.append(target);

    const latestVisibleMessageIdHandler = vi.fn<(message: WebChatVisibleMessageFact | null) => void>();
    const initialChannel = {
      chatId: "chat-main",
      kind: "room" as const,
      title: "Room",
      owner: "jane",
      participants: [
        { id: "session:jane", label: "jane" },
        { id: "auth:user", label: "User" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
    };

    const component = mount(WebChatHostHarness, {
      target,
      props: {
        socketFactory,
        initialChannel,
        onLatestVisibleMessageIdChange: latestVisibleMessageIdHandler,
      },
    });
    flushSync();

    await vi.waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const socket = WebSocketMock.instances[0]!;
    socket.open();
    socket.message(
      JSON.stringify({
        type: "snapshot",
        chatId: "chat-main",
        snapshot: {
          channel: initialChannel,
          items: [
            {
              rowId: 1,
              messageId: 1,
              chatId: "chat-main",
              from: "User",
              kind: "text",
              content: "first visible",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              metadata: {},
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "1",
        },
      }),
    );
    flushSync();
    await settleLitUpdates();

    await vi.waitFor(() => {
      expect(latestVisibleMessageIdHandler).toHaveBeenCalledWith({
        viewKey: "1",
        messageId: 1,
        rowId: 1,
      });
    });

    socket.message(
      JSON.stringify({
        type: "messages",
        chatId: "chat-main",
        items: [
          {
            rowId: 2,
            messageId: 2,
            chatId: "chat-main",
            from: "jane",
            kind: "text",
            content: "newest while sticky",
            createdAt: 200,
            updatedAt: 200,
            visibleAt: 200,
            metadata: {},
            attachments: [],
          },
        ],
      }),
    );
    flushSync();
    await settleLitUpdates();

    await vi.waitFor(() => {
      expect(latestVisibleMessageIdHandler).toHaveBeenLastCalledWith({
        viewKey: "2",
        messageId: 2,
        rowId: 2,
      });
    });
    expect(
      (document.body.querySelector("[data-view-key='2']") as HTMLElement | null)?.dataset.insertMotion,
    ).toBe("latest");
    unmount(component);
  });

  test("Scenario: Given the channel unmounts before the websocket opens When cleanup runs Then the pending handshake settles without an eager close", async () => {
    const target = document.createElement("div");
    target.style.height = "520px";
    document.body.append(target);

    const component = mount(WebChatViewHost, {
      target,
      props: {
        socketFactory,
        channel: {
          chatId: "chat-main",
          kind: "room",
          title: "Room",
          owner: "jane",
          participants: [
            { id: "session:jane", label: "jane" },
            { id: "auth:user", label: "User" },
          ],
          createdAt: 1,
          updatedAt: 1,
          focused: true,
          accessRole: "admin",
          accessToken: "msgtok_admin",
          transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
        },
      },
    });
    flushSync();

    await vi.waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });

    const socket = WebSocketMock.instances[0]!;
    expect(socket.closeCalls).toBe(0);
    unmount(component);
    expect(socket.closeCalls).toBe(0);

    socket.open();
    expect(socket.closeCalls).toBe(1);
  });

  test("Scenario: Given the Svelte custom element When it mounts with pre-set props Then it hydrates and preserves host callbacks", async () => {
    await defineWebChatView();
    const element = document.createElement(WEB_CHAT_VIEW_TAG) as HTMLElement & {
      channel: Record<string, unknown>;
      submitMessage: (payload: { text: string; assets: File[] }) => Promise<void>;
    };

    const submitMessage = vi.fn(async () => undefined);
    element.channel = {
      chatId: "chat-main",
      kind: "room",
      title: "Room",
      owner: "jane",
      participants: [
        { id: "session:jane", label: "jane" },
        { id: "auth:user", label: "User" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin",
      accessToken: "msgtok_admin",
    };
    element.submitMessage = submitMessage;
    document.body.append(element);

    await Promise.resolve();
    await Promise.resolve();

    const shadowRoot = element.shadowRoot;
    if (!shadowRoot) {
      throw new Error("web-chat-view shadow root missing");
    }

    const editor = shadowRoot.querySelector("[data-testid='web-chat-draft-editor']");
    if (!(editor instanceof HTMLTextAreaElement)) {
      throw new Error("composer editor missing");
    }
    editor.value = "element send";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    await Promise.resolve();

    const sendButton = [...shadowRoot.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Send"),
    );
    await vi.waitFor(() => {
      expect(sendButton?.hasAttribute("disabled")).toBe(false);
    });
    sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();

    await vi.waitFor(() => {
      expect(submitMessage).toHaveBeenCalledWith({ text: "element send", assets: [] });
    });
  });

  test("Scenario: Given the Svelte custom element When read progress and disabled composer props are preset Then it preserves read disclosure rendering and composer visibility policy", async () => {
    await defineWebChatView();
    const element = document.createElement(WEB_CHAT_VIEW_TAG) as HTMLElement & {
      channel: Record<string, unknown>;
      initialMessages: WebChatMessage[];
      initialSnapshotResolved: boolean;
      disabled: boolean;
      showComposerWhenDisabled: boolean;
      resolveMessageReadProgress: (input: { message: WebChatMessage }) => {
        readCount: number;
        totalCount: number;
      } | null;
    };

    element.channel = {
      chatId: "chat-main",
      kind: "room",
      title: "Room",
      owner: "jane",
      participants: [
        { id: "session:jane", label: "jane" },
        { id: "auth:user", label: "User" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin",
      accessToken: "msgtok_admin",
    };
    element.initialMessages = [
      {
        viewKey: "msg-progress",
        rowId: 1,
        chatId: "chat-main",
        senderActorId: "auth:user",
        from: "User",
        kind: "text",
        content: "read me",
        createdAt: 100,
        updatedAt: 100,
        visibleAt: 100,
        readActorIds: [],
        unreadActorIds: [],
        metadata: {},
        attachments: [],
      },
    ];
    element.initialSnapshotResolved = true;
    element.disabled = true;
    element.showComposerWhenDisabled = false;
    element.resolveMessageReadProgress = ({ message }) =>
      message.viewKey === "msg-progress"
        ? {
            readCount: 1,
            totalCount: 1,
          }
        : null;
    document.body.append(element);

    await Promise.resolve();
    await Promise.resolve();

    const shadowRoot = element.shadowRoot;
    if (!shadowRoot) {
      throw new Error("web-chat-view shadow root missing");
    }

    await vi.waitFor(() => {
      expect(shadowRoot.querySelector("[data-testid='web-chat-draft-editor']")).toBeNull();
    });
    await vi.waitFor(() => {
      const indicator = shadowRoot.querySelector("[data-testid='message-read-indicator']");
      expect(indicator?.getAttribute("aria-label")).toBe("1/1 read");
    });
  });
});
