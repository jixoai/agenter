import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";

import { ChatMessageRow } from "./ChatConversationRows";

const assistantAvatarSvgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="20" fill="#0f766e"/></svg>',
)}`;

const meta = {
  title: "Features/Chat/ChatMessageRow",
  component: ChatMessageRow,
  args: {
    message: {
      id: "assistant-message-1",
      role: "assistant" as const,
      cycleId: 12,
      channel: "to_user" as const,
      content: "Please inspect the latest build output and attached diagram.",
      timestamp: 12,
      attachments: [
        {
          assetId: "assistant-image",
          kind: "image" as const,
          mimeType: "image/png",
          name: "build-diagram.png",
          sizeBytes: 4096,
          url: "https://placehold.co/160x160/png",
        },
      ],
    },
    assistantAvatarUrl: assistantAvatarSvgUrl,
    assistantAvatarLabel: "Agenter",
    userAvatarLabel: "You",
    onPreviewAttachment: fn(),
    onOpenDevtools: fn(),
  },
  render: (args) => (
    <div className="w-[min(720px,100vw)] rounded-[1.6rem] bg-slate-50 p-6">
      <ChatMessageRow {...args} />
    </div>
  ),
} satisfies Meta<typeof ChatMessageRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AssistantBubbleActionsRemainReachable: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);
    const bubble = canvas
      .getByText("Please inspect the latest build output and attached diagram.")
      .closest("[data-chat-bubble='true']");

    if (!(bubble instanceof HTMLElement)) {
      throw new Error("Chat bubble not found");
    }

    await expect(canvas.getByRole("img", { name: "Agenter" })).toBeInTheDocument();

    fireEvent.contextMenu(bubble);
    await userEvent.click(await portal.findByText("View In Devtools"));
    await waitFor(() => {
      expect(args.onOpenDevtools).toHaveBeenCalledWith(12);
    });
  },
};
