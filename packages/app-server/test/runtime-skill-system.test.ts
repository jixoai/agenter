import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AttentionSystem } from "@agenter/attention-system";
import { RuntimeSkillSystem, type RuntimeSkillRefreshResult } from "../src/runtime-skill-system";
import type { WorkspaceGrantRecord } from "../src/workspace-system";

const tempDirs: string[] = [];
const systems: RuntimeSkillSystem[] = [];

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-runtime-skill-system-"));
  tempDirs.push(root);
  return root;
};

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const waitFor = async (predicate: () => boolean, timeoutMs = 1_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error("timed out waiting for condition");
    }
    await sleep(20);
  }
};

const waitForDirtyFlush = async (system: RuntimeSkillSystem, timeoutMs = 1_000): Promise<RuntimeSkillRefreshResult> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = system.flushPendingChanges();
    if (result) {
      return result;
    }
    await sleep(20);
  }
  throw new Error("timed out waiting for watcher dirtiness");
};

const writeSkill = (rootWorkspacePath: string, input: { name: string; extraConfig?: { files?: string[] } }): string => {
  const skillDir = join(rootWorkspacePath, "skills", input.name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    [
      "---",
      `name: ${input.name}`,
      "description: local runtime skill",
      "---",
      "",
      `# ${input.name}`,
      "",
      "Keep this short.",
      "",
    ].join("\n"),
    "utf8",
  );
  if (input.extraConfig) {
    writeFileSync(join(skillDir, "ccski.config.json"), `${JSON.stringify(input.extraConfig, null, 2)}\n`, "utf8");
  }
  return skillDir;
};

const createGrantRecord = (workspaceRoot: string): WorkspaceGrantRecord => ({
  grantId: "grant-1",
  mountId: "mount-1",
  workspacePath: workspaceRoot,
  pattern: "/",
  ruleIndex: 0,
  mode: "rw",
  createdAt: new Date(0).toISOString(),
});

const createSystem = (input: {
  rootWorkspacePath: string;
  homeDir?: string;
  repoRoot?: string;
  watchDebounceMs?: number;
  watchPollMs?: number;
  onIdleFlush?: (result: RuntimeSkillRefreshResult) => void;
  listWorkspaceAuthorities?: () => Array<{ workspaceRoot: string; grants: WorkspaceGrantRecord[] }>;
}): RuntimeSkillSystem => {
  const system = new RuntimeSkillSystem({
    attentionSystem: new AttentionSystem(),
    owner: "tester",
    focusState: "background",
    rootWorkspacePath: input.rootWorkspacePath,
    homeDir: input.homeDir ?? input.rootWorkspacePath,
    repoRoot: input.repoRoot,
    watchDebounceMs: input.watchDebounceMs,
    watchPollMs: input.watchPollMs,
    unrefTimers: false,
    listWorkspaceAuthorities: input.listWorkspaceAuthorities,
    onIdleFlush: input.onIdleFlush,
  });
  systems.push(system);
  return system;
};

