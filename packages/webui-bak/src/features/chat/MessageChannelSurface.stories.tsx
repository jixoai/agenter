import type { MessageChannelEntry } from "@agenter/client-sdk";
import { type WebChatSocketFactory, type WebChatSocketLike } from "@agenter/web-chat-view";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { MessageChannelSurface } from "./MessageChannelSurface";
import type { MessageChannelCreateInput } from "./message-channel-create-dialog";

const noopCreateChannel = async (_input: MessageChannelCreateInput): Promise<void> => undefined;
const createChannelViaMetadataDialogSpy = fn(noopCreateChannel);

const actorOptions = [
  {
    actorId: "auth:owner",
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
  transportUrl?: string | null;
}): MessageChannelEntry => ({
  chatId: input.chatId,
  kind: input.kind ?? "room",
  title: input.title,
  owner: "jane",
  participants: [
    { id: "auth:owner", label: "Owner" },
    { id: "session:reviewer", label: "Reviewer avatar" },
  ],
  createdAt: 1,
  updatedAt: 1,
  focused: input.focused ?? false,
  accessRole: "admin",
  accessToken: `msgtok_${input.chatId.replace(/[^a-z0-9]/gi, "")}`,
  participantId: "auth:owner",
  transportUrl:
    input.transportUrl === null
      ? undefined
      : (input.transportUrl ??
        `ws://localhost:7777/room/${input.chatId}?token=msgtok_${input.chatId.replace(/[^a-z0-9]/gi, "")}`),
});

const channels = [
  createChannel({ chatId: "room-jane", title: "Jane room" }),
  createChannel({ chatId: "room-team", title: "Team room" }),
];

const transcriptByChatId: Record<string, string> = {
  "room-jane": "Jane room: I reviewed the latest room transport.",
  "room-team": "Team room: terminal and message channels now share the same control plane.",
};

type SocketMode = "snapshot" | "loading" | "error" | "typed";

class StorySocket implements WebChatSocketLike {
  static readonly OPEN = 1;

  readyState = 0;
  private readonly listeners = new Map<string, Array<(event: Event | MessageEvent) => void>>();

