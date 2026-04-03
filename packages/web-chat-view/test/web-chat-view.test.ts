import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type WebChatSocketFactory, type WebChatSocketLike } from "../src";
import { defineWebChatView, WEB_CHAT_VIEW_TAG } from "../src/custom-element";
import WebChatHostHarness from "./web-chat-host-harness.svelte";
import WebChatViewHost from "../src/web-chat-view-host.svelte";

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

class IntersectionObserverMock {
  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }

  disconnect(): void {}
  unobserve(): void {}
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

const mountHost = (props: Record<string, unknown>) => {
  const target = document.createElement("div");
  target.style.height = "520px";
  document.body.append(target);
  const component = mount(WebChatViewHost, {
    target,
    props: props as never,
  });
  flushSync();
  return { target, component };
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
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("WebSocket", WebSocketMock);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
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
              messageId: "2",
              chatId: "chat-main",
              from: "User",
              kind: "text",
              content: "latest user",
              createdAt: 200,
              updatedAt: 200,
              visibleAt: 200,
              attentionState: "loaded",
              editable: false,
              metadata: {},
              attachments: [],
            },
            {
              rowId: 3,
              messageId: "3",
              chatId: "chat-main",
              from: "jane",
              kind: "text",
              content: "latest reply",
              createdAt: 300,
              updatedAt: 300,
              visibleAt: 300,
              attentionState: "loaded",
              editable: false,
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
    viewport.scrollTop = 0;
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
              messageId: "1",
              chatId: "chat-main",
              from: "User",
              kind: "text",
              content: "earliest message",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              attentionState: "loaded",
              editable: false,
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

    const textarea = document.body.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "hello channel";
    textarea.dispatchEvent(new Event("input"));
    flushSync();

    const sendButton = [...document.body.querySelectorAll("button")].find((button) => button.textContent?.includes("Send"));
    sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();

    await vi.waitFor(() => {
      expect(submitMessage).toHaveBeenCalledWith({ text: "hello channel", assets: [] });
    });
    expect(WebSocketMock.instances).toHaveLength(0);
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
          messageId: "queued-1",
          chatId: "chat-main",
          from: "User",
          to: "jane",
          kind: "text",
          content: "queued visible draft",
          createdAt: 100,
          updatedAt: 100,
          attentionState: "queued",
          editable: true,
          metadata: {},
          attachments: [],
        },
        {
          rowId: 2,
          messageId: "reply-1",
          chatId: "chat-main",
          from: "jane",
          kind: "text",
          content: "assistant reply",
          createdAt: 200,
          updatedAt: 200,
          visibleAt: 200,
          attentionState: "loaded",
          editable: false,
          metadata: {},
          attachments: [],
        },
      ],
    });

    await settleLitUpdates();
    const transcript = readRenderedText(document.body.querySelector("[data-testid='web-chat-scroll-viewport']"));
    expect(transcript.indexOf("queued visible draft")).toBeLessThan(transcript.indexOf("assistant reply"));
    expect(readRenderedText(document.body)).not.toContain("Pending for attention");
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
          messageId: "101",
          chatId: "chat-main",
          from: "User",
          to: "jane",
          kind: "text",
          content: "bootstrap prompt",
          createdAt: 100,
          updatedAt: 100,
          visibleAt: 100,
          attentionState: "loaded",
          editable: false,
          metadata: { channel: "user_input", format: "markdown", cycleId: 7 },
          attachments: [],
        },
        {
          rowId: 2,
          messageId: "102",
          chatId: "chat-main",
          from: "jane",
          kind: "text",
          content: "bootstrap reply",
          createdAt: 200,
          updatedAt: 200,
          visibleAt: 200,
          attentionState: "loaded",
          editable: false,
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
              messageId: "msg-main-user",
              chatId: "chat-main",
              from: "User",
              to: "jane",
              kind: "text",
              content: "bootstrap prompt",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              attentionState: "loaded",
              editable: false,
              metadata: { channel: "user_input", format: "markdown", cycleId: 7 },
              attachments: [],
            },
            {
              rowId: 12,
              messageId: "msg-main-assistant",
              chatId: "chat-main",
              from: "jane",
              kind: "text",
              content: "bootstrap reply",
              createdAt: 200,
              updatedAt: 200,
              visibleAt: 200,
              attentionState: "loaded",
              editable: false,
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
              messageId: "1",
              chatId: "chat-main",
              from: "jane",
              kind: "text",
              content: "stable transcript",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              attentionState: "loaded",
              editable: false,
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

    const textarea = shadowRoot.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("composer textarea missing");
    }
    textarea.value = "element send";
    textarea.dispatchEvent(new Event("input"));
    flushSync();

    const sendButton = [...shadowRoot.querySelectorAll("button")].find((button) => button.textContent?.includes("Send"));
    sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();

    await vi.waitFor(() => {
      expect(submitMessage).toHaveBeenCalledWith({ text: "element send", assets: [] });
    });
  });
});
