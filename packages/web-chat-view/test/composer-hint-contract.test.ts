import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const defaultComposerSource = readFileSync(
	resolve(import.meta.dirname, "../src/default-composer.svelte"),
	"utf8",
);

describe("Feature: host-managed composer hint contract", () => {
	test("Scenario: Given a host-managed send surface When reading the shared composer source Then the host hint text is rendered without transport override", () => {
		expect(defaultComposerSource).toContain("{hintText}");
		expect(defaultComposerSource).not.toContain(
			'{connectionState === "connected" || connectionState === "idle" ? hintText : "Waiting for channel transport"}',
		);
	});
});
