import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState, type ReactNode } from "react";

import { WorkspaceShellFrame } from "./WorkspaceShellFrame";

const renderFrame = (narrow = false) => {
  return (args: {
    workspacePath: string;
    workspaceMissing?: boolean;
    activeTab: "chat" | "devtools" | "settings";
    onNavigate: (tab: "chat" | "devtools" | "settings") => void;
    children: ReactNode;
  }) => {
    const [activeTab, setActiveTab] = useState<"chat" | "devtools" | "settings">(args.activeTab);

    return (
      <div className={narrow ? "max-w-[430px] p-4" : "h-[860px] p-6"}>
        <WorkspaceShellFrame
          {...args}
          activeTab={activeTab}
          onNavigate={(tab) => {
            setActiveTab(tab);
            args.onNavigate(tab);
          }}
        />
      </div>
    );
  };
};

const meta = {
  title: "Features/Shell/WorkspaceShellFrame",
  component: WorkspaceShellFrame,
  args: {
    workspacePath: "/repo/demo",
    activeTab: "chat",
    onNavigate: fn(),
    children: (
      <section className="flex h-full items-center justify-center rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Workspace body</p>
      </section>
    ),
  },
} satisfies Meta<typeof WorkspaceShellFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SwitchTabsWithinWorkspaceShell: Story = {
  args: {},
  render: renderFrame(false),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const activate = async (label: "Chat" | "Devtools" | "Settings") => {
      const desktopTab = canvas.queryByRole("tab", { name: label });
      if (desktopTab) {
        await userEvent.click(desktopTab);
        return;
      }

      await userEvent.click(canvas.getByRole("button", { name: label }));
    };

    await expect(canvas.getByText("/repo/demo")).toBeInTheDocument();
    await expect(canvas.queryByText(/unread/i)).not.toBeInTheDocument();

    await activate("Devtools");
    await activate("Settings");
    await activate("Chat");

    await expect(args.onNavigate).toHaveBeenNthCalledWith(1, "devtools");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(2, "settings");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(3, "chat");
  },
};

export const MobileFooterNavigationOwnsRouteSwitching: Story = {
  args: {},
  render: renderFrame(true),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("/repo/demo")).toBeInTheDocument();
    await expect(canvas.queryByRole("tab", { name: "Chat" })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Devtools" }));
    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));
    await userEvent.click(canvas.getByRole("button", { name: "Chat" }));

    await expect(args.onNavigate).toHaveBeenNthCalledWith(1, "devtools");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(2, "settings");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(3, "chat");
  },
};
