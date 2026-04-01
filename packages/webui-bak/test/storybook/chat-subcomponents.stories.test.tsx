import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as pendingAssetStories from "../../src/features/chat/AIInputPendingAssets.stories";
import * as attachmentStories from "../../src/features/chat/ChatAttachmentStrip.stories";
import * as messageRowStories from "../../src/features/chat/ChatMessageRow.stories";

const { PendingAssetsRemainOperable } = composeStories(pendingAssetStories);
const { PersistedAttachmentsRemainOperable } = composeStories(attachmentStories);
const { AssistantBubbleActionsRemainReachable } = composeStories(messageRowStories);

describe("Feature: Storybook DOM contract for chat subcomponents", () => {
  test("Scenario: Given queued attachments When the pending asset tray renders Then preview and removal actions stay operable", async () => {
    await PendingAssetsRemainOperable.run();
  });

  test("Scenario: Given persisted attachments When the strip renders Then preview remains available without the full chat route shell", async () => {
    await PersistedAttachmentsRemainOperable.run();
  });

  test("Scenario: Given an assistant bubble When the user opens the context menu Then Devtools remains reachable through bubble actions", async () => {
    await AssistantBubbleActionsRemainReachable.run();
  });
});
