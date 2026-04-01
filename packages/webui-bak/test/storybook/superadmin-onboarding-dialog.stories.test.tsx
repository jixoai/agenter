import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/settings/SuperadminOnboardingDialog.stories";

const { ImportExistingKey, RevealManagedKey } = composeStories(stories);

describe("Feature: Storybook DOM contract for superadmin onboarding", () => {
  test("Scenario: Given onboarding is visible When the operator imports or reveals the root key Then the dialog supports both bootstrap paths", async () => {
    await ImportExistingKey.run();
    await RevealManagedKey.run();
  });
});
