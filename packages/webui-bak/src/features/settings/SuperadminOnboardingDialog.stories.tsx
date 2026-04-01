import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { SuperadminOnboardingDialog } from "./SuperadminOnboardingDialog";

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

const authenticateSpy = fn(async () => undefined);
const revealSpy = fn(async () => undefined);

const StoryHarness = ({ managedReveal = false }: { managedReveal?: boolean }) => {
  const [privateKeyDraft, setPrivateKeyDraft] = useState("");
  const [authStatus, setAuthStatus] = useState("No stored auth session token.");

  return (
    <div className="min-h-[32rem] bg-slate-100 p-6">
      <SuperadminOnboardingDialog
        open
        authService={authService}
        authStatus={authStatus}
        privateKeyDraft={privateKeyDraft}
        canRevealManagedKey
        managedKeyBusy={false}
        onPrivateKeyDraftChange={setPrivateKeyDraft}
        onRevealManagedKey={async () => {
          revealSpy.mockClear();
          await revealSpy();
          setPrivateKeyDraft("0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1");
          setAuthStatus("Loaded backend-managed root key for wallet_evm:0x0000000000000000000000000000000000000001.");
        }}
        onAuthenticate={async () => {
          authenticateSpy.mockClear();
          await authenticateSpy();
          setAuthStatus("Authenticated wallet_evm:0x0000000000000000000000000000000000000001 as superadmin.");
        }}
        onDismiss={() => undefined}
      />
    </div>
  );
};

const meta = {
  title: "Features/Settings/SuperadminOnboardingDialog",
  component: StoryHarness,
} satisfies Meta<typeof StoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ImportExistingKey: Story = {
  render: () => <StoryHarness />,
  play: async ({ canvasElement }) => {
    authenticateSpy.mockClear();
    const portal = within(document.body);
    const dialog = await portal.findByRole("dialog", { name: "Bind superadmin key" });
    await within(dialog).findByText("No stored auth session token.");

    await userEvent.type(within(dialog).getByPlaceholderText("0x-prefixed private key"), "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign challenge" }));

    await expect(authenticateSpy).toHaveBeenCalledTimes(1);
    await expect(dialog).toHaveTextContent("Authenticated wallet_evm:0x0000000000000000000000000000000000000001 as superadmin.");
  },
};

export const RevealManagedKey: Story = {
  render: () => <StoryHarness managedReveal />,
  play: async ({ canvasElement }) => {
    revealSpy.mockClear();
    const portal = within(document.body);
    const dialog = await portal.findByRole("dialog", { name: "Bind superadmin key" });
    await within(dialog).findByText("No stored auth session token.");

    await userEvent.click(within(dialog).getByRole("button", { name: "Use backend-managed key" }));

    await expect(revealSpy).toHaveBeenCalledTimes(1);
    await expect(within(dialog).getByPlaceholderText("0x-prefixed private key")).toHaveValue(
      "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1",
    );
  },
};