  constructor(
    readonly url: string,
    private readonly channel: MessageChannelEntry,
    private readonly mode: SocketMode,
  ) {
    queueMicrotask(() => {
      if (this.mode === "error") {
        this.readyState = StorySocket.OPEN;
        this.emit("open", new Event("open"));
        this.emit("error", new Event("error"));
        return;
      }
      if (this.mode === "loading") {
        return;
      }
      this.readyState = StorySocket.OPEN;
      this.emit("open", new Event("open"));
      const typedItems =
        this.mode === "typed" && this.channel.chatId === "room-jane"
          ? [
              {
                rowId: 1,
                messageId: "typed-interactive-1",
                chatId: this.channel.chatId,
                rootId: "7",
                from: this.channel.owner,
                to: "kzf",
                kind: "interactive",
                content: "Please submit your lunch choice.",
                createdAt: 100,
                metadata: {},
                attachments: [],
                payload: {
                  interactive: {
                    version: "v1",
                    kind: "form",
                    title: "Lunch poll",
                    submitLabel: "Reply",
                    fields: [{ id: "choice", label: "Choice", initialValue: "fried rice" }],
                  },
                },
              },
              {
                rowId: 2,
                messageId: "typed-error-2",
                chatId: this.channel.chatId,
                from: this.channel.owner,
                kind: "error",
                content: "Provider timeout",
                createdAt: 101,
                metadata: {},
                attachments: [],
                payload: {
                  error: {
                    title: "Runtime error",
                    detail: "Retry later",
                  },
                },
              },
            ]
          : [
              {
                rowId: this.channel.chatId === "room-jane" ? 1 : 2,
                messageId: this.channel.chatId === "room-jane" ? "1" : "2",
                chatId: this.channel.chatId,
                rootId: this.channel.chatId === "room-jane" ? "7" : undefined,
                from: this.channel.owner,
                kind: "text",
                content: transcriptByChatId[this.channel.chatId],
                createdAt: this.channel.chatId === "room-jane" ? 100 : 200,
                metadata: {},
                attachments: [],
                payload: undefined,
              },
            ];
      this.emit(
        "message",
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "snapshot",
            chatId: this.channel.chatId,
            snapshot: {
              channel: this.channel,
              items: typedItems,
              nextBefore: null,
              hasMoreBefore: false,
              headVersion: this.channel.chatId,
            },
          }),
        }),
      );
    });
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

  send(_data: string): void {}

  close(): void {
    this.readyState = 3;
    this.emit("close", new Event("close"));
  }

  private emit(type: string, event: Event | MessageEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const createSocketFactory = (items: MessageChannelEntry[], mode: SocketMode): WebChatSocketFactory => {
  const byChatId = new Map(items.map((channel) => [channel.chatId, channel]));
  return (url: string) => {
    const chatId = new URL(url).pathname.split("/").at(-1) ?? "";
    const channel = byChatId.get(chatId);
    if (!channel) {
      throw new Error(`missing story channel for ${chatId}`);
    }
    return new StorySocket(url, channel, mode);
  };
};

const SurfaceStory = ({
  compact,
  items = channels,
  channelsLoading = false,
  channelsError = null,
  socketMode = "snapshot",
  onSendMessage = fn(async () => undefined),
  onCreateChannel = fn(async (_input: MessageChannelCreateInput) => undefined),
  onOpenDevtools = fn(),
}: {
  compact: boolean;
  items?: MessageChannelEntry[];
  channelsLoading?: boolean;
  channelsError?: string | null;
  socketMode?: SocketMode;
  onSendMessage?: (input: { channel: MessageChannelEntry; payload: { text: string; assets: File[] } }) => Promise<void>;
  onCreateChannel?: (input: MessageChannelCreateInput) => Promise<void>;
  onOpenDevtools?: (cycleId: number) => void;
}) => {
  const [channelsState, setChannelsState] = useState(items);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(items[0]?.chatId ?? null);
  const socketFactory = useMemo(() => createSocketFactory(channelsState, socketMode), [channelsState, socketMode]);

  useEffect(() => {
    setChannelsState(items);
    setSelectedChatId(items[0]?.chatId ?? null);
  }, [items]);

  return (
    <div
      data-testid="message-channel-surface-story"
      className={compact ? "h-[780px] w-[390px] bg-slate-100 p-3" : "h-[820px] w-[960px] bg-slate-100 p-6"}
    >
      <MessageChannelSurface
        sessionId="session-story"
        workspacePath="/repo/demo"
        channels={channelsState}
        selectedChatId={selectedChatId}
        channelsLoading={channelsLoading}
        channelsError={channelsError}
        disabled={false}
        imageCompatible={false}
        onSelectChannel={setSelectedChatId}
        onCreateChannel={onCreateChannel}
        actorOptions={actorOptions}
        onSendMessage={onSendMessage}
        onSearchPaths={async () => []}
        socketFactory={socketFactory}
        onOpenDevtools={onOpenDevtools}
      />
    </div>
  );
};

const meta = {
  title: "Features/Chat/MessageChannelSurface",
  component: MessageChannelSurface,
  args: {
    sessionId: "session-story",
    workspacePath: "/repo/demo",
    channels,
    selectedChatId: channels[0]?.chatId ?? null,
    channelsLoading: false,
    channelsError: null,
    disabled: false,
    imageCompatible: false,
    routeNotice: null,
    assistantAvatarUrl: null,
    assistantAvatarLabel: "jane",
    userAvatarLabel: "You",
    onSelectChannel: () => undefined,
    onCreateChannel: () => undefined,
    onSendMessage: async () => undefined,
    onCommand: async () => undefined,
    onSearchPaths: async () => [],
    onLatestVisibleAssistantMessageIdChange: () => undefined,
    onOpenDevtools: () => undefined,
  },
} satisfies Meta<typeof MessageChannelSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DesktopMultiChannelSurface: Story = {
  render: () => <SurfaceStory compact={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await expect(await canvas.findByText(transcriptByChatId["room-jane"], {}, { timeout: 5_000 })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Send" })).toBeInTheDocument();
    await expect(canvas.getByTestId("message-channel-metadata-trigger")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: /Team room/i }));

    await expect(await canvas.findByText(transcriptByChatId["room-team"], {}, { timeout: 5_000 })).toBeInTheDocument();
    await waitFor(() => {
      expect(canvas.queryByText(transcriptByChatId["room-jane"])).not.toBeInTheDocument();
    });

    await userEvent.click(canvas.getByTestId("message-channel-metadata-trigger"));
    const dialog = await portal.findByRole("dialog");
    await expect(dialog).toHaveTextContent("room-team");
    await expect(dialog).toHaveTextContent("Room metadata");
  },
};

