import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const layoutPrimitiveFiles = [
	"src/layout/clip-surface.svelte",
	"src/layout/scaffold/scaffold-root.svelte",
	"src/layout/scaffold/scaffold-body.svelte",
	"src/layout/scaffold/scaffold-scroll-body.svelte",
	"src/layout/split-view/split-view-root.svelte",
	"src/layout/split-view/split-view-sidebar.svelte",
	"src/layout/split-view/split-view-content.svelte",
	"src/layout/split-view/split-view-detail.svelte",
];

describe("Feature: svelte-components layout foundation", () => {
	test("Scenario: Given shared layout primitives When reviewing shrink-law hooks Then they keep internal layout-role anchors", () => {
		const violations = layoutPrimitiveFiles.filter((relativePath) => {
			const source = readFileSync(resolve(packageRoot, relativePath), "utf8");
			return !source.includes("data-layout-role=");
		});

		expect(violations).toEqual([]);
	});

	test("Scenario: Given scaffold roots without optional slots When reviewing source Then slot rows stay explicit inside the shared package", () => {
		const scaffoldRootSource = readFileSync(
			resolve(packageRoot, "src/layout/scaffold/scaffold-root.svelte"),
			"utf8",
		);

		expect(scaffoldRootSource).toContain('data-slot="scaffold-body"');
		expect(scaffoldRootSource).toContain('data-slot="scaffold-scroll-body"');
		expect(scaffoldRootSource).toContain("grid-row: 2");
	});

	test("Scenario: Given split-view variants When reviewing source Then responsive columns are owned by package-local media rules", () => {
		const splitViewSource = readFileSync(resolve(packageRoot, "src/layout/split-view/split-view-root.svelte"), "utf8");

		expect(splitViewSource).toContain("@media (min-width: 768px)");
		expect(splitViewSource).toContain("@media (min-width: 1024px)");
		expect(splitViewSource).toContain('data-variant="sidebar-content-detail"');
		expect(splitViewSource).not.toContain("md:grid-cols");
		expect(splitViewSource).not.toContain("xl:grid-cols");
	});

	test("Scenario: Given shared layout primitives When reading style selectors Then Tailwind utility display overrides remain available", () => {
		const violations = layoutPrimitiveFiles.filter((relativePath) => {
			const source = readFileSync(resolve(packageRoot, relativePath), "utf8");
			return source.includes("[data-layout-role=") && !source.includes(":where([data-layout-role=");
		});

		expect(violations).toEqual([]);
	});

	test("Scenario: Given the package export surface When reading index.ts Then ScrollView and scaffold-family namespaces are exported together", () => {
		const source = readFileSync(resolve(packageRoot, "src/index.ts"), "utf8");

		expect(source).toContain('export { default as ScrollView }');
		expect(source).toContain('export * as Scaffold');
		expect(source).toContain('export * as DialogScaffold');
		expect(source).toContain('export * as SplitView');
		expect(source).toContain('export { default as ClipSurface }');
	});

	test("Scenario: Given dynamically measured virtual rows When reviewing ScrollView source Then the wrapper does not clamp the main axis before measurement", () => {
		const source = readFileSync(resolve(packageRoot, "src/scroll-view.svelte"), "utf8");

		expect(source).toContain("const resolveVirtualItemStyle");
		expect(source).toContain('dynamicMeasure ? "" : `inline-size:${virtualItem.size}px;`');
		expect(source).toContain('dynamicMeasure ? "" : `block-size:${virtualItem.size}px;`');
		expect(source).not.toContain("inline-size: 100%;\n  }");
	});
});
