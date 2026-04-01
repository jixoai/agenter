import type { MessageChannelEntry } from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@agenter/web-chat-view", () => ({
  WebChatView: () => <div data-testid="web-chat-view">mock-web-chat-view</div>,
}));

import { MessageChannelSurface } from "../src/features/chat/MessageChannelSurface";

afterEach(() => {
  cleanup();
});

const actorOptions = [
  {
    actorId: "auth:wallet_evm:0xowner",
    actorKind: "auth" as const,
    label: "Owner",
    subtitle: "wallet_evm:0xowner",
  },
  {
    actorId: "session:reviewer",
    actorKind: "session" as const,
    label: "Reviewer avatar",
    subtitle: "/repo/demo",
  },
];

const createChannel = (input: {
  chatId: string;
  title: string;
  kind?: "room";
  focused?: boolean;
}): MessageChannelEntry => ({
  chatId: input.chatId,
  kind: input.kind ?? "room",
  title: input.title,
  owner: "jon",
  participants: [
    { id: "auth:wallet_evm:0xowner", label: "Owner", role: "user" },
    { id: "session:reviewer", label: "Reviewer avatar", role: "avatar" },
  ],
  createdAt: 1,
  updatedAt: 1,
  focused: input.focused ?? input.chatId === "room-main",
  accessRole: "admin",
  accessToken: `msgtok_${input.chatId}`,
  participantId: "auth:wallet_evm:0xowner",
  transportUrl: `ws://localhost:7777/room/${input.chatId}`,
});

describe("Feature: message-channel room tabs", () => {
  test("Scenario: Given per-room unread counts When rendering channel tabs Then each room shows its own unread badge", () => {
    const channels = [
      createChannel({ chatId: "room-main", title: "Main room" }),
      createChannel({ chatId: "room-ops", title: "Ops room" }),
    ];

    render(
      <MessageChannelSurface
        sessionId="session-1"
        workspacePath="/repo/demo"
        channels={channels}
        unreadByChat={{
          "room-main": 2,
          "room-ops": 1,
        }}
        selectedChatId="room-main"
        disabled={false}
        imageCompatible={false}
        onSelectChannel={() => {}}
        onCreateChannel={async () => {}}
        actorOptions={actorOptions}
        onSendMessage={async () => {}}
        onSearchPaths={async () => []}
      />,
    );

    const mainTab = screen.getByRole("tab", { name: /main room/i });
    expect(within(mainTab).getByText("2")).toBeInTheDocument();

    const roomTab = screen.getByRole("tab", { name: /ops room/i });
    expect(within(roomTab).getByText("1")).toBeInTheDocument();
  });

  test("Scenario: Given a selected room channel When rendering Then the room exposes an explicit focus toggle beside create actions", () => {
    const channels = [
      createChannel({ chatId: "room-main", title: "Main room", focused: false }),
      createChannel({ chatId: "room-ops", title: "Ops room", focused: false }),
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
        actorOptions={actorOptions}
        onFocusChannel={onFocusChannel}
        onSendMessage={async () => {}}
        onSearchPaths={async () => []}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /focus/i }));

    expect(onFocusChannel).toHaveBeenCalledTimes(1);
    expect(onFocusChannel).toHaveBeenCalledWith(expect.objectContaining({ chatId: "room-ops" }));
  });

  test("Scenario: Given no existing rooms When creating a room Then the empty state still exposes the create dialog and submits defaults", async () => {
    const onCreateChannel = vi.fn(async () => undefined);

    render(
      <MessageChannelSurface
        sessionId="global-room"
        workspacePath={null}
        channels={[]}
        selectedChatId={null}
        disabled={false}
        imageCompatible={false}
        actorOptions={actorOptions}
        onSelectChannel={() => {}}
        onCreateChannel={onCreateChannel}
        onSendMessage={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New room" }));

    const dialog = await screen.findByRole("dialog", { name: "Create room" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create room" }));

    expect(onCreateChannel).toHaveBeenCalledTimes(1);
    expect(onCreateChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Room 1",
        participants: [
          { id: "session:reviewer", label: "Reviewer avatar", role: "avatar" },
        ],
        metadata: {},
      }),
    );
  });
});
