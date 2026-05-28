import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../..");
const readRepoFile = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), "utf8");

const copyVisionSchema = async (projectRoot: string): Promise<void> => {
  await mkdir(join(projectRoot, "openspec", "schemas"), { recursive: true });
  await cp(
    join(repoRoot, "openspec", "schemas", "vision-driven"),
    join(projectRoot, "openspec", "schemas", "vision-driven"),
    {
      recursive: true,
    },
  );
};

const runBun = async (args: string[], cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
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

describe("Feature: vision-driven OpenSpec workflow contract", () => {
  test("Scenario: Given the project schema is loaded When inspecting the schema Then intent, specs, tasks, and self-review form the enforced workflow", () => {
    const schema = readRepoFile("openspec/schemas/vision-driven/schema.yaml");
    const config = readRepoFile("openspec/config.yaml");

    expect(config).toMatch(/^schema: vision-driven$/m);
    expect(schema).toContain("name: vision-driven");
    expect(schema).toContain("id: research-plan");
    expect(schema).toContain("generates: plans/plan.md");
    expect(schema).toContain("change-local demo/spike code under `demos/`");
    expect(schema).toContain("id: specs");
    expect(schema).toContain("requires:\n      - research-plan");
    expect(schema).toContain("id: tasks");
    expect(schema).toContain("requires:\n      - specs");
    expect(schema).toContain("id: self-review");
    expect(schema).toContain("generates: review/self-review.html");
    expect(schema).toContain("review/review-intent-and-tasks.md");
    expect(schema).toContain("tracks: tasks.md");
  });

  test("Scenario: Given a plan already exists When backup-plan runs Then the previous SSOT is versioned instead of overwritten", async () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), "vision-driven-"));
    try {
      const changeDir = join(tmpRoot, "openspec", "changes", "demo-change");
      await mkdir(join(changeDir, "plans"), { recursive: true });
      await writeFile(join(changeDir, "plans", "plan.md"), "current plan\n");

      const result = await runBun(
        [join(repoRoot, "scripts", "openspec", "vision-driven.ts"), "backup-plan", "demo-change"],
        tmpRoot,
      );

      expect(result.exitCode).toBe(0);
      expect(readFileSync(join(changeDir, "plans", "plan-v1.md"), "utf8")).toBe("current plan\n");
      expect(result.stdout).toContain("plan-v1.md");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("Scenario: Given review finds a recurring issue When review-state records the second occurrence Then the controller exits with loop-back signal", async () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), "vision-driven-"));
    try {
      const changeDir = join(tmpRoot, "openspec", "changes", "demo-change");
      await mkdir(changeDir, { recursive: true });

      const first = await runBun(
        [
          join(repoRoot, "scripts", "openspec", "vision-driven.ts"),
          "review-state",
          "demo-change",
          "--issue",
          "unclear-exit",
        ],
        tmpRoot,
      );
      const second = await runBun(
        [
          join(repoRoot, "scripts", "openspec", "vision-driven.ts"),
          "review-state",
          "demo-change",
          "--issue",
          "unclear-exit",
        ],
        tmpRoot,
      );

      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(2);
      expect(second.stdout).toContain('"repeatedIssues"');
      expect(second.stdout).toContain("unclear-exit");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("Scenario: Given a vision-driven change is missing review proof When check runs Then it reports the missing workflow artifact", async () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), "vision-driven-"));
    try {
      await copyVisionSchema(tmpRoot);
      const changeDir = join(tmpRoot, "openspec", "changes", "demo-change");
      await mkdir(join(changeDir, "plans"), { recursive: true });
      writeFileSync(join(changeDir, ".openspec.yaml"), "schema: vision-driven\ncreated: 2026-05-28\n");
      writeFileSync(join(changeDir, "plans", "plan.md"), "# Intent\n");
      writeFileSync(join(changeDir, "tasks.md"), "- [ ] 1.1 Do the thing\n");

      const result = await runBun(
        [join(repoRoot, "scripts", "openspec", "vision-driven.ts"), "check", "demo-change"],
        tmpRoot,
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("review/self-review.html is missing");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("Scenario: Given a complete vision-driven change When check runs Then the workflow gate passes", async () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), "vision-driven-"));
    try {
      await copyVisionSchema(tmpRoot);
      const changeDir = join(tmpRoot, "openspec", "changes", "demo-change");
      await mkdir(join(changeDir, "plans"), { recursive: true });
      await mkdir(join(changeDir, "review"), { recursive: true });
      writeFileSync(join(changeDir, ".openspec.yaml"), "schema: vision-driven\ncreated: 2026-05-28\n");
      writeFileSync(join(changeDir, "plans", "plan.md"), "# Intent\n");
      writeFileSync(join(changeDir, "tasks.md"), "- [x] 1.1 Do the thing\n");
      writeFileSync(join(changeDir, "review", "self-review.html"), "<!doctype html><title>Review</title>\n");

      const result = await runBun(
        [join(repoRoot, "scripts", "openspec", "vision-driven.ts"), "check", "demo-change"],
        tmpRoot,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('"ok": true');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