afterEach(() => {
  for (const system of systems.splice(0)) {
    system.dispose();
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: runtime skill watcher and config surface", () => {
  test("Scenario: Given a new runtime skill is upserted When refresh reminders are published Then an added skill reminder commit is emitted", () => {
    const rootWorkspacePath = createTempRoot();
    const system = createSystem({ rootWorkspacePath });

    system.refresh({ forceBootstrap: true, publishReminders: false });

    const result = system.upsert({
      name: "added-skill",
      content: [
        "---",
        "name: added-skill",
        "description: created during test",
        "---",
        "",
        "# added-skill",
        "",
        "Created.",
        "",
      ].join("\n"),
    });

    expect(result.created).toBeTrue();
    expect(result.changedSkills).toHaveLength(1);
    expect(result.changedSkills[0]?.kind).toBe("added");
    expect(result.changedSkills[0]?.name).toBe("added-skill");
    expect(result.reminderCommits).toHaveLength(1);
    expect(result.reminderCommits[0]?.summary).toContain("Added runtime skill added-skill");
  });

  test("Scenario: Given an existing runtime skill is upserted with new content When refresh reminders are published Then an updated skill reminder commit is emitted", () => {
    const rootWorkspacePath = createTempRoot();
    writeSkill(rootWorkspacePath, { name: "updated-skill" });
    const system = createSystem({ rootWorkspacePath });

    system.refresh({ forceBootstrap: true, publishReminders: false });

    const result = system.upsert({
      name: "updated-skill",
      content: [
        "---",
        "name: updated-skill",
        "description: updated during test",
        "---",
        "",
        "# updated-skill",
        "",
        "Updated body.",
        "",
      ].join("\n"),
    });

    expect(result.created).toBeFalse();
    expect(result.changedSkills).toHaveLength(1);
    expect(result.changedSkills[0]?.kind).toBe("updated");
    expect(result.changedSkills[0]?.name).toBe("updated-skill");
    expect(result.reminderCommits).toHaveLength(1);
    expect(result.reminderCommits[0]?.summary).toContain("Updated runtime skill updated-skill");
  });

  test("Scenario: Given an existing runtime skill is removed When refresh reminders are published Then a removed skill reminder commit is emitted", () => {
    const rootWorkspacePath = createTempRoot();
    writeSkill(rootWorkspacePath, { name: "removed-skill" });
    const system = createSystem({ rootWorkspacePath });

    system.refresh({ forceBootstrap: true, publishReminders: false });

    const result = system.remove({ name: "removed-skill" });

    expect(result.removed).toBeTrue();
    expect(result.changedSkills).toHaveLength(1);
    expect(result.changedSkills[0]?.kind).toBe("removed");
    expect(result.changedSkills[0]?.name).toBe("removed-skill");
    expect(result.reminderCommits).toHaveLength(1);
    expect(result.reminderCommits[0]?.summary).toContain("Removed runtime skill removed-skill");
  });

  test("Scenario: Given an unrelated database file in a skill directory When only that file changes Then no skill reminder is emitted", async () => {
    const rootWorkspacePath = createTempRoot();
    const skillDir = writeSkill(rootWorkspacePath, { name: "live-sync" });
    const system = createSystem({ rootWorkspacePath, watchDebounceMs: 50 });

    system.refresh({ forceBootstrap: true, publishReminders: false });

    writeFileSync(join(skillDir, "cache.sqlite"), "db-churn", "utf8");

    await sleep(120);
    const result = system.flushPendingChanges();
    expect(result?.changedSkills ?? []).toHaveLength(0);
    expect(result?.reminderCommits ?? []).toHaveLength(0);
  });

  test("Scenario: Given set-config changes the declared files When old and new targets change Then only the new targets trigger reminders", async () => {
    const rootWorkspacePath = createTempRoot();
    const skillDir = writeSkill(rootWorkspacePath, {
      name: "live-sync",
      extraConfig: { files: ["references/*.md"] },
    });
    mkdirSync(join(skillDir, "references"), { recursive: true });
    mkdirSync(join(skillDir, "notes"), { recursive: true });
    const referencePath = join(skillDir, "references", "guide.md");
    const notesPath = join(skillDir, "notes", "todo.md");
    writeFileSync(referencePath, "reference-v1\n", "utf8");
    writeFileSync(notesPath, "notes-v1\n", "utf8");

    const system = createSystem({ rootWorkspacePath, watchDebounceMs: 50 });
    system.refresh({ forceBootstrap: true, publishReminders: false });

    const configInfo = system.getConfig({ name: "live-sync" });
    expect(configInfo?.resolvedWatchTargets).toContain(referencePath);
    expect(configInfo?.resolvedWatchTargets).not.toContain(notesPath);

    const setConfigResult = system.setConfig({
      name: "live-sync",
      config: { files: ["notes/*.md"] },
    });
    expect(setConfigResult.changedSkills.some((change) => change.changedFiles.some((path) => path.endsWith("ccski.config.json")))).toBeTrue();

    writeFileSync(referencePath, "reference-v2\n", "utf8");
    await sleep(120);
    const oldTargetResult = system.flushPendingChanges();
    expect(oldTargetResult?.changedSkills ?? []).toHaveLength(0);

    writeFileSync(notesPath, "notes-v2\n", "utf8");
    const newTargetResult = await waitForDirtyFlush(system);
    expect(newTargetResult.changedSkills).toHaveLength(1);
    expect(newTargetResult.changedSkills[0]?.changedFiles).toContain(notesPath);
    expect(newTargetResult.reminderCommits).toHaveLength(1);
  });

  test("Scenario: Given a declared watched file changes while the runtime is idle When debounce expires Then idle flush publishes the aggregated reminder", async () => {
    const rootWorkspacePath = createTempRoot();
    const skillDir = writeSkill(rootWorkspacePath, {
      name: "live-sync",
      extraConfig: { files: ["references/**/*.md"] },
    });
    mkdirSync(join(skillDir, "references", "nested"), { recursive: true });
    const referencePath = join(skillDir, "references", "nested", "guide.md");
    writeFileSync(referencePath, "reference-v1\n", "utf8");

    const idleResults: RuntimeSkillRefreshResult[] = [];
    const system = createSystem({
      rootWorkspacePath,
      watchDebounceMs: 30,
      watchPollMs: 20,
      onIdleFlush: (result) => {
        idleResults.push(result);
      },
    });
    system.refresh({ forceBootstrap: true, publishReminders: false });

    writeFileSync(referencePath, "reference-v2\n", "utf8");
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    (globalThis as typeof globalThis & {
      setTimeout: typeof setTimeout;
      clearTimeout: typeof clearTimeout;
    }).setTimeout = (((callback: TimerHandler) => {
      if (typeof callback === "function") {
        callback();
      }
      return {
        unref() {
          return this;
        },
      } as ReturnType<typeof setTimeout>;
    }) as unknown) as typeof setTimeout;
    (globalThis as typeof globalThis & {
      clearTimeout: typeof clearTimeout;
    }).clearTimeout = (((_timer: ReturnType<typeof setTimeout>) => {}) as unknown) as typeof clearTimeout;

    try {
      (system as unknown as { markSkillDirty: (name: string) => void }).markSkillDirty("live-sync");
    } finally {
      (globalThis as typeof globalThis & {
        setTimeout: typeof setTimeout;
        clearTimeout: typeof clearTimeout;
      }).setTimeout = originalSetTimeout;
      (globalThis as typeof globalThis & {
        clearTimeout: typeof clearTimeout;
      }).clearTimeout = originalClearTimeout;
    }

    expect(idleResults).toHaveLength(1);
    expect(idleResults[0]?.changedSkills).toHaveLength(1);
    expect(idleResults[0]?.changedSkills[0]?.name).toBe("live-sync");
    expect(idleResults[0]?.changedSkills[0]?.changedFiles).toContain(referencePath);
  });

  test("Scenario: Given a built-in skill config write When workspace authority is absent or present Then set-config follows that authority boundary", () => {
    const repoRoot = createTempRoot();
    const runtimeSkillDir = join(repoRoot, "packages", "app-server", "skills", "runtime");
    mkdirSync(runtimeSkillDir, { recursive: true });
    writeFileSync(
      join(runtimeSkillDir, "SKILL.md"),
      [
        "---",
        "name: agenter-runtime",
        "description: runtime built-in",
        "---",
        "",
        "# agenter-runtime",
        "",
        "Repo live truth.",
        "",
      ].join("\n"),
      "utf8",
    );

    const rootWorkspacePath = createTempRoot();
    const noAuthority = createSystem({
      rootWorkspacePath,
      repoRoot,
    });
    noAuthority.refresh({ forceBootstrap: true, publishReminders: false });

    const builtinInfo = noAuthority.info("agenter-runtime", "builtin");
    expect(builtinInfo?.content).toContain("Repo live truth.");
    expect(() =>
      noAuthority.setConfig({
        name: "agenter-runtime",
        rootKind: "builtin",
        config: { files: ["references/*.md"] },
      }),
    ).toThrow(/read-only/u);

    const withAuthority = createSystem({
      rootWorkspacePath,
      repoRoot,
      listWorkspaceAuthorities: () => [
        {
          workspaceRoot: repoRoot,
          grants: [createGrantRecord(repoRoot)],
        },
      ],
    });
    const initial = withAuthority.refresh({ forceBootstrap: true, publishReminders: false });
    expect(initial.skills.some((skill) => skill.name === "agenter-runtime" && skill.rootKind === "builtin")).toBeTrue();

    const result = withAuthority.setConfig({
      name: "agenter-runtime",
      rootKind: "builtin",
      config: { files: ["references/*.md"] },
    });

    const configPath = join(runtimeSkillDir, "ccski.config.json");
    expect(readFileSync(configPath, "utf8")).toContain("references/*.md");
    expect(result.skill.rootKind).toBe("builtin");
    expect(result.changedSkills.some((change) => change.changedFiles.includes(configPath))).toBeTrue();
  });
});