export const CompactMultiChannelSurface: Story = {
  render: () => <SurfaceStory compact={true} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText(transcriptByChatId["room-jane"], {}, { timeout: 5_000 })).toBeInTheDocument();
    await expect(canvas.getByTestId("message-channel-metadata-trigger")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "New room" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: /Team room/i }));

    await expect(await canvas.findByText(transcriptByChatId["room-team"], {}, { timeout: 5_000 })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "New room" })).toBeVisible();
  },
};

export const DeliveredMessageLinksToDevtools: Story = {
  args: {
    onOpenDevtools: fn(),
  },
  render: (args) => <SurfaceStory compact={false} onOpenDevtools={args.onOpenDevtools} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await expect(await canvas.findByText(transcriptByChatId["room-jane"], {}, { timeout: 5_000 })).toBeInTheDocument();

    await userEvent.click(canvas.getByLabelText("Message actions"));
    await userEvent.click(await portal.findByText("View In Devtools"));

    await waitFor(() => {
      expect(args.onOpenDevtools).toHaveBeenCalledWith(7);
    });
  },
};

export const EmptyChannelCollection: Story = {
  render: () => <SurfaceStory compact={false} items={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText("No rooms yet")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "New room" })).toBeInTheDocument();
  },
};

export const CreateChannelViaMetadataDialog: Story = {
  render: () => <SurfaceStory compact={false} onCreateChannel={createChannelViaMetadataDialogSpy} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    createChannelViaMetadataDialogSpy.mockClear();
    await expect(await canvas.findByRole("button", { name: "New room" }, { timeout: 5_000 })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "New room" }));
    const dialog = await portal.findByRole("dialog", { name: "Create room" });
    await userEvent.clear(within(dialog).getByLabelText("Title"));
    await userEvent.type(within(dialog).getByLabelText("Title"), "Coordination room");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create room" }));
    await waitFor(() => {
      expect(createChannelViaMetadataDialogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Coordination room",
        }),
      );
    });
  },
};

export const LoadingChannelCollection: Story = {
  render: () => <SurfaceStory compact={false} items={[]} channelsLoading />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText("Loading rooms...")).toBeInTheDocument();
  },
};

export const RefreshingChannelCollection: Story = {
  render: () => <SurfaceStory compact={false} channelsLoading />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText(transcriptByChatId["room-jane"], {}, { timeout: 5_000 })).toBeInTheDocument();
    await expect(canvas.getByText("Refreshing rooms...")).toBeInTheDocument();
  },
};

export const TransportErrorSurface: Story = {
  render: () => <SurfaceStory compact={false} socketMode="error" channelsError="Failed to refresh rooms." />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvasElement.textContent).toContain("Failed to refresh rooms.");
    });
    await expect(await canvas.findByText("chat transport failed")).toBeInTheDocument();
  },
};

export const TypedRowsRenderAndInteractiveSubmit: Story = {
  args: {
    onSendMessage: fn(async () => undefined),
  },
  render: (args) => (
    <SurfaceStory
      compact={false}
      socketMode="typed"
      onSendMessage={args.onSendMessage}
      onOpenDevtools={args.onOpenDevtools}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText("Lunch poll")).toBeInTheDocument();
    await expect(await canvas.findByText("Runtime error")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Reply" }));
    await waitFor(() => {
      expect(args.onSendMessage).toHaveBeenCalledTimes(1);
    });
  },
};
