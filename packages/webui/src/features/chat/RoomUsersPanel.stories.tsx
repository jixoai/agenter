import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { RoomUsersPanel } from "./RoomUsersPanel";

const meta = {
  title: "Features/Chat/RoomUsersPanel",
  component: RoomUsersPanel,
  decorators: [
    (Story) => (
      <div className="h-[36rem] w-[24rem] bg-slate-100 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomUsersPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MixedSeatStates: Story = {
  args: {
    roomId: "room-ops",
    loading: false,
    users: [
      {
        actorId: "auth:owner",
        actorKind: "auth",
        label: "Owner",
        subtitle: "wallet_evm:0xowner",
        roleLabel: "admin",
        accessToken: "msgtok_owner",
        currentCaller: true,
        currentAdmin: true,
        online: true,
        focused: true,
        invalidCredential: false,
        readStatus: "read",
        readAt: 12_000,
      },
      {
        actorId: "session:relay",
        actorKind: "session",
        label: "Relay",
        subtitle: "/repo/demo",
        accessToken: "msgtok_member",
        roleLabel: "member",
        currentCaller: false,
        currentAdmin: false,
        online: true,
        focused: true,
        invalidCredential: false,
        readStatus: "read",
        readAt: 12_100,
      },
      {
        actorId: "auth:viewer",
        actorKind: "auth",
        label: "Viewer",
        subtitle: "wallet_evm:0xviewer",
        roleLabel: "readonly",
        currentCaller: false,
        currentAdmin: false,
        online: false,
        focused: false,
        invalidCredential: true,
        readStatus: "unread",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("3 seats")).toBeInTheDocument();
    await expect(canvas.getByText("Owner")).toBeInTheDocument();
    await expect(canvas.getByText("Relay")).toBeInTheDocument();
    await expect(canvas.getByText("Viewer")).toBeInTheDocument();
    await expect(canvas.getByText("current admin")).toBeInTheDocument();
    await expect(canvas.getByText("caller")).toBeInTheDocument();
    await expect(canvas.getByText("credential invalid")).toBeInTheDocument();
    await expect(canvas.getAllByText("read").length).toBeGreaterThan(0);
    await expect(canvas.getByText("unread")).toBeInTheDocument();
  },
};

export const EmptySeatList: Story = {
  args: {
    roomId: "room-empty",
    loading: false,
    users: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No user seats are visible for this room yet.")).toBeInTheDocument();
  },
};
