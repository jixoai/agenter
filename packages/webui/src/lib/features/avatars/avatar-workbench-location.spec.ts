import { describe, expect, test } from "vitest";

import {
	buildAvatarCatalogHref,
	buildAvatarNewHref,
	createAvatarDraftId,
	readAvatarNewSourceNickname,
} from "./avatar-workbench-location";

describe("Feature: Avatar workbench routing helpers", () => {
	test("Scenario: Given the fixed avatars catalog page When building hrefs Then avatar focus stays in query state and new drafts move into dedicated pathname tabs", () => {
		expect(buildAvatarCatalogHref()).toBe("/avatars/catalog");
		expect(buildAvatarCatalogHref({ avatar: "reviewer" })).toBe("/avatars/catalog?avatar=reviewer");

		expect(buildAvatarNewHref({ draftId: "draft-1" })).toBe("/avatars/new/draft-1");
		expect(buildAvatarNewHref({ draftId: "draft-1", sourceAvatarNickname: "default" })).toBe(
			"/avatars/new/draft-1?source=default",
		);
	});

	test("Scenario: Given avatar draft query params When reading the source avatar Then blank values collapse to null", () => {
		expect(readAvatarNewSourceNickname(new URLSearchParams("source=reviewer"))).toBe("reviewer");
		expect(readAvatarNewSourceNickname(new URLSearchParams("source=%20%20"))).toBeNull();
		expect(readAvatarNewSourceNickname(new URLSearchParams())).toBeNull();
	});

	test("Scenario: Given browsers may expose different crypto capabilities When creating avatar draft ids Then the workbench still gets a non-empty client-side tab id", () => {
		expect(createAvatarDraftId()).toMatch(/\S+/u);
	});
});
