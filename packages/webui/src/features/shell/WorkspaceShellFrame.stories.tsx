import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { ShellLayoutProvider } from "./shell-layout-context";
import { WorkspaceShellFrame } from "./WorkspaceShellFrame";

const renderFrame = (narrow = false) => {
  return (args: {
    workspacePath: string;
    workspaceMissing?: boolean;
    activeTab: "chat" | "terminals" | "devtools" | "settings";
    onNavigate: (tab: "chat" | "terminals" | "devtools" | "settings") => void;
    children: ReactNode;
  }) => {
    const [activeTab, setActiveTab] = useState<"chat" | "terminals" | "devtools" | "settings">(args.activeTab);

    return (
      <ShellLayoutProvider
        value={{
          showNavigationTrigger: narrow,
          connectionStatus: "connected",
          aiStatus: narrow ? "ready" : "working",
          onOpenNavigation: fn(),
        }}
      >
        <div
          className={narrow ? "w-[320px] bg-slate-100" : "h-[860px] p-6"}
          data-testid={narrow ? "compact-workspace-shell" : undefined}
        >
          <WorkspaceShellFrame
            {...args}
            activeTab={activeTab}
            onNavigate={(tab) => {
              setActiveTab(tab);
              args.onNavigate(tab);
            }}
          />
        </div>
      </ShellLayoutProvider>
    );
  };
};

const meta = {
  title: "Features/Shell/WorkspaceShellFrame",
  component: WorkspaceShellFrame,
  args: {
    workspacePath: "/repo/demo/project-alpha",
    activeTab: "chat",
    onNavigate: fn(),
    children: (
      <section className="flex h-full items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">Workspace body</p>
      </section>
    ),
  },
} satisfies Meta<typeof WorkspaceShellFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SwitchTabsWithinUnifiedTopHeader: Story = {
  render: renderFrame(false),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("project-alpha")).toBeInTheDocument();
    await expect(canvas.queryByText("/repo/demo/project-alpha")).not.toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Chats" })).toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Terminals" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: "Terminals" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Devtools" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Settings" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Chats" }));

    await expect(args.onNavigate).toHaveBeenNthCalledWith(1, "terminals");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(2, "devtools");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(3, "settings");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(4, "chat");
  },
};

export const CompactShellStillKeepsTopTabs: Story = {
  render: renderFrame(true),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const shell = canvas.getByTestId("compact-workspace-shell");

    await expect(canvas.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
    await expect(canvas.queryByTestId("workspace-basename-chip")).not.toBeInTheDocument();
    await expect(canvas.getByLabelText("Workspace /repo/demo/project-alpha")).toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Chats" })).toBeInTheDocument();
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth + 1);

    await userEvent.click(canvas.getByRole("tab", { name: "Terminals" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Devtools" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Settings" }));

    await expect(args.onNavigate).toHaveBeenNthCalledWith(1, "terminals");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(2, "devtools");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(3, "settings");
  },
};
