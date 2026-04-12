import { describe, expect, test } from "vitest";

import {
	removeAvatarCreateTab,
	upsertAvatarCreateTab,
	type AvatarCreateTabEntry,
} from "./avatar-create-tabs-state";

describe("Feature: Avatar create draft tabs", () => {
	test("Scenario: Given one avatar draft is revisited When upserting it with a new href and nickname Then the workbench keeps one durable draft tab entry", () => {
		const current: AvatarCreateTabEntry[] = [
			{
				draftId: "draft-alpha",
				href: "/avatars/new/draft-alpha",
				draftNickname: "",
				sourceAvatarNickname: "default",
			},
		];

		const next = upsertAvatarCreateTab(current, {
			draftId: "draft-alpha",
			href: "/avatars/new/draft-alpha?source=reviewer",
			draftNickname: "reviewer-helper",
			sourceAvatarNickname: "reviewer",
		});

		expect(next).toEqual([
			{
				draftId: "draft-alpha",
				href: "/avatars/new/draft-alpha?source=reviewer",
				draftNickname: "reviewer-helper",
				sourceAvatarNickname: "reviewer",
			},
		]);
	});

	test("Scenario: Given multiple avatar draft tabs When closing one draft Then the remaining browser-style draft tabs stay intact", () => {
		const current: AvatarCreateTabEntry[] = [
			{
				draftId: "draft-alpha",
				href: "/avatars/new/draft-alpha",
				draftNickname: "",
				sourceAvatarNickname: "default",
			},
			{
				draftId: "draft-beta",
				href: "/avatars/new/draft-beta?source=reviewer",
				draftNickname: "reviewer-helper",
				sourceAvatarNickname: "reviewer",
			},
		];

		expect(removeAvatarCreateTab(current, "draft-alpha")).toEqual([
			{
				draftId: "draft-beta",
				href: "/avatars/new/draft-beta?source=reviewer",
				draftNickname: "reviewer-helper",
				sourceAvatarNickname: "reviewer",
			},
		]);
	});
});
