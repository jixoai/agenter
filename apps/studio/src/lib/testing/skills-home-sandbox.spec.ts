import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { resetSkillsHomeSandbox, resolveSkillsHomeSandboxPaths } from "./skills-home-sandbox";

describe("Feature: Skills home sandbox reset law", () => {
	test("Scenario: Given an initialized skills sandbox When it resets Then only the named home and workspace roots are recreated with markers", () => {
		const root = mkdtempSync(join(tmpdir(), "agenter-skills-home-sandbox-"));
		try {
			const homeDir = join(root, ".playwright", "agenter-home");
			const paths = resetSkillsHomeSandbox(homeDir);

			writeFileSync(join(paths.homeDir, "stale.txt"), "stale\n", "utf8");
			writeFileSync(join(paths.workspacePath, "stale.txt"), "stale\n", "utf8");

			const resetPaths = resetSkillsHomeSandbox(homeDir);

			expect(resetPaths).toEqual(paths);
			expect(() => readFileSync(join(paths.homeDir, "stale.txt"), "utf8")).toThrow();
			expect(() => readFileSync(join(paths.workspacePath, "stale.txt"), "utf8")).toThrow();
			expect(readFileSync(paths.playgroundMarkerPath, "utf8")).toContain("playground sandbox");
			expect(readFileSync(paths.homeMarkerPath, "utf8")).toContain("home sandbox");
			expect(readFileSync(paths.workspaceMarkerPath, "utf8")).toContain("workspace sandbox");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	test("Scenario: Given an unmanaged existing home directory When the sandbox reset runs Then the script refuses to clear it", () => {
		const root = mkdtempSync(join(tmpdir(), "agenter-skills-home-sandbox-"));
		try {
			const homeDir = join(root, "existing-home");
			const paths = resolveSkillsHomeSandboxPaths(homeDir);

			mkdirSync(paths.homeDir, { recursive: true });
			writeFileSync(join(paths.homeDir, "keep.txt"), "keep\n", "utf8");

			expect(() => resetSkillsHomeSandbox(homeDir)).toThrow(/refusing to clear unmanaged skills/);
			expect(readFileSync(join(paths.homeDir, "keep.txt"), "utf8")).toBe("keep\n");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	test("Scenario: Given a managed playground root with a half-initialized home When the sandbox reset reruns Then the reset treats the missing per-dir markers as stale harness residue", () => {
		const root = mkdtempSync(join(tmpdir(), "agenter-skills-home-sandbox-"));
		try {
			const homeDir = join(root, ".playwright", "agenter-home");
			const paths = resetSkillsHomeSandbox(homeDir);

			rmSync(paths.homeMarkerPath, { force: true });
			rmSync(paths.workspaceMarkerPath, { force: true });
			writeFileSync(join(paths.homeDir, "stale.txt"), "stale\n", "utf8");
			writeFileSync(join(paths.workspacePath, "stale.txt"), "stale\n", "utf8");

			const resetPaths = resetSkillsHomeSandbox(homeDir);

			expect(resetPaths).toEqual(paths);
			expect(() => readFileSync(join(paths.homeDir, "stale.txt"), "utf8")).toThrow();
			expect(() => readFileSync(join(paths.workspacePath, "stale.txt"), "utf8")).toThrow();
			expect(readFileSync(paths.homeMarkerPath, "utf8")).toContain("home sandbox");
			expect(readFileSync(paths.workspaceMarkerPath, "utf8")).toContain("workspace sandbox");
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
