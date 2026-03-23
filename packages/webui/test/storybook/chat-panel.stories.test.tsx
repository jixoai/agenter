import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/ChatPanel.stories";

const {
  ConversationFirstHistory,
  StreamingReply,
  MessageActionsOpenDevtools,
  LongPressShowsMessageActions,
  ActionableStoppedNotice,
  LoadingConversationHistory,
  RefreshingConversationHistory,
  CompactConversationKeepsNavigationAndComposerStable,
  VirtualizedPersistedHistory,
} = composeStories(stories);

describe("Feature: Storybook DOM contract for chat rendering", () => {
  test("Scenario: Given the chat route story When rendered in the browser Then conversation remains primary and technical facts stay out of the main flow", async () => {
    await ConversationFirstHistory.run();
  });

  test("Scenario: Given a streaming story and a stopped-session story When rendered in the browser Then Chat keeps one route-local session action and avoids duplicated warning banners", async () => {
    await StreamingReply.run();
    await ActionableStoppedNotice.run();
  });

  test("Scenario: Given empty and populated history hydration states When the chat surface renders Then loading feedback stays inside the conversation viewport", async () => {
    await LoadingConversationHistory.run();
    await RefreshingConversationHistory.run();
  });

  test("Scenario: Given a visible assistant message When the user opens message actions Then the related Devtools cycle remains reachable without cycle-first chat chrome", async () => {
    await MessageActionsOpenDevtools.run();
  });

  test("Scenario: Given a mobile-sized assistant bubble When the user long-presses Then the same message actions menu becomes visible without cycle chrome", async () => {
    await LongPressShowsMessageActions.run();
  });

  test("Scenario: Given a mobile-sized chat viewport When the conversation renders Then the route-local status pill and dense composer stay visible without horizontal overflow or cycle chrome", async () => {
    await CompactConversationKeepsNavigationAndComposerStable.run();
  });

  test("Scenario: Given a long persisted history story When the viewport virtualizes Then conversation rows and attachments remain visible without cycle chrome", async () => {
    await VirtualizedPersistedHistory.run();
  });
});
