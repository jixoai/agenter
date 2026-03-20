import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import { useState } from "react";

import { SettingsPanel } from "./SettingsPanel";

const layers = [
  {
    layerId: "0:user",
    sourceId: "user",
    path: "~/.agenter/settings.json",
    exists: true,
    editable: true,
  },
  {
    layerId: "1:project",
    sourceId: "project",
    path: "/repo/demo/.agenter/settings.json",
    exists: true,
    editable: true,
  },
];

const longLayers = Array.from({ length: 40 }, (_, index) => ({
  layerId: `${index}:project`,
  sourceId: index % 2 === 0 ? "project" : "user",
  path: `/repo/demo/.agenter/settings-${index + 1}.json`,
  exists: true,
  editable: true,
}));

const meta = {
  title: "Features/Settings/SettingsPanel",
  component: SettingsPanel,
  args: {
    disabled: false,
    loading: false,
    status: "layers refreshed",
    detailMode: "split",
    effectiveContent: '{\n  "lang": "en"\n}\n',
    layers,
    selectedLayerId: "1:project",
    layerContent: '{\n  "lang": "en"\n}\n',
    onSelectLayer: fn(),
    onLayerContentChange: fn(),
    onRefreshLayers: fn(),
    onLoadLayer: fn(),
    onSaveLayer: fn(),
  },
  render: (args) => {
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(args.selectedLayerId);
    const [layerContent, setLayerContent] = useState(args.layerContent);

    return (
      <div className="h-[860px] p-6">
        <SettingsPanel
          {...args}
          selectedLayerId={selectedLayerId}
          layerContent={layerContent}
          onSelectLayer={(layerId) => {
            setSelectedLayerId(layerId);
            args.onSelectLayer(layerId);
          }}
          onLayerContentChange={(content) => {
            setLayerContent(content);
            args.onLayerContentChange(content);
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof SettingsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EditWorkspaceLayer: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: "Layer Sources" }));
    await userEvent.click(canvas.getByRole("button", { name: /project/i }));
    await userEvent.click(canvas.getByRole("button", { name: "Load" }));
    const textarea = canvas.getByPlaceholderText("Select a layer and load content");
    fireEvent.change(textarea, { target: { value: '{\n  "lang": "ja"\n}' } });
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));

    await expect(args.onSelectLayer).toHaveBeenCalledWith("1:project");
    await expect(args.onLoadLayer).toHaveBeenCalledTimes(1);
    await expect(args.onLayerContentChange).toHaveBeenCalled();
    await expect(args.onSaveLayer).toHaveBeenCalledTimes(1);
  },
};

export const LayerSourcesKeepExplicitScrollViewport: Story = {
  args: {
    layers: longLayers,
    selectedLayerId: longLayers[0]?.layerId ?? null,
    layerContent: '{\n  "lang": "en"\n}\n',
  },
  render: (args) => {
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(args.selectedLayerId);
    const [layerContent, setLayerContent] = useState(args.layerContent);

    return (
      <div className="h-[520px] p-4">
        <SettingsPanel
          {...args}
          selectedLayerId={selectedLayerId}
          layerContent={layerContent}
          onSelectLayer={(layerId) => {
            setSelectedLayerId(layerId);
            args.onSelectLayer(layerId);
          }}
          onLayerContentChange={(content) => {
            setLayerContent(content);
            args.onLayerContentChange(content);
          }}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: "Layer Sources" }));
    const viewport = canvas.getByTestId("settings-sources-scroll-viewport");
    await expect(["auto", "scroll"]).toContain(getComputedStyle(viewport).overflowY);
  },
};

export const CompactLayerEditorSheet: Story = {
  args: {
    detailMode: "sheet",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: "Layer Sources" }));

    const dialog = within(document.body).getByRole("dialog");
    await expect(dialog).toBeInTheDocument();
    await expect(within(dialog).getByRole("heading", { name: "Layer editor" })).toBeInTheDocument();
  },
};
