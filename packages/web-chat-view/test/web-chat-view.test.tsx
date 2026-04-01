import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { WebChatView, type WebChatSocketFactory, type WebChatSocketLike } from "../src";

class WebSocketMock implements WebChatSocketLike {
  static readonly OPEN = 1;
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
    this.readyState = 3;
    this.emit("close", new Event("close"));
  }

  open(): void {
    this.readyState = WebSocketMock.OPEN;
    this.emit("open", new Event("open"));
  }

  message(data: unknown): void {
    this.emit("message", new MessageEvent("message", { data }));
  }

  private emit(type: string, event: Event | MessageEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const socketFactory: WebChatSocketFactory = (url) => new WebSocketMock(url);

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
    vi.stubGlobal(
      "IntersectionObserver",
      class {
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
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(_callback: ResizeObserverCallback) {}
        observe(_target: Element): void {}
        disconnect(): void {}
        unobserve(): void {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("Scenario: Given a transport snapshot and older page When the view hydrates Then it preserves newer messages and prepends older history", async () => {
    render(
      <div style={{ height: 520 }}>
        <WebChatView
          socketFactory={socketFactory}
          channel={{
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          }}
          renderComposer={() => <button type="button">Host composer</button>}
        />
      </div>,
    );

    await waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const socket = WebSocketMock.instances[0]!;
    expect(socket.url).toBe("ws://localhost:7777/room/chat-main?token=msgtok_admin");

    socket?.open();
    socket?.message(
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
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
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
              content: "latest user",
              createdAt: 200,
              metadata: {},
              attachments: [],
            },
            {
              rowId: 3,
              messageId: "3",
              chatId: "chat-main",
              from: "jane",
              content: "latest reply",
              createdAt: 300,
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

    await expect(screen.findByText("latest reply")).resolves.toBeTruthy();

    const viewport = screen.getByTestId("web-chat-scroll-viewport");
    fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(socket?.sent.some((entry) => entry.includes('"type":"page"'))).toBe(true);
    });

    socket?.message(
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
              content: "earliest message",
              createdAt: 100,
              metadata: {},
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
        },
      }),
    );

    await expect(screen.findByText("earliest message")).resolves.toBeTruthy();
    expect(screen.getByText("latest reply")).toBeTruthy();
  });

  test("Scenario: Given a host composer adapter When it submits text Then the websocket transport sends the new message", async () => {
    render(
      <div style={{ height: 520 }}>
        <WebChatView
          socketFactory={socketFactory}
          channel={{
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          }}
          renderComposer={({ onSubmit }) => (
            <button
              type="button"
              onClick={() => {
                void onSubmit({ text: "hello channel", assets: [] });
              }}
            >
              Send adapter message
            </button>
          )}
        />
      </div>,
    );

    await waitFor(() => {
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
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          },
          items: [],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "0",
        },
      }),
    );

    const sendButton = await screen.findByRole("button", { name: "Send adapter message" });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(socket.sent.some((entry) => entry.includes('"type":"send"'))).toBe(true);
    });
  });

  test("Scenario: Given interactive and error channel rows When users interact Then interactive submit sends a normal text message while error cards stay visible", async () => {
    render(
      <div style={{ height: 520 }}>
        <WebChatView
          socketFactory={socketFactory}
          channel={{
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          }}
          renderComposer={() => <button type="button">Host composer</button>}
        />
      </div>,
    );

    await waitFor(() => {
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
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
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
              rowId: 1,
              messageId: "interactive-1",
              chatId: "chat-main",
              from: "jane",
              to: "User",
              kind: "interactive",
              content: "Reply with lunch choice",
              createdAt: 10,
              updatedAt: 10,
              visibleAt: 10,
              attentionState: "loaded",
              editable: false,
              metadata: {},
              attachments: [],
              payload: {
                interactive: {
                  version: "v1",
                  kind: "form",
                  title: "Lunch poll",
                  submitLabel: "Send",
                  fields: [{ id: "choice", label: "Choice", initialValue: "fried rice" }],
                },
              },
            },
            {
              rowId: 2,
              messageId: "error-1",
              chatId: "chat-main",
              from: "jane",
              kind: "error",
              content: "Provider timeout",
              createdAt: 20,
              updatedAt: 20,
              visibleAt: 20,
              attentionState: "loaded",
              editable: false,
              metadata: {},
              attachments: [],
              payload: {
                error: {
                  title: "Runtime error",
                  detail: "Retry later",
                },
              },
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "2",
        },
      }),
    );

    await expect(screen.findByText("Lunch poll")).resolves.toBeTruthy();
    await expect(screen.findByText("Runtime error")).resolves.toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(socket.sent.some((entry) => entry.includes('"type":"send"'))).toBe(true);
    });
  });

  test("Scenario: Given bootstrap messages exist before the transport snapshot arrives When the view is still connecting Then the conversation stays visible instead of collapsing to a blank loading state", async () => {
    render(
      <div style={{ height: 520 }}>
        <WebChatView
          socketFactory={socketFactory}
          channel={{
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          }}
          initialMessages={[
            {
              rowId: 1,
              messageId: "1",
              chatId: "chat-main",
              from: "User",
              to: "jane",
              kind: "text",
              content: "bootstrap message",
              createdAt: 100,
              updatedAt: 100,
              visibleAt: 100,
              attentionState: "loaded",
              editable: false,
              metadata: {},
              attachments: [],
            },
          ]}
          renderComposer={() => <button type="button">Host composer</button>}
        />
      </div>,
    );

    await expect(screen.findByText("bootstrap message")).resolves.toBeTruthy();
    expect(screen.queryByText("Loading channel history...")).toBeNull();
  });

  test("Scenario: Given queued room messages without visibleAt When the transcript renders Then they stay visible in createdAt order without a pending strip", async () => {
    render(
      <div style={{ height: 520 }}>
        <WebChatView
          channel={{
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
          }}
          initialMessages={[
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
          ]}
          renderComposer={() => <button type="button">Host composer</button>}
        />
      </div>,
    );

    await expect(screen.findByText("queued visible draft")).resolves.toBeTruthy();
    expect(screen.queryByText("Pending for attention")).toBeNull();
    expect(screen.queryByText("Queued messages will move into the transcript after attention reads them.")).toBeNull();

    const transcriptText = screen.getByTestId("web-chat-scroll-viewport").textContent ?? "";
    expect(transcriptText.indexOf("queued visible draft")).toBeLessThan(transcriptText.indexOf("assistant reply"));
  });

  test("Scenario: Given bootstrap transcript rows mirror the transport snapshot with legacy ids When the websocket snapshot arrives Then the view collapses the semantic duplicates into a single visible transcript", async () => {
    render(
      <div style={{ height: 520 }}>
        <WebChatView
          socketFactory={socketFactory}
          channel={{
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          }}
          initialMessages={[
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
          ]}
          renderComposer={() => <button type="button">Host composer</button>}
        />
      </div>,
    );

    await waitFor(() => {
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
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
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
              content: "bootstrap prompt",
              createdAt: 100,
              metadata: { channel: "user_input", format: "markdown", cycleId: 7 },
              attachments: [],
            },
            {
              rowId: 12,
              messageId: "msg-main-assistant",
              chatId: "chat-main",
              from: "jane",
              content: "bootstrap reply",
              createdAt: 200,
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

    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(2);
    });
    expect(screen.getAllByText("bootstrap prompt")).toHaveLength(1);
    expect(screen.getAllByText("bootstrap reply")).toHaveLength(1);
  });

  test("Scenario: Given the active channel metadata refreshes without changing chatId When the host rerenders Then the existing transcript stays mounted and the websocket is not recreated", async () => {
    const initialChannel = {
      chatId: "chat-main",
      kind: "room" as const,
      title: "Room",
      owner: "jane",
      participants: [
        { id: "avatar:jane", label: "jane", role: "avatar" as const },
        { id: "user", label: "User", role: "user" as const },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
    };
    const view = render(
      <div style={{ height: 520 }}>
        <WebChatView socketFactory={socketFactory} channel={initialChannel} renderComposer={() => <button type="button">Host composer</button>} />
      </div>,
    );

    await waitFor(() => {
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
              content: "stable transcript",
              createdAt: 100,
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

    await expect(screen.findByText("stable transcript")).resolves.toBeTruthy();

    view.rerender(
      <div style={{ height: 520 }}>
        <WebChatView
          socketFactory={socketFactory}
          channel={{
            ...initialChannel,
            focused: false,
            updatedAt: 2,
          }}
          renderComposer={() => <button type="button">Host composer</button>}
        />
      </div>,
    );

    expect(WebSocketMock.instances).toHaveLength(1);
    expect(screen.getByText("stable transcript")).toBeTruthy();
  });

  test("Scenario: Given React StrictMode When the chat view mounts Then the transport is not double-created during effect replay", async () => {
    render(
      <React.StrictMode>
        <div style={{ height: 520 }}>
          <WebChatView
            socketFactory={socketFactory}
            channel={{
              chatId: "chat-main",
              kind: "room",
              title: "Room",
              owner: "jane",
              participants: [
                { id: "avatar:jane", label: "jane", role: "avatar" },
                { id: "user", label: "User", role: "user" },
              ],
              createdAt: 1,
              updatedAt: 1,
              focused: true,
              accessRole: "admin",
              accessToken: "msgtok_admin",
              transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
            }}
            renderComposer={() => <button type="button">Host composer</button>}
          />
        </div>
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
  });

  test("Scenario: Given the channel unmounts before the websocket opens When cleanup runs Then the pending handshake settles without an eager close", async () => {
    const view = render(
      <div style={{ height: 520 }}>
        <WebChatView
          socketFactory={socketFactory}
          channel={{
            chatId: "chat-main",
            kind: "room",
            title: "Room",
            owner: "jane",
            participants: [
              { id: "avatar:jane", label: "jane", role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
            createdAt: 1,
            updatedAt: 1,
            focused: true,
            accessRole: "admin",
            accessToken: "msgtok_admin",
            transportUrl: "ws://localhost:7777/room/chat-main?token=msgtok_admin",
          }}
          renderComposer={() => <button type="button">Host composer</button>}
        />
      </div>,
    );

    await waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });

    const socket = WebSocketMock.instances[0];
    expect(socket?.closeCalls).toBe(0);

    view.unmount();
    expect(socket?.closeCalls).toBe(0);

    socket?.open();
    expect(socket?.closeCalls).toBe(1);
  });
});
