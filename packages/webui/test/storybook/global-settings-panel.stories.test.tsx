import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/settings/GlobalSettingsPanel.stories";

const { UserSettingsWorkbenchView, ManageDurableProfiles, AuthenticateWithPrivateKey } = composeStories(stories);

describe("Feature: Storybook DOM contract for global settings", () => {
  test("Scenario: Given global user settings view When activating field provenance Then the workbench jumps to the matching layer source", async () => {
    await UserSettingsWorkbenchView.run();
  });

  test("Scenario: Given durable profile management is opened When selecting and activating a profile Then user settings stay in sync with the canonical profile reference", async () => {
    await ManageDurableProfiles.run();
  });

  test("Scenario: Given private-key auth entry When the operator signs a challenge Then the auth action remains directly reachable inside profile management", async () => {
    await AuthenticateWithPrivateKey.run();
  });
});
