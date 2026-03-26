import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/message-channel-metadata-disclosure.stories";

const { ReadonlyMetadata, AdminMetadataManagement } = composeStories(stories);

describe("Feature: Storybook DOM contract for message channel metadata disclosure", () => {
  test("Scenario: Given readonly and admin channel access When the disclosure opens Then controls stay role-aware and token admin flows remain explicit", async () => {
    await ReadonlyMetadata.run();
    await AdminMetadataManagement.run();
  });
});
