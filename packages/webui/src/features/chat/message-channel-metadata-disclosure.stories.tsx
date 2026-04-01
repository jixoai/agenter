import type { MessageChannelEntry, MessageChannelGrantEntry } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { MessageChannelMetadataDisclosure } from "./message-channel-metadata-disclosure";

const createChannel = (input: { accessRole: "admin" | "member" | "readonly"; title?: string }): MessageChannelEntry => ({
  chatId: "room-lunch",
  kind: "room",
  title: input.title ?? "Lunch relay",
  owner: "jane",
  participants: [
    {
      id: "auth:wallet_evm:0x00000000000000000000000000000000000000aa",
      label: "Nova Ops",
    },
    { id: "session:observer", label: "Observer avatar" },
  ],
  metadata: { builtIn: false, topic: "lunch" },
  createdAt: 1,
  updatedAt: 1,
  focused: true,
  accessRole: input.accessRole,
  accessToken: `msgtok_${input.accessRole}`,
  transportUrl: `ws://localhost:7777/room/room-lunch?token=msgtok_${input.accessRole}`,
});

const grantsFixture: MessageChannelGrantEntry[] = [
  {
    grantId: "grant-viewer",
    chatId: "room-lunch",
    role: "readonly",
    label: "Viewer",
    participantId: "session:observer",
    createdAt: 2,
  },
];

const isGrantParticipantId = (
  value: string | undefined,
): value is NonNullable<MessageChannelGrantEntry["participantId"]> =>
  typeof value === "string" &&
  (value.startsWith("auth:") || value.startsWith("session:") || value.startsWith("system:"));

const actorOptions = [
  {
    actorId: "auth:wallet_evm:0x00000000000000000000000000000000000000aa",
    actorKind: "auth" as const,
    label: "Nova Ops",
    subtitle: "wallet_evm:0x00000000000000000000000000000000000000aa",
  },
  {
    actorId: "session:observer",
    actorKind: "session" as const,
    label: "Observer avatar",
    subtitle: "/repo/demo",
  },
];

const DisclosureStory = ({
  accessRole,
  onFocusChannel,
  onArchiveChannel,
  onDeleteChannel,
}: {
  accessRole: "admin" | "member" | "readonly";
  onFocusChannel?: () => Promise<void> | void;
  onArchiveChannel?: () => Promise<void> | void;
  onDeleteChannel?: () => Promise<void> | void;
}) => {
  const [channel, setChannel] = useState(() => createChannel({ accessRole }));
  const [, setGrantVersion] = useState(0);
  const grantsRef = useRef<MessageChannelGrantEntry[]>(grantsFixture);

  const replaceGrants = (next: MessageChannelGrantEntry[]) => {
    grantsRef.current = next;
    setGrantVersion((current) => current + 1);
  };

  return (
    <div className="flex min-h-[28rem] items-start justify-center bg-slate-100 p-6">
      <MessageChannelMetadataDisclosure
        channel={channel}
        onFocusChannel={
          accessRole === "admin" && onFocusChannel
            ? async () => {
                await onFocusChannel();
                setChannel((current) => ({ ...current, focused: true }));
              }
            : undefined
        }
        onArchiveChannel={
          accessRole === "admin" && onArchiveChannel
            ? async () => {
                await onArchiveChannel();
              }
            : undefined
        }
        onDeleteChannel={
          accessRole === "admin" && onDeleteChannel
            ? async () => {
                await onDeleteChannel();
              }
            : undefined
        }
        onUpdateChannel={
          accessRole === "admin"
            ? async ({ patch }) => {
                const updated = {
                  ...channel,
                  title: patch.title ?? channel.title,
                  participants: patch.participants ?? channel.participants,
                  metadata: patch.metadata ?? channel.metadata,
                  updatedAt: channel.updatedAt + 1,
                };
                setChannel(updated);
                return updated;
              }
            : undefined
        }
        onListChannelGrants={accessRole === "admin" ? async () => grantsRef.current : undefined}
        onIssueChannelGrant={
          accessRole === "admin"
            ? async (input) => {
                const nextGrant: MessageChannelGrantEntry = {
                  grantId: "grant-member",
                  chatId: channel.chatId,
                  role: input.role,
                  label: input.label,
                  participantId: isGrantParticipantId(input.participantId) ? input.participantId : undefined,
                  createdAt: 3,
                };
                replaceGrants([nextGrant, ...grantsRef.current]);
                return {
                  ...nextGrant,
                  accessRole: input.role,
                  accessToken: "msgtok_member",
                  transportUrl: `ws://localhost:7777/room/${channel.chatId}?token=msgtok_member`,
                };
              }
            : undefined
        }
        actorOptions={actorOptions}
        onRevokeChannelGrant={
          accessRole === "admin"
            ? async ({ grantId }) => {
                replaceGrants(grantsRef.current.filter((grant) => grant.grantId !== grantId));
                return { ok: true };
              }
            : undefined
        }
      />
    </div>
  );
};

