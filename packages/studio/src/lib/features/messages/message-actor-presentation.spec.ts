import { describe, expect, test } from "vitest";

import {
	resolveSeatSubtitleForTranscript,
	shouldShowSeatSubtitleForTranscript,
} from "./message-actor-presentation";

describe("Feature: message transcript actor presentation", () => {
	test("Scenario: Given a unique visible room label When projecting transcript metadata Then selector-level subtitle detail stays hidden", () => {
		const seat = {
			label: "jane",
			subtitle: "/repo/jane",
			role: "member",
			currentAdmin: false,
		} as const;

		expect(shouldShowSeatSubtitleForTranscript(seat, new Set())).toBe(false);
		expect(resolveSeatSubtitleForTranscript(seat, new Set())).toBeUndefined();
	});

	test("Scenario: Given duplicate visible room labels When projecting transcript metadata Then the canonical subtitle stays visible for disambiguation", () => {
		const seat = {
			label: "jane",
			subtitle: "/repo/jane",
			role: "member",
			currentAdmin: false,
		} as const;

		expect(shouldShowSeatSubtitleForTranscript(seat, new Set(["jane"]))).toBe(true);
		expect(resolveSeatSubtitleForTranscript(seat, new Set(["jane"]))).toBe("/repo/jane");
	});

	test("Scenario: Given duplicate visible room labels without a custom subtitle When projecting transcript metadata Then role fallback stays available for disambiguation", () => {
		const seat = {
			label: "jane",
			subtitle: undefined,
			role: "admin",
			currentAdmin: true,
		} as const;

		expect(resolveSeatSubtitleForTranscript(seat, new Set(["jane"]))).toBe(
			"admin · current admin",
		);
	});
});
