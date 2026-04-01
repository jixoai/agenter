import type { AuthSessionOutput, ProfileListItem } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { useState } from "react";

import { GlobalSettingsPanel, type GlobalProfileDraft } from "./GlobalSettingsPanel";
import type { SettingsEffectiveGraph, SettingsLayerItem } from "./settings-graph-types";

type DurableProfileItem = ProfileListItem & { profileId: string };

const profileSvgUrl = (fill: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="32" fill="${fill}"/></svg>`,
  )}`;

const authService = {
  endpoint: "http://127.0.0.1:4591",
  authMode: "wallet_challenge_jwt" as const,
  rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
  rootIdentifier: {
    kind: "wallet_evm" as const,
    value: "0x0000000000000000000000000000000000000001",
  },
  rootAuthKeyPath: "~/.agenter/profile-service/root-auth.key",
  jwtTtlSeconds: 3600,
  rootAuthBootstrapMode: "managed_local" as const,
  canRevealRootAuthPrivateKey: true,
  hasManagedRootAuthPrivateKey: true,
};

const authSession: AuthSessionOutput = {
  token: "auth-token-nova",
  issuedAt: "2026-03-20T10:00:00.000Z",
  expiresAt: "2026-03-20T11:00:00.000Z",
  claims: {
    authId: "wallet_evm:0x00000000000000000000000000000000000000aa",
    profileId: "profile-nova",
    admin: true,
    superadmin: false,
  },
  profile: {
    profileId: "profile-nova",
    identifiers: [{ kind: "wallet_evm", value: "0x00000000000000000000000000000000000000aa" }],
    metadata: { displayName: "Nova Ops", nickname: "nova" },
    iconUrl: profileSvgUrl("#ea580c"),
    isVirtual: false,
  },
};

const baseProfiles: DurableProfileItem[] = [
  {
    profileId: "profile-jon",
    identifiers: [{ kind: "wallet_evm", value: "0x0000000000000000000000000000000000000011" }],
    metadata: { displayName: "Jon", nickname: "jon" },
    iconUrl: profileSvgUrl("#0f766e"),
    isVirtual: false,
  },
  {
    profileId: "profile-nova",
    identifiers: [{ kind: "wallet_evm", value: "0x00000000000000000000000000000000000000aa" }],
    metadata: { displayName: "Nova Ops", nickname: "nova" },
    iconUrl: profileSvgUrl("#ea580c"),
    isVirtual: false,
  },
];

const globalEffectiveValue = {
  avatar: "jon",
  profileReference: "profile-jon",
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
      profileReference: {
        type: "string",
        description: "Durable profile selected for auth identity and icon flows.",
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
    "/profileReference": {
      pointer: "/profileReference",
      origins: [
        {
          layerId: "global:user",
          sourceId: "user",
          kind: "file",
          path: "~/.agenter/settings.json",
          pointer: "/profileReference",
          value: "profile-jon",
        },
      ],
      jumpTarget: {
        layerId: "global:user",
        pointer: "/profileReference",
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
];

const layerContentById: Record<string, string> = {
  "global:user": '{\n  "avatar": "jon",\n  "profileReference": "profile-jon",\n  "lang": "en",\n  "notes": ""\n}\n',
};

const patchActiveProfileReference = (content: string, profileReference: string): string => {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    parsed.profileReference = profileReference;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return `{\n  "profileReference": "${profileReference}"\n}\n`;
  }
};

const toDraft = (profile: DurableProfileItem | null): GlobalProfileDraft => ({
  nickname: profile?.metadata.nickname ?? "",
  displayName: profile?.metadata.displayName ?? "",
  phone: profile?.metadata.phone ?? "",
  address: profile?.metadata.address ?? "",
});

const meta = {
  title: "Features/Settings/GlobalSettingsPanel",
  component: GlobalSettingsPanel,
  args: {
    loading: false,
    saving: false,
    status: "Loaded 2 durable profiles",
    authStatus: "Authenticated wallet_evm:0x00000000000000000000000000000000000000aa.",
    authService,
    authSession,
    privateKeyDraft: "",
    effective: globalEffective,
    layers: settingsLayers,
    selectedLayerId: "global:user",
    layerContent: layerContentById["global:user"],
    profiles: baseProfiles,
    activeProfileReference: "profile-jon",
    selectedProfileReference: "profile-jon",
    profileDraft: toDraft(baseProfiles[0] ?? null),
    onSelectLayer: fn(),
    onLayerContentChange: fn(),
    onRefreshLayers: fn(),
    onLoadLayer: fn(),
    onSaveLayer: fn(),
    onSelectProfile: fn(),
    onSetActiveProfile: fn(),
    onProfileDraftChange: fn(),
    onPrivateKeyDraftChange: fn(),
    onAuthenticate: fn(async () => undefined),
    onUploadProfileIcon: fn(async () => undefined),
    onSaveProfile: fn(async () => undefined),
    onClearAuthSession: fn(),
  },
  render: (args) => {
    const [layerContent, setLayerContent] = useState(args.layerContent);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(args.selectedLayerId);
    const [profiles, setProfiles] = useState(args.profiles);
    const [activeProfileReference, setActiveProfileReference] = useState(args.activeProfileReference);
    const [selectedProfileReference, setSelectedProfileReference] = useState<string | null>(args.selectedProfileReference);
    const [profileDraft, setProfileDraft] = useState(args.profileDraft);
    const [effective, setEffective] = useState(args.effective);
    const [authStatus, setAuthStatus] = useState(args.authStatus);
    const [privateKeyDraft, setPrivateKeyDraft] = useState(args.privateKeyDraft);
    const [authSessionState, setAuthSessionState] = useState(args.authSession);

    return (
      <div className="h-[960px] p-6">
        <GlobalSettingsPanel
          {...args}
          authStatus={authStatus}
          authSession={authSessionState}
          effective={effective}
          selectedLayerId={selectedLayerId}
          layerContent={layerContent}
          profiles={profiles}
          activeProfileReference={activeProfileReference}
          selectedProfileReference={selectedProfileReference}
          profileDraft={profileDraft}
          privateKeyDraft={privateKeyDraft}
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
          onSetActiveProfile={(reference) => {
            setActiveProfileReference(reference);
            const nextContent = patchActiveProfileReference(layerContent, reference);
            setLayerContent(nextContent);
            setEffective((current) => ({
              ...current,
              value: {
                ...(current.value as Record<string, unknown>),
                profileReference: reference,
              },
              content: nextContent,
            }));
            args.onSetActiveProfile(reference);
          }}
          onSelectProfile={(reference) => {
            const next = profiles.find((profile) => profile.profileId === reference) ?? null;
            setSelectedProfileReference(reference);
            setProfileDraft(toDraft(next));
            args.onSelectProfile(reference);
          }}
          onProfileDraftChange={(draft) => {
            setProfileDraft(draft);
            args.onProfileDraftChange(draft);
          }}
          onPrivateKeyDraftChange={(value) => {
            setPrivateKeyDraft(value);
            args.onPrivateKeyDraftChange(value);
          }}
          onAuthenticate={async () => {
            setAuthStatus("Challenge signed.");
            await args.onAuthenticate();
          }}
          onSaveProfile={async () => {
            if (!selectedProfileReference) {
              return;
            }
            setProfiles((current) =>
              current.map((profile) =>
                profile.profileId === selectedProfileReference
                  ? {
                      ...profile,
                      metadata: {
                        ...profile.metadata,
                        nickname: profileDraft.nickname,
                        displayName: profileDraft.displayName,
                        phone: profileDraft.phone,
                        address: profileDraft.address,
                      },
                    }
                  : profile,
              ),
            );
            setAuthStatus(`Saved metadata for ${selectedProfileReference}.`);
            await args.onSaveProfile();
          }}
          onClearAuthSession={() => {
            setAuthSessionState(null);
            setAuthStatus("Cleared stored auth session token.");
            args.onClearAuthSession();
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
    const profileSourceButton = canvasElement.querySelector('[data-settings-source-pointer="/profileReference"]');
    await expect(profileSourceButton).not.toBeNull();
    await userEvent.click(profileSourceButton as HTMLElement);

    await expect(args.onSelectLayer).toHaveBeenCalledWith("global:user");
    await expect(args.onLoadLayer).toHaveBeenCalledWith("global:user");
  },
};

export const ManageDurableProfiles: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: "Profile" }));
    await userEvent.click(canvas.getAllByRole("button", { name: "Select" }).at(-1)!);
    await userEvent.click(canvas.getAllByRole("button", { name: "Set active" }).at(-1)!);
    await userEvent.clear(canvas.getByLabelText("Display name"));
    await userEvent.type(canvas.getByLabelText("Display name"), "Nova Ops Updated");
    await userEvent.click(canvas.getByRole("button", { name: "Save metadata" }));

    await expect(args.onSetActiveProfile).toHaveBeenCalledWith("profile-nova");
    await expect(args.onSaveProfile).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("tab", { name: "User Settings" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Layer Sources" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Source" }));

    const sourceDoc = canvasElement.querySelector('[data-testid="settings-layer-source-editor"] .cm-content');
    await expect(sourceDoc).not.toBeNull();
    await expect(sourceDoc?.textContent?.includes('"profileReference": "profile-nova"')).toBe(true);
  },
};

export const AuthenticateWithPrivateKey: Story = {
  args: {
    authSession: null,
    authStatus: "No stored auth session token.",
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Profile" }));
    await userEvent.type(canvas.getByPlaceholderText("0x-prefixed private key"), "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1");
    await userEvent.click(canvas.getByRole("button", { name: "Sign challenge" }));

    await expect(args.onPrivateKeyDraftChange).toHaveBeenCalled();
    await expect(args.onAuthenticate).toHaveBeenCalled();
  },
};
