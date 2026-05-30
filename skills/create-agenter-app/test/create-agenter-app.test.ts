import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const skillRoot = join(import.meta.dir, "..");
const scaffoldScript = join(skillRoot, "scripts", "scaffold.ts");
const validateScript = join(skillRoot, "scripts", "validate.ts");

const runBun = async (args: readonly string[], cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn({
    cmd: ["bun", ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
};

describe("Feature: create-agenter-app skill scripts", () => {
  test("Scenario: Given the skill folder When inspected Then it exposes the standard create-agenter-app entrypoint", () => {
    const skill = readFileSync(join(skillRoot, "SKILL.md"), "utf8");

    expect(skill).toContain("name: create-agenter-app");
    expect(skill).toContain("Create or update Agenter app packages");
    expect(skill).toContain("peerDependencies.agenter");
  });

  test("Scenario: Given external mode When scaffolding an app Then peer compatibility and app descriptor metadata are generated", async () => {
    const root = mkdtempSync(join(tmpdir(), "create-agenter-app-external-"));
    try {
      const target = join(root, "weather-app");
      const result = await runBun(
        [
          "run",
          scaffoldScript,
          "--target",
          target,
          "--app-id",
          "weather",
          "--command",
          "weather",
          "--package-name",
          "agenter-app-weather",
          "--agenter-range",
          ">=1.0.0 <1.1.0",
        ],
        root,
      );

      expect(result.exitCode).toBe(0);
      const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as {
        name?: string;
        peerDependencies?: Record<string, string>;
      };
      const descriptor = readFileSync(join(target, "src", "app.ts"), "utf8");
      expect(pkg.name).toBe("agenter-app-weather");
      expect(pkg.peerDependencies?.agenter).toBe(">=1.0.0 <1.1.0");
      expect(descriptor).toContain('appId: "weather"');
      expect(descriptor).toContain('command: "weather"');
      expect(descriptor).toContain('packageName: "agenter-app-weather"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Scenario: Given repo mode When scaffolding an app Then apps root is used as the default target parent", async () => {
    const root = mkdtempSync(join(tmpdir(), "create-agenter-app-repo-"));
    try {
      const result = await runBun(
        [
          "run",
          scaffoldScript,
          "--repo",
          "--repo-root",
          root,
          "--app-id",
          "notes",
          "--command",
          "notes",
          "--package-name",
          "agenter-app-notes",
          "--agenter-range",
          ">=1.0.0 <1.1.0",
        ],
        root,
      );

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(root, "apps", "notes", "package.json"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Scenario: Given generated app metadata When validating Then missing peer compatibility is rejected", async () => {
    const root = mkdtempSync(join(tmpdir(), "create-agenter-app-invalid-"));
    try {
      const target = join(root, "invalid");
      await runBun(
        [
          "run",
          scaffoldScript,
          "--target",
          target,
          "--app-id",
          "invalid",
          "--command",
          "invalid",
          "--package-name",
          "agenter-app-invalid",
          "--agenter-range",
          ">=1.0.0 <1.1.0",
        ],
        root,
      );
      const pkgPath = join(target, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { peerDependencies?: Record<string, string> };
      delete pkg.peerDependencies?.agenter;
      await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

      const result = await runBun(["run", validateScript, "--target", target], root);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("peerDependencies.agenter");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
