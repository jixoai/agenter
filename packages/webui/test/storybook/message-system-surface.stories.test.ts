import { describe, test } from "vitest";

import * as stories from "../../src/lib/features/messages/message-system-surface.stories.svelte";
import { getPortableStory } from "./portable-stories";

const addUserStory = getPortableStory(
  stories,
  "Scenario: Given the room toolbar add-user action When it is pressed Then room management lands on Users Add",
);
const reopenManageStory = getPortableStory(
  stories,
  "Scenario: Given room management was dismissed When the operator presses manage again Then the same dialog shell reopens without leaving the page inert",
);
const reopenSearchStory = getPortableStory(
  stories,
  "Scenario: Given room search was dismissed When the operator presses search again Then the search dialog reopens without leaving the page inert",
);
const shareStory = getPortableStory(
  stories,
  "Scenario: Given room management Share section When opened Then room websocket links and user tokens can be copied",
);

describe("Feature: Storybook DOM contract for message system surface", () => {
  test("Scenario: Given the room toolbar add-user action When it is pressed Then room management lands on Users Add", async () => {
    await addUserStory.run();
  });

  test("Scenario: Given room management was dismissed When the operator presses manage again Then the same dialog shell reopens without leaving the page inert", async () => {
    await reopenManageStory.run();
  });

  test("Scenario: Given room search was dismissed When the operator presses search again Then the search dialog reopens without leaving the page inert", async () => {
    await reopenSearchStory.run();
  });

  test("Scenario: Given room management Share section When opened Then room websocket links and user tokens can be copied", async () => {
    await shareStory.run();
  });
});
