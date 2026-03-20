import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageSquare, Settings2, Wrench } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { BottomNavBar } from "./BottomNavBar";

const meta = {
  title: "Features/Shell/BottomNavBar",
  component: BottomNavBar,
  args: {
    items: [
      { key: "chat", label: "Chat", icon: MessageSquare, active: true, onClick: fn() },
      { key: "devtools", label: "Devtools", icon: Wrench, onClick: fn() },
      { key: "settings", label: "Settings", icon: Settings2, onClick: fn() },
    ],
  },
  render: (args) => (
    <div className="max-w-[430px] rounded-2xl border border-slate-200 bg-white p-4">
      <BottomNavBar {...args} />
    </div>
  ),
} satisfies Meta<typeof BottomNavBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FooterOwnsWorkspaceRouteSwitching: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Devtools" }));
    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));

    await expect(args.items[1]?.onClick).toHaveBeenCalledTimes(1);
    await expect(args.items[2]?.onClick).toHaveBeenCalledTimes(1);
  },
};
