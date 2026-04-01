import type { MessageChannelEntry } from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { MessageChannelMetadataDisclosure } from "../src/features/chat/message-channel-metadata-disclosure";

afterEach(() => {
  cleanup();
});

const actorOptions = [
  {
    actorId: "auth:owner",
    actorKind: "auth" as const,
    label: "Owner",
    subtitle: "wallet_evm:0xowner",
  },
  {
    actorId: "session:observer",
    actorKind: "session" as const,
    label: "Observer",
    subtitle: "/repo/demo",
  },
];

const createChannel = (input: {
  participants?: MessageChannelEntry["participants"];
  updatedAt?: number;
  metadata?: Record<string, unknown>;
} = {}): MessageChannelEntry => ({
  chatId: "room-main",
  kind: "room",
  title: "Main room",
  owner: "Owner",
  participants: input.participants ?? [{ id: "auth:owner", label: "Owner" }],
  metadata: input.metadata ?? { builtIn: false },
  createdAt: 1,
  updatedAt: input.updatedAt ?? 1,
  focused: false,
  accessRole: "admin",
  accessToken: "msgtok_owner",
  participantId: "auth:owner",
  transportUrl: "ws://localhost/room-main",
});

describe("Feature: message channel metadata disclosure", () => {
  test("Scenario: Given an admin repairing a legacy participant When the parent rerenders without a new room revision Then the selected actor draft remains", async () => {
    const channel = createChannel({
      participants: [{ id: "avatar:default", label: "default" }],
    });
    const onUpdateChannel = vi.fn(async ({ channel: current, patch }: { channel: MessageChannelEntry; patch: Record<string, unknown> }) => ({
      ...current,
      ...patch,
    }));
    const { rerender } = render(
      <MessageChannelMetadataDisclosure channel={channel} onUpdateChannel={onUpdateChannel} actorOptions={actorOptions} />,
    );

    fireEvent.click(screen.getByTestId("message-channel-metadata-trigger"));
    const dialog = await screen.findByRole("dialog");
    const actorSelect = within(dialog).getByLabelText("Participant actor 1");
    fireEvent.change(actorSelect, { target: { value: "auth:owner" } });

    rerender(
      <MessageChannelMetadataDisclosure
        channel={{
          ...channel,
          transportUrl: "ws://localhost/room-main?poll=1",
        }}
        onUpdateChannel={onUpdateChannel}
        actorOptions={actorOptions}
      />,
    );

    expect(within(dialog).getByLabelText("Participant actor 1")).toHaveValue("auth:owner");
  });

  test("Scenario: Given a built-in legacy room When the admin opens metadata Then cleanup actions remain available", async () => {
    render(
      <MessageChannelMetadataDisclosure
        channel={createChannel({ metadata: { builtIn: true, primaryRoom: true } })}
        actorOptions={actorOptions}
        onArchiveChannel={async () => undefined}
        onDeleteChannel={async () => undefined}
        onUpdateChannel={async ({ channel }) => channel}
      />,
    );

    fireEvent.click(screen.getByTestId("message-channel-metadata-trigger"));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("button", { name: "Archive channel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Dissolve room" })).toBeInTheDocument();
  });
});
