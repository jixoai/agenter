import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/components/ui/json-viewer.stories";

const { YamlPreviewKeepsQuotedKeys, MenuSwitchesViewerModes, ContextMenuOpensOptions } = composeStories(stories);

describe("Feature: Storybook DOM contract for JSON viewer", () => {
  test("Scenario: Given YAML preview with quoted keys When rendered Then colon-rich keys stay readable", async () => {
    await YamlPreviewKeepsQuotedKeys.run();
  });

  test("Scenario: Given viewer menus When local and global modes change Then render modes update predictably", async () => {
    await MenuSwitchesViewerModes.run();
  });

  test("Scenario: Given the YAML preview label When it is right-clicked Then the same options menu opens", async () => {
    await ContextMenuOpensOptions.run();
  });
});
