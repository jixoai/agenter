import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { AIInputPendingAssets } from "./AIInputPendingAssets";

const pendingAssets = [
  {
    id: "asset-image",
    kind: "image" as const,
    file: new File([new Uint8Array([1, 2, 3, 4])], "wireframe.png", { type: "image/png" }),
    previewUrl: "https://placehold.co/96x96/png",
  },
  {
    id: "asset-video",
    kind: "video" as const,
    file: new File([new Uint8Array([5, 6, 7, 8])], "walkthrough.mp4", { type: "video/mp4" }),
    previewUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: "asset-file",
    kind: "file" as const,
    file: new File([new Uint8Array([9, 10, 11])], "brief.md", { type: "text/markdown" }),
    previewUrl: "blob://brief-md",
  },
];

const meta = {
  title: "Features/Chat/AIInputPendingAssets",
  component: AIInputPendingAssets,
  args: {
    pendingAssets,
    onPreviewAsset: fn(),
    onRemoveAsset: fn(),
  },
  render: (args) => (
    <div className="w-[min(720px,100vw)] rounded-[1.4rem] bg-white shadow-sm ring-1 ring-slate-200">
      <AIInputPendingAssets {...args} />
    </div>
  ),
} satisfies Meta<typeof AIInputPendingAssets>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingAssetsRemainOperable: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Pending attachments")).toBeInTheDocument();
    await expect(canvas.getByText("3 queued")).toBeInTheDocument();

    await userEvent.click(canvas.getByAltText("wireframe.png"));
    await waitFor(() => {
      expect(args.onPreviewAsset).toHaveBeenCalledWith("asset-image");
    });

    await userEvent.click(canvas.getByRole("button", { name: "Remove brief.md" }));
    await waitFor(() => {
      expect(args.onRemoveAsset).toHaveBeenCalledWith("asset-file");
    });
  },
};
