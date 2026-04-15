import { describe, expect, test } from "vitest";

import {
	resolveWorkbenchSplitDetailLayout,
	resolveWorkbenchSplitDetailThreshold,
} from "./workbench-split-detail-math.js";

describe("Feature: Workbench split-detail math", () => {
	test("Scenario: Given a persisted ratio When the container grows wider Then the left and right widths keep the same percentage semantics", () => {
		const compactStart = resolveWorkbenchSplitDetailLayout({
			containerWidth: 800,
			ratio: 0.625,
			leftMin: 380,
			rightMin: 280,
			handleSize: 0,
		});
		const expanded = resolveWorkbenchSplitDetailLayout({
			containerWidth: 1000,
			ratio: 0.625,
			leftMin: 380,
			rightMin: 280,
			handleSize: 0,
		});

		expect(compactStart.compact).toBe(false);
		expect(compactStart.leftWidth).toBe(500);
		expect(compactStart.rightWidth).toBe(300);
		expect(expanded.leftWidth).toBe(625);
		expect(expanded.rightWidth).toBe(375);
	});

	test("Scenario: Given a right panel minimum When the requested ratio would shrink it too far Then the resolved width clamps without breaking desktop mode", () => {
		const layout = resolveWorkbenchSplitDetailLayout({
			containerWidth: 700,
			ratio: 0.9,
			leftMin: 380,
			rightMin: 280,
			handleSize: 12,
		});

		expect(layout.compact).toBe(false);
		expect(layout.leftWidth).toBe(408);
		expect(layout.rightWidth).toBe(280);
	});

	test("Scenario: Given insufficient width When the container cannot satisfy both minimums and the handle Then the layout collapses to compact mode", () => {
		const threshold = resolveWorkbenchSplitDetailThreshold({
			leftMin: 380,
			rightMin: 280,
			handleSize: 12,
		});
		const layout = resolveWorkbenchSplitDetailLayout({
			containerWidth: threshold - 1,
			ratio: 0.625,
			leftMin: 380,
			rightMin: 280,
			handleSize: 12,
		});

		expect(threshold).toBe(672);
		expect(layout.compact).toBe(true);
	});
});
