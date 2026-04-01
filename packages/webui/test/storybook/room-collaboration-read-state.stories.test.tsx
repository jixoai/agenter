import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as disclosureStories from "../../src/features/chat/RoomReadProgressDisclosure.stories";
import * as userStories from "../../src/features/chat/RoomUsersPanel.stories";

const { PartialProgressOpensRosterDisclosure } = composeStories(disclosureStories);
const { EmptySeatList, MixedSeatStates } = composeStories(userStories);

describe("Feature: Storybook DOM contract for room collaboration read-state", () => {
  test("Scenario: Given a room read ring When the disclosure opens Then aggregate progress and per-seat read facts remain visible", async () => {
    await PartialProgressOpensRosterDisclosure.run();
  });

  test("Scenario: Given room users with mixed read and credential states When the side panel renders Then seat facts stay explicit even in empty fallback", async () => {
    await MixedSeatStates.run();
    await EmptySeatList.run();
  });
});
