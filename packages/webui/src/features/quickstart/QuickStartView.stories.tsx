import type { WorkspaceSessionEntry } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { dispatchClipboardImage, focusEditorSurface } from "../chat/ai-input-story-utils";
import { QuickStartView } from "./QuickStartView";

const recentSession = {
  sessionId: "session-recent-001",
  name: "Contract review",
  status: "running",
  storageState: "active",
  favorite: false,
  createdAt: "2026-03-06T10:00:00.000Z",
  updatedAt: "2026-03-06T10:01:00.000Z",
  preview: {
    firstUserMessage: "Audit the chat workflow",
    latestMessages: ["Collected runtime state", "Need a UI fix"],
  },
} satisfies WorkspaceSessionEntry;

const buildRecentSession = (index: number): WorkspaceSessionEntry => ({
  ...recentSession,
  sessionId: `session-recent-${String(index + 1).padStart(3, "0")}`,
  name: `Contract review ${index + 1}`,
  createdAt: `2026-03-06T10:${String(index).padStart(2, "0")}:00.000Z`,
  updatedAt: `2026-03-06T10:${String(index + 1).padStart(2, "0")}:30.000Z`,
  preview: {
    firstUserMessage: `Audit workspace flow ${index + 1}`,
    latestMessages: [`Collected runtime state ${index + 1}`, `Need a UI fix ${index + 1}`],
  },
});

const searchPaths = fn(async ({ query }: { cwd: string; query: string; limit?: number }) => {
  if (query === "@") {
    return [
      {
        label: "src/",
        path: "src/",
        isDirectory: true,
      },
      {
        label: "README.md",
        path: "README.md",
        isDirectory: false,
      },
    ];
  }
  if (query === "@src/") {
    return [
      {
        label: "src/index.ts",
        path: "src/index.ts",
        isDirectory: false,
      },
    ];
  }
  return [];
});

const meta = {
  title: "Features/QuickStart/QuickStartView",
  component: QuickStartView,
  args: {
    workspacePath: "/repo/demo",
    draftResolution: {
      cwd: "/repo/demo",
      provider: {
        providerId: "openai",
        apiStandard: "openai-responses",
        vendor: "openai",
        model: "gpt-4.1-mini",
      },
      modelCapabilities: {
        streaming: true,
        tools: true,
        imageInput: true,
        nativeCompact: true,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      },
    },
    recentSessions: [recentSession],
    loadingDraft: false,
    starting: false,
    onOpenWorkspacePicker: fn(),
    onEnterWorkspace: fn(),
    onSubmit: fn(async () => undefined),
    onSearchPaths: searchPaths,
    onResumeSession: fn(),
  },
  render: (args) => (
    <div className="h-[860px] p-6">
      <QuickStartView {...args} />
    </div>
  ),
} satisfies Meta<typeof QuickStartView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StartAndResumeFlow: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);

    await expect(canvas.getByText("Quick Start")).toBeInTheDocument();
    await expect(canvas.getByText("openai · openai-responses · gpt-4.1-mini")).toBeInTheDocument();
    await expect(canvas.getByText("Images on")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Change" }));
    await expect(args.onOpenWorkspacePicker).toHaveBeenCalledTimes(1);

    await userEvent.click(canvas.getByRole("button", { name: "Enter" }));
    await expect(args.onEnterWorkspace).toHaveBeenCalledTimes(1);

    const editor = await focusEditorSurface(canvasElement, async (target) => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("Audit @");

    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({ cwd: "/repo/demo", query: "@", limit: 8 });
    });
    await userEvent.click(await portal.findByText("src/"));
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({ cwd: "/repo/demo", query: "@src/", limit: 8 });
    });
    await userEvent.click(await portal.findByText("src/index.ts"));

    const image = new File([new Uint8Array([1, 2, 3, 4])], "quickstart-brief.png", { type: "image/png" });
    dispatchClipboardImage(editor, image);
    await expect(await canvas.findByAltText("quickstart-brief.png")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenCalledWith({
        text: "Audit @src/index.ts",
        assets: [image],
      });
    });

    await userEvent.click(canvas.getByRole("button", { name: "Resume Contract review · session-recent-001" }));
    await expect(args.onResumeSession).toHaveBeenCalledWith("session-recent-001");
  },
};

export const ScrollViewportOwnsLongContent: Story = {
  args: {
    recentSessions: Array.from({ length: 12 }, (_, index) => buildRecentSession(index)),
  },
  render: (args) => (
    <div className="h-[520px] p-6">
      <QuickStartView {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = await canvas.findByTestId("quickstart-scroll-viewport");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 240;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(viewport.scrollTop).toBeGreaterThan(0);
    });
  },
};

export const CompactViewportKeepsPrimaryEntryPath: Story = {
  args: {
    recentSessions: Array.from({ length: 5 }, (_, index) => buildRecentSession(index)),
  },
  render: (args) => (
    <div className="h-[780px] max-w-[390px] p-4">
      <QuickStartView {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = await canvas.findByTestId("quickstart-scroll-viewport");

    await expect(canvas.getByRole("button", { name: "Change" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Enter" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Start" })).toBeInTheDocument();
    await expect(canvas.getByText("Recent Sessions")).toBeInTheDocument();
    await expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
  },
};
