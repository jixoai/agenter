import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/settings/GlobalSettingsPanel.stories";

const { UserSettingsWorkbenchView, ManageAvatarCatalog } = composeStories(stories);

describe("Feature: Storybook DOM contract for global settings", () => {
  test("Scenario: Given global user settings view When activating field provenance Then the workbench jumps to the matching layer source", async () => {
    await UserSettingsWorkbenchView.run();
  });

  test("Scenario: Given avatar management is opened When creating and activating an avatar Then user settings stay in sync with the avatar catalog", async () => {
    await ManageAvatarCatalog.run();
  });
});
