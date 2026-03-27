import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";

import { SettingsPanel } from "./SettingsPanel";
import type { SettingsEffectiveGraph } from "./settings-graph-types";

const effectiveValue = {
  lang: "en",
  ai: {
    activeProvider: "default",
  },
  terminal: {
    outputRoot: "/repo/demo/tmp",
  },
};

const effective: SettingsEffectiveGraph = {
  content: `${JSON.stringify(effectiveValue, null, 2)}\n`,
  value: effectiveValue,
  schema: {
    type: "object",
    properties: {
      lang: { type: "string" },
      ai: {
        type: "object",
        properties: {
          activeProvider: { type: "string" },
        },
      },
      terminal: {
        type: "object",
        properties: {
          outputRoot: { type: "string" },
        },
      },
    },
  },
  provenance: {
    "/lang": {
      pointer: "/lang",
      origins: [
        {
          layerId: "1:project",
          sourceId: "project",
          kind: "file",
          path: "/repo/demo/.agenter/settings.json",
          pointer: "/lang",
          value: "en",
        },
      ],
      jumpTarget: {
        layerId: "1:project",
        pointer: "/lang",
      },
    },
    "/ai/activeProvider": {
      pointer: "/ai/activeProvider",
      origins: [
        {
          layerId: "2:local",
          sourceId: "local",
          kind: "file",
          path: "/repo/demo/.agenter/settings.local.json",
          pointer: "/ai/activeProvider",
          value: "default",
        },
      ],
      jumpTarget: {
        layerId: "2:local",
        pointer: "/ai/activeProvider",
      },
    },
  },
};

const layers = [
  {
    layerId: "0:user",
    sourceId: "user",
    kind: "file" as const,
    path: "~/.agenter/settings.json",
    exists: true,
    editable: true,
  },
  {
    layerId: "1:project",
    sourceId: "project",
    kind: "file" as const,
    path: "/repo/demo/.agenter/settings.json",
    exists: true,
    editable: true,
  },
  {
    layerId: "2:local",
    sourceId: "local",
    kind: "file" as const,
    path: "/repo/demo/.agenter/settings.local.json",
    exists: true,
    editable: true,
  },
];

const layerContentById: Record<string, string> = {
  "0:user": '{\n  "lang": "en"\n}\n',
  "1:project": '{\n  "lang": "en",\n  "ai": {\n    "activeProvider": "default"\n  }\n}\n',
  "2:local": '{\n  "ai": {\n    "activeProvider": "default"\n  },\n  "terminal": {\n    "outputRoot": "./tmp"\n  }\n}\n',
};

const longLayers = Array.from({ length: 40 }, (_, index) => ({
  layerId: `${index}:project`,
  sourceId: index % 2 === 0 ? "project" : "user",
  kind: "file" as const,
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
    effective,
    layers,
    selectedLayerId: "1:project",
    layerContent: layerContentById["1:project"],
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
          onLoadLayer={(layerId) => {
            setLayerContent(layerContentById[layerId] ?? "{}\n");
            args.onLoadLayer(layerId);
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

export const JumpFromEffectiveToLayerView: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: "View" }));
    await userEvent.click(canvas.getByRole("button", { name: /settings\.json/i }));

    await expect(args.onSelectLayer).toHaveBeenCalledWith("1:project");
    await expect(args.onLoadLayer).toHaveBeenCalledWith("1:project");
    await expect(canvas.getByText("Layer Detail")).toBeInTheDocument();
  },
};

export const LayerSourcesKeepExplicitScrollViewport: Story = {
  args: {
    layers: longLayers,
    selectedLayerId: longLayers[0]?.layerId ?? null,
    layerContent: '{\n  "lang": "en"\n}\n',
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
    await expect(within(dialog).getByRole("heading", { name: "Layer Detail" })).toBeInTheDocument();
  },
};
