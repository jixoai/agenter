#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

type Command = "backup-plan" | "review-state" | "check";

interface ReviewState {
  change: string;
  iteration: number;
  maxIterations: number;
  recurringIssues: Record<string, number>;
  exitCondition?: string;
  updatedAt: string;
}

const projectRoot = process.cwd();

const usage = (): string =>
  [
    "Usage:",
    "  bun run scripts/openspec/vision-driven.ts backup-plan <change>",
    "  bun run scripts/openspec/vision-driven.ts review-state <change> [--issue <id>] [--max <n>] [--exit-condition <text>]",
    "  bun run scripts/openspec/vision-driven.ts check <change>",
  ].join("\n");

const getArgValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args.at(index + 1);
};

const requireChange = (value: string | undefined): string => {
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing change name.\n${usage()}`);
  }
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid change name: ${value}`);
  }
  return value;
};

const changeDirOf = (change: string): string => join(projectRoot, "openspec", "changes", change);
const planPathOf = (change: string): string => join(changeDirOf(change), "plans", "plan.md");
const reviewStatePathOf = (change: string): string => join(changeDirOf(change), "review", "state.json");

const assertChangeExists = (change: string): string => {
  const changeDir = changeDirOf(change);
  if (!existsSync(changeDir)) {
    throw new Error(`OpenSpec change not found: ${changeDir}`);
  }
  return changeDir;
};

const nextPlanBackupPath = (change: string): string => {
  const plansDir = join(changeDirOf(change), "plans");
  for (let index = 1; index < 1000; index += 1) {
    const backupPath = join(plansDir, `plan-v${index}.md`);
    if (!existsSync(backupPath)) {
      return backupPath;
    }
  }
  throw new Error("Too many plan revisions.");
};

const backupPlan = async (change: string): Promise<void> => {
  assertChangeExists(change);
  const currentPlanPath = planPathOf(change);
  if (!existsSync(currentPlanPath)) {
    console.log(`No current plan found at ${currentPlanPath}; nothing to back up.`);
    return;
  }
  const backupPath = nextPlanBackupPath(change);
  await mkdir(dirname(backupPath), { recursive: true });
  await copyFile(currentPlanPath, backupPath);
  console.log(`Backed up ${currentPlanPath} -> ${backupPath}`);
};

const readReviewState = async (change: string): Promise<ReviewState | null> => {
  const statePath = reviewStatePathOf(change);
  if (!existsSync(statePath)) {
    return null;
  }
  return (await Bun.file(statePath).json()) as ReviewState;
};

const writeReviewState = async (state: ReviewState): Promise<void> => {
  const statePath = reviewStatePathOf(state.change);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
};

const parseReviewState = (raw: string): ReviewState | null => {
  const parsed = JSON.parse(raw) as Partial<ReviewState>;
  if (
    typeof parsed.change !== "string" ||
    !Number.isInteger(parsed.iteration) ||
    !Number.isInteger(parsed.maxIterations) ||
    typeof parsed.updatedAt !== "string" ||
    typeof parsed.recurringIssues !== "object" ||
    parsed.recurringIssues === null ||
    Array.isArray(parsed.recurringIssues)
  ) {
    return null;
  }
  return {
    change: parsed.change,
    iteration: parsed.iteration,
    maxIterations: parsed.maxIterations,
    recurringIssues: parsed.recurringIssues,
    exitCondition: typeof parsed.exitCondition === "string" ? parsed.exitCondition : undefined,
    updatedAt: parsed.updatedAt,
  };
};

const updateReviewState = async (change: string, args: string[]): Promise<void> => {
  assertChangeExists(change);
  const previous = await readReviewState(change);
  const maxIterationsValue = getArgValue(args, "--max");
  const issue = getArgValue(args, "--issue");
  const exitCondition = getArgValue(args, "--exit-condition") ?? previous?.exitCondition;
  const maxIterations = maxIterationsValue ? Number.parseInt(maxIterationsValue, 10) : (previous?.maxIterations ?? 5);
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new Error(`Invalid --max value: ${maxIterationsValue}`);
  }

  const recurringIssues = { ...(previous?.recurringIssues ?? {}) };
  if (issue) {
    recurringIssues[issue] = (recurringIssues[issue] ?? 0) + 1;
  }

  const stateBase = {
    change,
    iteration: (previous?.iteration ?? 0) + 1,
    maxIterations,
    recurringIssues,
    updatedAt: new Date().toISOString(),
  };
  const state: ReviewState = exitCondition ? { ...stateBase, exitCondition } : stateBase;
  await writeReviewState(state);

  const repeatedIssues = Object.entries(recurringIssues)
    .filter(([, count]) => count >= 2)
    .map(([id]) => id);
  const exhausted = state.iteration >= state.maxIterations;
  console.log(JSON.stringify({ state, repeatedIssues, exhausted }, null, 2));
  if (repeatedIssues.length > 0 || exhausted) {
    process.exitCode = 2;
  }
};

const checkChange = async (change: string): Promise<void> => {
  const changeDir = assertChangeExists(change);
  const metadataPath = join(changeDir, ".openspec.yaml");
  const planPath = planPathOf(change);
  const tasksPath = join(changeDir, "tasks.md");
  const reviewHtmlPath = join(changeDir, "review", "self-review.html");
  const reviewStatePath = reviewStatePathOf(change);

  const metadata = existsSync(metadataPath) ? await readFile(metadataPath, "utf-8") : "";
  const issues: string[] = [];
  if (!metadata.includes("schema: vision-driven")) {
    issues.push(`${basename(metadataPath)} must declare schema: vision-driven`);
  }
  if (!existsSync(planPath)) {
    issues.push("plans/plan.md is missing");
  }
  if (!existsSync(tasksPath)) {
    issues.push("tasks.md is missing");
  }
  if (existsSync(tasksPath)) {
    const tasks = await readFile(tasksPath, "utf-8");
    if (!/^[-*]\s+\[[ xX]\]\s+/m.test(tasks)) {
      issues.push("tasks.md has no trackable checkboxes");
    }
  }
  if (!existsSync(reviewHtmlPath)) {
    issues.push("review/self-review.html is missing");
  } else {
    const reviewHtml = await readFile(reviewHtmlPath, "utf-8");
    if (reviewHtml.trim().length === 0) {
      issues.push("review/self-review.html is empty");
    }
  }
  if (existsSync(reviewStatePath)) {
    try {
      const parsedState = parseReviewState(await readFile(reviewStatePath, "utf-8"));
      if (!parsedState) {
        issues.push("review/state.json is invalid");
      } else if (parsedState.change !== change) {
        issues.push(`review/state.json change mismatch: expected ${change}, got ${parsedState.change}`);
      }
    } catch {
      issues.push("review/state.json is invalid");
    }
  }

  if (issues.length > 0) {
    console.error(JSON.stringify({ ok: false, change, issues }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, change }, null, 2));
};

const main = async (): Promise<void> => {
  const [commandValue, changeValue, ...rest] = Bun.argv.slice(2);
  const command = commandValue as Command | undefined;
  const change = requireChange(changeValue);
  if (command === "backup-plan") {
    await backupPlan(change);
    return;
  }
  if (command === "review-state") {
    await updateReviewState(change, rest);
    return;
  }
  if (command === "check") {
    await checkChange(change);
    return;
  }
  throw new Error(`Unknown command: ${commandValue ?? ""}\n${usage()}`);
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
