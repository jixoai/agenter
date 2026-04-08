import { describe, expect, test } from "vitest";

import { resolveMessageRoomTabLabel, resolveMessageRoomTabTitle } from "./message-room-tab-label";

describe("Feature: message room workbench tab labeling", () => {
	test("Scenario: Given a unique room title When deriving the workbench tab label Then the visible label stays concise", () => {
		expect(
			resolveMessageRoomTabLabel(
				{
					title: "Room",
					chatId: "0x2912d5eee9852563ea1c0fc4a30bd5a1d91247fb",
				},
				new Set<string>(),
			),
		).toBe("Room");
	});

	test("Scenario: Given duplicate room titles When deriving the workbench tab label Then a short room id suffix disambiguates the visible tabs", () => {
		expect(
			resolveMessageRoomTabLabel(
				{
					title: "Room",
					chatId: "0x2912d5eee9852563ea1c0fc4a30bd5a1d91247fb",
				},
				new Set<string>(["Room"]),
			),
		).toBe("Room · 1247fb");
	});

	test("Scenario: Given a blank room title When deriving the workbench tab title Then the durable room id becomes the fallback title", () => {
		expect(
			resolveMessageRoomTabTitle({
				title: "   ",
				chatId: "0x2912d5eee9852563ea1c0fc4a30bd5a1d91247fb",
			}),
		).toBe("0x2912d5eee9852563ea1c0fc4a30bd5a1d91247fb");
	});
});
