import type { MessageChannelEntry } from "@agenter/client-sdk";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@agenter/web-chat-view", () => ({
  WebChatView: () => <div data-testid="web-chat-view">mock-web-chat-view</div>,
}));

import { MessageChannelSurface } from "../src/features/chat/MessageChannelSurface";

const createChannel = (input: {
  chatId: string;
  title: string;
  kind?: "direct" | "room";
  focused?: boolean;
}): MessageChannelEntry => ({
  chatId: input.chatId,
  kind: input.kind ?? "direct",
  title: input.title,
  owner: "jon",
  participants: [
    { id: "avatar:jon", label: "jon", role: "avatar" },
    { id: "user:kzf", label: "kzf", role: "user" },
  ],
  createdAt: 1,
  updatedAt: 1,
  focused: input.focused ?? input.chatId === "chat-main",
  accessRole: "admin",
  accessToken: `msgtok_${input.chatId}`,
  transportUrl: `ws://localhost:7777/chat/${input.chatId}`,
});

describe("Feature: message-channel room tabs", () => {
  test("Scenario: Given per-room unread counts When rendering channel tabs Then each room shows its own unread badge", () => {
    const channels = [
      createChannel({ chatId: "chat-main", title: "Chat" }),
      createChannel({ chatId: "room-ops", title: "Ops room", kind: "room" }),
    ];

    render(
      <MessageChannelSurface
        sessionId="session-1"
        workspacePath="/repo/demo"
        channels={channels}
        unreadByChat={{
          "chat-main": 2,
          "room-ops": 1,
        }}
        selectedChatId="chat-main"
        disabled={false}
        imageCompatible={false}
        onSelectChannel={() => {}}
        onCreateChannel={async () => {}}
        onSendMessage={async () => {}}
        onSearchPaths={async () => []}
      />,
    );

    const mainTab = screen.getByRole("tab", { name: /chat/i });
    expect(within(mainTab).getByText("2")).toBeInTheDocument();

    const roomTab = screen.getByRole("tab", { name: /ops room/i });
    expect(within(roomTab).getByText("1")).toBeInTheDocument();
  });

  test("Scenario: Given a selected room channel When rendering Then the room exposes an explicit focus toggle beside create actions", () => {
    const channels = [
      createChannel({ chatId: "chat-main", title: "Chat", focused: false }),
      createChannel({ chatId: "room-ops", title: "Ops room", kind: "room", focused: false }),
    ];
    const onFocusChannel = vi.fn(async () => undefined);

    render(
      <MessageChannelSurface
        sessionId="session-1"
        workspacePath="/repo/demo"
        channels={channels}
        selectedChatId="room-ops"
        disabled={false}
        imageCompatible={false}
        onSelectChannel={() => {}}
        onCreateChannel={async () => {}}
        onFocusChannel={onFocusChannel}
        onSendMessage={async () => {}}
        onSearchPaths={async () => []}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /focus/i }));

    expect(onFocusChannel).toHaveBeenCalledTimes(1);
    expect(onFocusChannel).toHaveBeenCalledWith(expect.objectContaining({ chatId: "room-ops" }));
  });
});
