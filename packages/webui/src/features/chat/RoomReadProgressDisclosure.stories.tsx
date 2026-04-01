import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { RoomReadProgressDisclosure } from "./RoomReadProgressDisclosure";

const meta = {
  title: "Features/Chat/RoomReadProgressDisclosure",
  component: RoomReadProgressDisclosure,
  decorators: [
    (Story) => (
      <div className="flex min-h-[16rem] items-start justify-center bg-slate-100 p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    readProgress: {
      latestVisibleMessageId: "msg-12",
      latestVisibleMessageRowId: 12,
      latestVisibleAt: 12_000,
      totalSeatCount: 3,
      readSeatCount: 2,
      unreadSeatCount: 1,
      invalidCredentialSeatCount: 1,
    },
    readStates: [
      {
        actorId: "auth:owner",
        role: "admin",
        label: "Owner",
        currentAdmin: true,
        online: true,
        focused: true,
        invalidCredential: false,
        readMessageId: "msg-12",
        readMessageRowId: 12,
        readAt: 12_000,
        hasReadLatestVisible: true,
      },
      {
        actorId: "session:relay",
        role: "member",
        label: "Relay",
        currentAdmin: false,
        online: true,
        focused: true,
        invalidCredential: false,
        readMessageId: "msg-12",
        readMessageRowId: 12,
        readAt: 12_100,
        hasReadLatestVisible: true,
      },
      {
        actorId: "auth:viewer",
        role: "readonly",
        label: "Viewer",
        currentAdmin: false,
        online: false,
        focused: false,
        invalidCredential: true,
        hasReadLatestVisible: false,
      },
    ],
  },
} satisfies Meta<typeof RoomReadProgressDisclosure>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PartialProgressOpensRosterDisclosure: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Room read progress" }));

    const dialog = await portal.findByRole("dialog", { name: "Read progress" });
    await expect(dialog).toHaveTextContent("3 seats");
    await expect(dialog).toHaveTextContent("2 read");
    await expect(dialog).toHaveTextContent("1 unread");
    await expect(dialog).toHaveTextContent("Owner");
    await expect(dialog).toHaveTextContent("Relay");
    await expect(dialog).toHaveTextContent("Viewer");
    await expect(dialog).toHaveTextContent("credential invalid");
  },
};
