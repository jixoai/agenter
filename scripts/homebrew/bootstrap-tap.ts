#!/usr/bin/env bun
import { cp, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs as parseNodeArgs } from "node:util";

export interface BootstrapHomebrewTapOptions {
  branch: string;
  commitMessage: string;
  createIfMissing: boolean;
  dryRun: boolean;
  projectionDir: string;
  repo: string;
  runner?: typeof run;
  workspace?: string;
}

export interface BootstrapHomebrewTapReport {
  changed: boolean;
  createdRepo: boolean;
  repoExists: boolean;
  stages: string[];
}

const DEFAULT_REPO = "jixoai/homebrew-agenter";
const DEFAULT_COMMIT_MESSAGE = "Update Agenter Homebrew projection";

const run = async (cmd: string[], cwd?: string): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const proc = Bun.spawn({
    cmd,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stderr, stdout };
};

const assertSuccess = async (cmd: string[], cwd: string | undefined, runner: typeof run): Promise<string> => {
  const result = await runner(cmd, cwd);
  if (result.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
};

const ensureProjectionDir = async (projectionDir: string): Promise<void> => {
  const entries = await readdir(projectionDir);
  if (entries.length === 0) {
    throw new Error(`homebrew projection dir is empty: ${projectionDir}`);
  }
};

const removeCheckoutContents = async (checkoutDir: string): Promise<void> => {
  for (const entry of await readdir(checkoutDir)) {
    if (entry === ".git") {
      continue;
    }
    await rm(join(checkoutDir, entry), { force: true, recursive: true });
  }
};

const copyTree = async (sourceDir: string, targetDir: string): Promise<void> => {
  for (const entry of await readdir(sourceDir)) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const info = await stat(sourcePath);
    if (info.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      await copyTree(sourcePath, targetPath);
      continue;
    }
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath);
  }
};

export const syncProjectionIntoCheckout = async (projectionDir: string, checkoutDir: string): Promise<void> => {
  // The tap repo is an install-facing projection only. Replace its working tree
  // wholesale from the main-repo projection so it cannot grow a second formula truth.
  await removeCheckoutContents(checkoutDir);
  await copyTree(projectionDir, checkoutDir);
};

const repoView = async (repo: string, runner: typeof run): Promise<boolean> => {
  const result = await runner(["gh", "repo", "view", repo, "--json", "nameWithOwner"], undefined);
  if (result.exitCode === 0) {
    return true;
  }
  if (result.stderr.includes("Could not resolve to a Repository")) {
    return false;
  }
  throw new Error(`gh repo view ${repo} failed: ${(result.stderr || result.stdout).trim()}`);
};

const hasGitChanges = async (checkoutDir: string, runner: typeof run): Promise<boolean> => {
  const status = await assertSuccess(["git", "status", "--short"], checkoutDir, runner);
  return status.length > 0;
};

export const bootstrapHomebrewTap = async (
  input: Omit<BootstrapHomebrewTapOptions, "workspace"> & { workspace?: string },
): Promise<BootstrapHomebrewTapReport> => {
  const ownedWorkspace = input.workspace === undefined;
  const options: BootstrapHomebrewTapOptions = {
    branch: input.branch,
    commitMessage: input.commitMessage,
    createIfMissing: input.createIfMissing,
    dryRun: input.dryRun,
    projectionDir: resolve(input.projectionDir),
    repo: input.repo,
    runner: input.runner ?? run,
    workspace: input.workspace ?? (await mkdtemp(join(tmpdir(), "agenter-homebrew-tap-"))),
  };
  const stages: string[] = [];

  try {
    await ensureProjectionDir(options.projectionDir);

    const exists = await repoView(options.repo, options.runner);
    let createdRepo = false;
    stages.push(exists ? `repo exists: ${options.repo}` : `repo missing: ${options.repo}`);

    if (!exists && !options.createIfMissing) {
      throw new Error(`homebrew tap repo does not exist: ${options.repo}`);
    }

    if (!exists && options.dryRun) {
      stages.push(`would create repo: ${options.repo}`);
      return { changed: true, createdRepo: false, repoExists: false, stages };
    }

    if (!exists) {
      await assertSuccess(
        ["gh", "repo", "create", options.repo, "--public", "--disable-issues", "--disable-wiki"],
        undefined,
        options.runner,
      );
      createdRepo = true;
      stages.push(`created repo: ${options.repo}`);
    }

    const checkoutDir = join(options.workspace, basename(options.repo));
    if (!options.dryRun) {
      await assertSuccess(["gh", "repo", "clone", options.repo, checkoutDir], undefined, options.runner);
      stages.push(`cloned repo: ${checkoutDir}`);
      await syncProjectionIntoCheckout(options.projectionDir, checkoutDir);
      stages.push(`synced projection: ${options.projectionDir}`);
      if (!(await hasGitChanges(checkoutDir, options.runner))) {
        stages.push("tap repo already up to date");
        return { changed: false, createdRepo, repoExists: true, stages };
      }
      await assertSuccess(["git", "add", "-A"], checkoutDir, options.runner);
      await assertSuccess(["git", "commit", "-m", options.commitMessage], checkoutDir, options.runner);
      await assertSuccess(["git", "push", "origin", `HEAD:${options.branch}`], checkoutDir, options.runner);
      stages.push(`pushed projection to ${options.repo}#${options.branch}`);
      return { changed: true, createdRepo, repoExists: true, stages };
    }

    stages.push(`would clone repo: ${options.repo}`);
    stages.push(`would sync projection: ${options.projectionDir}`);
    stages.push(`would commit and push: ${options.commitMessage}`);
    return { changed: true, createdRepo, repoExists: true, stages };
  } finally {
    if (ownedWorkspace) {
      await rm(options.workspace, { force: true, recursive: true });
    }
  }
};

export const parseArgs = (argv: readonly string[]): Omit<BootstrapHomebrewTapOptions, "runner" | "workspace"> => {
  const { values } = parseNodeArgs({
    args: [...argv],
    options: {
      branch: { type: "string", default: "main" },
      "commit-message": { type: "string", default: DEFAULT_COMMIT_MESSAGE },
      "create-if-missing": { type: "boolean", default: true },
      "dry-run": { type: "boolean", default: false },
      "projection-dir": { type: "string" },
      repo: { type: "string", default: DEFAULT_REPO },
    },
  });
  if (!values["projection-dir"]) {
    throw new Error("bootstrap-homebrew-tap requires --projection-dir");
  }
  return {
    branch: values.branch,
    commitMessage: values["commit-message"],
    createIfMissing: values["create-if-missing"],
    dryRun: values["dry-run"],
    projectionDir: values["projection-dir"],
    repo: values.repo,
  };
};

if (import.meta.main) {
  const report = await bootstrapHomebrewTap(parseArgs(Bun.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}
