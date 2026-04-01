import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ChatAttachmentStrip } from "./ChatAttachmentStrip";

const attachments = [
  {
    assetId: "persisted-image",
    kind: "image" as const,
    mimeType: "image/png",
    name: "diagram.png",
    sizeBytes: 2048,
    url: "https://placehold.co/160x160/png",
  },
  {
    assetId: "persisted-file",
    kind: "file" as const,
    mimeType: "text/markdown",
    name: "summary.md",
    sizeBytes: 1024,
    url: "https://example.com/summary.md",
  },
];

const meta = {
  title: "Features/Chat/ChatAttachmentStrip",
  component: ChatAttachmentStrip,
  args: {
    attachments,
    onPreview: fn(),
  },
  render: (args) => (
    <div className="w-[min(720px,100vw)] rounded-[1.4rem] bg-slate-50 p-6">
      <ChatAttachmentStrip {...args} />
    </div>
  ),
} satisfies Meta<typeof ChatAttachmentStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PersistedAttachmentsRemainOperable: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("diagram.png")).toBeInTheDocument();
    await expect(canvas.getByText("summary.md")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: /diagram\.png/i }));
    await waitFor(() => {
      expect(args.onPreview).toHaveBeenCalledWith("persisted-image");
    });
  },
};
