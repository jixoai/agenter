import type { AvatarCatalogItem } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";

import { GlobalSettingsPanel } from "./GlobalSettingsPanel";
import type { SettingsEffectiveGraph, SettingsLayerItem } from "./settings-graph-types";

const avatarSvgUrl = (fill: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="32" fill="${fill}"/></svg>`,
  )}`;

const baseAvatars: AvatarCatalogItem[] = [
  {
    nickname: "jon",
    active: true,
    iconUrl: avatarSvgUrl("#0f766e"),
  },
  {
    nickname: "nova",
    active: false,
    iconUrl: avatarSvgUrl("#ea580c"),
  },
];

const globalEffectiveValue = {
  avatar: "jon",
  lang: "en",
  notes: "",
};

const globalEffective: SettingsEffectiveGraph = {
  content: `${JSON.stringify(globalEffectiveValue, null, 2)}\n`,
  value: globalEffectiveValue,
  schema: {
    type: "object",
    properties: {
      avatar: {
        type: "string",
        description: "Nickname of the active avatar.",
      },
      lang: {
        type: "string",
        description: "Preferred locale for global defaults.",
      },
      notes: {
        type: "string",
        description: "Optional global note for operators.",
      },
    },
  },
  provenance: {
    "/avatar": {
      pointer: "/avatar",
      origins: [
        {
          layerId: "global:user",
          sourceId: "user",
          kind: "file",
          path: "~/.agenter/settings.json",
          pointer: "/avatar",
          value: "jon",
        },
      ],
      jumpTarget: {
        layerId: "global:user",
        pointer: "/avatar",
      },
    },
  },
};

const settingsLayers: SettingsLayerItem[] = [
  {
    layerId: "global:user",
    sourceId: "user",
    kind: "file",
    path: "~/.agenter/settings.json",
    exists: true,
    editable: true,
  },
  {
    layerId: "global:avatar",
    sourceId: "avatar:user",
    kind: "avatar",
    path: "~/.agenter/avatar/jon/settings.json",
    exists: true,
    editable: true,
  },
];

const layerContentById: Record<string, string> = {
  "global:user": '{\n  "avatar": "jon",\n  "lang": "en",\n  "notes": ""\n}\n',
  "global:avatar": '{\n  "lang": "en"\n}\n',
};

const meta = {
  title: "Features/Settings/GlobalSettingsPanel",
  component: GlobalSettingsPanel,
  args: {
    loading: false,
    saving: false,
    status: "Loaded 2 avatars",
    effective: globalEffective,
    layers: settingsLayers,
    selectedLayerId: "global:user",
    layerContent: layerContentById["global:user"],
    avatars: baseAvatars,
    activeAvatar: "jon",
    onSelectLayer: fn(),
    onLayerContentChange: fn(),
    onRefreshLayers: fn(),
    onLoadLayer: fn(),
    onSaveLayer: fn(),
    onCreateAvatar: fn(async () => undefined),
    onUploadAvatarIcon: fn(async () => undefined),
  },
  render: (args) => {
    const [layerContent, setLayerContent] = useState(args.layerContent);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(args.selectedLayerId);
    const [avatars, setAvatars] = useState(args.avatars);
    const [activeAvatar, setActiveAvatar] = useState(args.activeAvatar);
    const [effective, setEffective] = useState(args.effective);

    const syncAvatarFromContent = (content: string) => {
      try {
        const parsed = JSON.parse(content) as { avatar?: unknown };
        if (typeof parsed.avatar !== "string") {
          return;
        }
        setActiveAvatar(parsed.avatar);
        setAvatars((current) =>
          current.map((avatar) => ({
            ...avatar,
            active: avatar.nickname === parsed.avatar,
          })),
        );
        setEffective((current) => ({
          ...current,
          value: {
            ...(current.value as Record<string, unknown>),
            avatar: parsed.avatar,
          },
          content: `${JSON.stringify(
            {
              ...(current.value as Record<string, unknown>),
              avatar: parsed.avatar,
            },
            null,
            2,
          )}\n`,
        }));
      } catch {
        // keep stale state until JSON becomes valid again
      }
    };

    return (
      <div className="h-[860px] p-6">
        <GlobalSettingsPanel
          {...args}
          effective={effective}
          selectedLayerId={selectedLayerId}
          layerContent={layerContent}
          avatars={avatars}
          activeAvatar={activeAvatar}
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
            syncAvatarFromContent(content);
            args.onLayerContentChange(content);
          }}
          onCreateAvatar={async (nickname) => {
            const normalized = nickname.trim();
            if (!normalized) {
              return;
            }
            setAvatars((current) => [
              ...current,
              {
                nickname: normalized,
                active: false,
                iconUrl: avatarSvgUrl("#4f46e5"),
              },
            ]);
            await args.onCreateAvatar(normalized);
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof GlobalSettingsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UserSettingsWorkbenchView: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "View" }));
    const avatarSourceButton = canvasElement.querySelector('[data-settings-source-pointer="/avatar"]');
    await expect(avatarSourceButton).not.toBeNull();
    await userEvent.click(avatarSourceButton as HTMLElement);

    await expect(args.onSelectLayer).toHaveBeenCalledWith("global:user");
    await expect(args.onLoadLayer).toHaveBeenCalledWith("global:user");
  },
};

export const ManageAvatarCatalog: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: "Avatars" }));
    await userEvent.type(canvas.getByPlaceholderText("new-avatar"), "nova-ops");
    await userEvent.click(canvas.getByRole("button", { name: "Create avatar" }));
    await expect(args.onCreateAvatar).toHaveBeenCalledWith("nova-ops");
    await expect(canvas.getByText("nova-ops")).toBeInTheDocument();

    const setActiveButtons = canvas.getAllByRole("button", { name: "Set active" });
    await userEvent.click(setActiveButtons.at(-1)!);

    await userEvent.click(canvas.getByRole("tab", { name: "User Settings" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Layer Sources" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));

    await expect(args.onLayerContentChange).toHaveBeenCalled();
    const sourceDoc = canvasElement.querySelector('[data-testid="settings-layer-source-editor"] .cm-content');
    await expect(sourceDoc).not.toBeNull();
    await expect(sourceDoc?.textContent?.includes('"avatar": "nova-ops"')).toBe(true);
  },
};
