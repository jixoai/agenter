import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/MessageChannelSurface.stories";

const {
  DesktopMultiChannelSurface,
  CompactMultiChannelSurface,
  CreateChannelViaMetadataDialog,
  DeliveredMessageLinksToDevtools,
  EmptyChannelCollection,
  LoadingChannelCollection,
  RefreshingChannelCollection,
  TransportErrorSurface,
  TypedRowsRenderAndInteractiveSubmit,
} = composeStories(stories);

describe("Feature: Storybook DOM contract for message channel surface", () => {
  test("Scenario: Given desktop and compact multi-channel chat surfaces When the user switches channels Then each viewport keeps the selected transcript stable", async () => {
    await DesktopMultiChannelSurface.run();
    await CompactMultiChannelSurface.run();
    await DeliveredMessageLinksToDevtools.run();
    await CreateChannelViaMetadataDialog.run();
  });

  test("Scenario: Given empty loading refreshing and error states When the surface renders Then each async state stays explicit and compact", async () => {
    await EmptyChannelCollection.run();
    await LoadingChannelCollection.run();
    await RefreshingChannelCollection.run();
    await TransportErrorSurface.run();
  });

  test("Scenario: Given typed channel rows When interactive and error cards render Then interactive submit flows through channel send", async () => {
    await TypedRowsRenderAndInteractiveSubmit.run();
  });
});