const meta = {
  title: "Features/Chat/MessageChannelMetadataDisclosure",
  component: MessageChannelMetadataDisclosure,
  args: {
    channel: createChannel({ accessRole: "readonly" }),
  },
} satisfies Meta<typeof MessageChannelMetadataDisclosure>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReadonlyMetadata: Story = {
  render: () => <DisclosureStory accessRole="readonly" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await userEvent.click(canvas.getByTestId("message-channel-metadata-trigger"));
    const dialog = await portal.findByRole("dialog");

    await expect(dialog).toHaveTextContent("read-only");
    await expect(portal.queryByRole("button", { name: "Save channel" })).toBeNull();
    await expect(portal.queryByRole("button", { name: /Issue token/i })).toBeNull();
  },
};

export const AdminMetadataManagement: Story = {
  render: () => <DisclosureStory accessRole="admin" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await userEvent.click(canvas.getByTestId("message-channel-metadata-trigger"));
    const dialog = await portal.findByRole("dialog");

    const titleInput = await portal.findByDisplayValue("Lunch relay");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Lunch handoff");
    await expect(portal.queryByLabelText(/Participant role/i)).toBeNull();
    await userEvent.selectOptions(portal.getByLabelText("Participant actor 2"), "auth:wallet_evm:0x00000000000000000000000000000000000000aa");
    await userEvent.click(portal.getByRole("button", { name: "Save channel" }));
    await expect(dialog).toHaveTextContent("Lunch handoff");
    await expect(dialog).toHaveTextContent("Nova Ops");

    await userEvent.type(portal.getByLabelText("Grant label"), "Relay member");
    await userEvent.selectOptions(
      portal.getByLabelText("Grant participant"),
      "auth:wallet_evm:0x00000000000000000000000000000000000000aa",
    );
    await userEvent.click(portal.getByRole("button", { name: "Issue token" }));
    await expect(dialog).toHaveTextContent("Issued readonly token");
    await expect(dialog).toHaveTextContent("msgtok_member");

    await userEvent.click(portal.getAllByRole("button", { name: "Revoke" })[0]!);
    await expect(dialog).not.toHaveTextContent("Relay member");
  },
};

const adminLifecycleFocusSpy = fn(async () => undefined);
const adminLifecycleArchiveSpy = fn(async () => undefined);
const adminLifecycleDeleteSpy = fn(async () => undefined);

export const AdminLifecycleActions: Story = {
  render: () => (
    <DisclosureStory
      accessRole="admin"
      onFocusChannel={adminLifecycleFocusSpy}
      onArchiveChannel={adminLifecycleArchiveSpy}
      onDeleteChannel={adminLifecycleDeleteSpy}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    adminLifecycleFocusSpy.mockClear();
    adminLifecycleArchiveSpy.mockClear();
    adminLifecycleDeleteSpy.mockClear();
    await userEvent.click(canvas.getByTestId("message-channel-metadata-trigger"));
    await portal.findByRole("dialog");

    await userEvent.click(portal.getByRole("button", { name: /focus channel/i }));
    await userEvent.click(portal.getByRole("button", { name: "Archive channel" }));
    await userEvent.click(portal.getByRole("button", { name: "Dissolve room" }));

    await waitFor(() => {
      expect(adminLifecycleFocusSpy).toHaveBeenCalledTimes(1);
      expect(adminLifecycleArchiveSpy).toHaveBeenCalledTimes(1);
      expect(adminLifecycleDeleteSpy).toHaveBeenCalledTimes(1);
    });
  },
};
