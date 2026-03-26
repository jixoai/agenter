import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { ChatPanel } from "../chat/ChatPanel";
import { createRealSessionHistoryFixture } from "../chat/real-session-history-fixture";
import { SessionStatusPillMenu } from "./SessionStatusPillMenu";
import { ShellLayoutProvider } from "./shell-layout-context";
import { WorkspaceShellFrame } from "./WorkspaceShellFrame";

const fixture = createRealSessionHistoryFixture({ turns: 10, unreadCount: 2 });

type ChatRouteAssemblyStoryArgs = {
  workspacePath: string;
  activeTab: "chat" | "terminals" | "devtools" | "settings";
};

const buildRouteStory =
  (input: { widthClassName: string; heightClassName: string; compact: boolean }) =>
  (args: ChatRouteAssemblyStoryArgs) => (
    <ShellLayoutProvider
      value={{
        showNavigationTrigger: input.compact,
        connectionStatus: "connected",
        aiStatus: input.compact ? "ready" : "working",
        onOpenNavigation: () => undefined,
      }}
    >
      <div
        className={`bg-slate-100 ${input.heightClassName} ${input.widthClassName}`}
        data-testid="chat-route-assembly-root"
      >
        <WorkspaceShellFrame
          workspacePath={args.workspacePath}
          activeTab={args.activeTab}
          onNavigate={() => undefined}
          headerStatusSlot={
            <SessionStatusPillMenu
              triggerVariant="icon"
              statusLabel="Session running"
              tone="active"
              primaryActionLabel="Stop session"
              onPrimaryAction={() => undefined}
              onAbort={() => undefined}
            />
          }
        >
          <ChatPanel
            workspacePath={args.workspacePath}
            messages={fixture.messages}
            cycles={[]}
            aiStatus="idle"
            sessionStateLabel="Session running"
            disabled={false}
            imageEnabled
            imageCompatible
            onSubmit={async () => undefined}
          />
        </WorkspaceShellFrame>
      </div>
    </ShellLayoutProvider>
  );

const meta: Meta<ChatRouteAssemblyStoryArgs> = {
  title: "Features/Shell/ChatRouteAssembly",
  args: {
    workspacePath: "/repo/demo/project-alpha",
    activeTab: "chat",
  },
};

export default meta;

type Story = StoryObj<ChatRouteAssemblyStoryArgs>;

export const DesktopRouteKeepsPassiveHeaderAndRouteLocalStatus: Story = {
  render: buildRouteStory({
    widthClassName: "w-[1180px]",
    heightClassName: "h-[860px]",
    compact: false,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByTestId("top-header");
    const root = canvas.getByTestId("chat-route-assembly-root");
    const attachButton = canvas.getByRole("button", { name: "Attach" });
    const actionBar = canvas.getByTestId("composer-action-bar");
    const statusBar = canvas.getByTestId("composer-status-bar");

    await expect(within(header).getByRole("button", { name: "Session status: Session running" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("button", { name: "Session status: Session running" })).toHaveLength(1);
    await expect(canvas.getByTestId("workspace-basename-chip")).toHaveTextContent("project-alpha");
    await expect(canvas.getByTestId("workspace-basename-chip")).toHaveAttribute("title", "/repo/demo/project-alpha");
    await expect(within(attachButton).getByText("Attach")).toBeInTheDocument();

    await waitFor(() => {
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      expect(actionBar.getBoundingClientRect().height).toBeGreaterThan(statusBar.getBoundingClientRect().height);
    });
  },
};

export const CompactRouteCollapsesSecondaryChromeFirst: Story = {
  render: buildRouteStory({
    widthClassName: "w-[375px]",
    heightClassName: "h-[667px]",
    compact: true,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByTestId("top-header");
    const root = canvas.getByTestId("chat-route-assembly-root");
    const attachButton = canvas.getByRole("button", { name: "Attach" });
    const screenshotButton = canvas.getByRole("button", { name: "Screenshot" });
    const sendButton = canvas.getByRole("button", { name: "Send" });
    const actionBar = canvas.getByTestId("composer-action-bar");
    const statusBar = canvas.getByTestId("composer-status-bar");

    await waitFor(() => {
      const attachRect = attachButton.getBoundingClientRect();
      const screenshotRect = screenshotButton.getBoundingClientRect();
      const sendRect = sendButton.getBoundingClientRect();
      expect(within(header).getByRole("button", { name: "Session status: Session running" })).toBeInTheDocument();
      expect(canvas.queryByTestId("chat-route-status-strip")).not.toBeInTheDocument();
      expect(canvas.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
      expect(within(header).queryByTestId("workspace-basename-chip")).not.toBeInTheDocument();
      expect(canvas.queryByLabelText("Workspace /repo/demo/project-alpha")).not.toBeInTheDocument();
      expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Attachments ready");
      expect(Math.abs(attachRect.top - screenshotRect.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(sendRect.top - screenshotRect.top)).toBeLessThanOrEqual(2);
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      expect(actionBar.getBoundingClientRect().height).toBeGreaterThan(statusBar.getBoundingClientRect().height);
    });

    await expect(within(attachButton).getByText("Attach")).toBeInTheDocument();
  },
};
