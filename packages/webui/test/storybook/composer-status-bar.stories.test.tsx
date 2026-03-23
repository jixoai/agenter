import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/ComposerStatusBar.stories";

const { WideStatusBarKeepsInlineHelp, CompactStatusBarCollapsesHelpIntoMenu, SubmittingStatusBarShowsBusySignal } =
  composeStories(stories);

describe("Feature: Storybook DOM contract for composer status bar", () => {
  test("Scenario: Given wide and compact composer status rows When they render Then composer-local status remains visible while help collapses into a question-mark menu first", async () => {
    await WideStatusBarKeepsInlineHelp.run();
    await CompactStatusBarCollapsesHelpIntoMenu.run();
  });

  test("Scenario: Given a submitting draft When the status row renders Then the busy local status is exposed without involving route-level session state", async () => {
    await SubmittingStatusBarShowsBusySignal.run();
  });
});
