import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "bun:test";

const runCli = async (args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn(["bun", "run", "src/bin/ati.ts", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { code, stdout, stderr };
};

const findLatestWorkspace = (root: string): string | null => {
  const candidates: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const next = join(current, entry.name);
      if (existsSync(join(next, "output", "latest.log.html"))) {
        candidates.push(next);
      }
      stack.push(next);
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort();
  return candidates[candidates.length - 1];
};

test("cli fallback command works: `ati codexLike` -> run mode", async () => {
  const cwd = process.cwd();
  const root = mkdtempSync(join(tmpdir(), "ati-cli-fallback-"));
  const result = await runCli(["-o", root, "--size=10", "--color=256", "sh", "-lc", "printf 'hello-from-cli'"], cwd);

  expect(result.code).toBe(0);
  expect(result.stdout).toContain("[ati-meta]");
  expect(result.stdout).toContain("size=10:auto");
  expect(result.stdout).toContain("color=256");
  expect(result.stdout).toContain("log-style=rich");
  expect(result.stdout).toContain(`output-dir=${root}`);
  expect(result.stdout).toContain("hello-from-cli");

  const workspace = findLatestWorkspace(root);
  expect(workspace).not.toBeNull();
  const latestPath = join(workspace as string, "output", "latest.log.html");
  expect(existsSync(latestPath)).toBe(true);
  expect(readFileSync(latestPath, "utf8")).toContain('status: "');

  rmSync(root, { recursive: true, force: true });
});

test("cli run without target program returns non-zero", async () => {
  const result = await runCli(["run"], process.cwd());
  expect(result.code).not.toBe(0);
  expect(result.stderr.toLowerCase()).toContain("not enough");
});

test("cli --git-log bare flag does not consume target command", async () => {
  const cwd = process.cwd();
  const root = mkdtempSync(join(tmpdir(), "ati-cli-gitlog-"));
  const result = await runCli(["run", "--git-log", "-o", root, "sh", "-lc", "printf 'ok-git-log'"], cwd);

  expect(result.code).toBe(0);
  expect(result.stdout).toContain("git-log=normal");
  expect(result.stdout).toContain("ok-git-log");

  const workspace = findLatestWorkspace(root);
  expect(workspace).not.toBeNull();
  expect(existsSync(join(workspace as string, ".git"))).toBe(true);

  rmSync(root, { recursive: true, force: true });
});
