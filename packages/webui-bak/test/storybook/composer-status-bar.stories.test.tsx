import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/ComposerStatusBar.stories";

const { WideStatusBarAutoOpensHelpHint, CompactStatusBarCollapsesHelpIntoMenu, SubmittingStatusBarShowsBusySignal } =
  composeStories(stories);

describe("Feature: Storybook DOM contract for composer status bar", () => {
  test("Scenario: Given wide and compact composer status rows When they render Then help hints auto-open once and remain re-openable after manual dismissal", async () => {
    await WideStatusBarAutoOpensHelpHint.run();
    await CompactStatusBarCollapsesHelpIntoMenu.run();
  });

  test("Scenario: Given a submitting draft When the status row renders Then the busy local status is exposed without involving route-level session state", async () => {
    await SubmittingStatusBarShowsBusySignal.run();
  });
});
