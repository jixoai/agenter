import type { AvatarCatalogItem } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";

import { GlobalSettingsPanel } from "./GlobalSettingsPanel";

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
    iconUrl: avatarSvgUrl("#7c3aed"),
  },
];

const meta = {
  title: "Features/Settings/GlobalSettingsPanel",
  component: GlobalSettingsPanel,
  args: {
    loading: false,
    saving: false,
    status: "Loaded 2 avatars",
    settingsContent: '{\n  "avatar": "jon"\n}\n',
    avatars: baseAvatars,
    activeAvatar: "jon",
    onSettingsContentChange: fn(),
    onSaveSettings: fn(),
    onCreateAvatar: fn(async () => undefined),
    onUploadAvatarIcon: fn(async () => undefined),
  },
  render: (args) => {
    const [settingsContent, setSettingsContent] = useState(args.settingsContent);
    const [avatars, setAvatars] = useState(args.avatars);
    const [activeAvatar, setActiveAvatar] = useState(args.activeAvatar);

    const syncActiveAvatar = (content: string) => {
      try {
        const parsed = JSON.parse(content) as { avatar?: unknown };
        if (typeof parsed.avatar === "string" && parsed.avatar.trim().length > 0) {
          setActiveAvatar(parsed.avatar);
          setAvatars((current) =>
            current.map((avatar) => ({
              ...avatar,
              active: avatar.nickname === parsed.avatar,
            })),
          );
        }
      } catch {
        // keep current state when draft JSON is temporarily invalid
      }
    };

    return (
      <div className="h-[760px] p-6">
        <GlobalSettingsPanel
          {...args}
          settingsContent={settingsContent}
          avatars={avatars}
          activeAvatar={activeAvatar}
          onSettingsContentChange={(content) => {
            setSettingsContent(content);
            syncActiveAvatar(content);
            args.onSettingsContentChange(content);
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
                iconUrl: avatarSvgUrl("#ea580c"),
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

export const ManageAvatarCatalog: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: "Avatars" }));
    await expect(canvas.getByRole("img", { name: "jon" })).toBeInTheDocument();
    await userEvent.type(canvas.getByPlaceholderText("new-avatar"), "nova-ops");
    await userEvent.click(canvas.getByRole("button", { name: "Create avatar" }));

    await expect(args.onCreateAvatar).toHaveBeenCalledWith("nova-ops");
    await expect(canvas.getByText("nova-ops")).toBeInTheDocument();

    const cards = canvas.getAllByRole("button", { name: "Set active" });
    await userEvent.click(cards.at(-1)!);
    await userEvent.click(canvas.getByRole("tab", { name: "User Settings" }));

    await expect(canvas.getByRole("textbox")).toHaveValue('{\n  "avatar": "nova-ops"\n}\n');
  },
};
