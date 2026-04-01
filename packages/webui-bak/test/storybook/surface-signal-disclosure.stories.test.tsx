import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/components/ui/surface-signal-disclosure.stories";

const { NeutralSignalOpensDialog, WarningSignalKeepsCompactChrome } = composeStories(stories);

describe("Feature: Storybook DOM contract for surface signal disclosure", () => {
  test("Scenario: Given a passive metadata signal When the user hovers and opens it Then tooltip-backed icon chrome reveals a secondary dialog surface", async () => {
    await NeutralSignalOpensDialog.run();
  });

  test("Scenario: Given a warning signal in compact chrome When it renders Then the trigger stays compact and does not consume a full metadata row", async () => {
    await WarningSignalKeepsCompactChrome.run();
  });
});
