import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/AIInput.stories";

const {
  SubmitDraft,
  SubmitRapidDraftsSeparately,
  CompleteWorkspacePath,
  RefreshWorkspacePathResults,
  ShowIgnoredWorkspacePath,
  PastePendingImage,
  DropPendingImage,
  BlockIncompatibleImageSend,
} = composeStories(stories);

describe("Feature: Storybook DOM contract for AI input", () => {
  test("Scenario: Given a draft story When Enter is pressed Then submission clears the real CodeMirror surface", async () => {
    await SubmitDraft.run();
  });

  test("Scenario: Given two quick submits When the second draft is sent Then the real CodeMirror surface does not append the cleared first draft", async () => {
    await SubmitRapidDraftsSeparately.run();
  });

  test("Scenario: Given an @ workspace story When choosing a folder and then a file Then the real CodeMirror document keeps the @ path addressing", async () => {
    await CompleteWorkspacePath.run();
  });

  test("Scenario: Given an @ workspace query When refining the token Then autocomplete re-queries and refreshes the list immediately", async () => {
    await RefreshWorkspacePathResults.run();
  });

  test("Scenario: Given an ignored direct-address result When listing completions Then the real DOM shows a muted ignored hint", async () => {
    await ShowIgnoredWorkspacePath.run();
  });

  test("Scenario: Given image-enabled input When an image is pasted Then the pending thumbnail opens a preview dialog", async () => {
    await PastePendingImage.run();
  });

  test("Scenario: Given image-enabled input When an image is dropped Then the pending thumbnail appears in the real DOM surface", async () => {
    await DropPendingImage.run();
  });

  test("Scenario: Given an image attachment on a non-image-capable model When the user sends Then the real DOM keeps the attachment and shows a compatibility notice", async () => {
    await BlockIncompatibleImageSend.run();
  });
});
