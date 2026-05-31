import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { diffRuntimeSkillSnapshots } from "../src/runtime-skill-diff";
import { buildRuntimeSkillTruthSnapshot, type RuntimeSkillDiffState } from "../src/runtime-skill-truth";
import {
  listRuntimeSkills,
  upsertRuntimeSkillFile,
  type RuntimeSkillRecord,
  type RuntimeSkillRootKind,
} from "../src/runtime-skills";

const tempDirs: string[] = [];

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-runtime-skill-atoms-"));
  tempDirs.push(root);
  return root;
};

const writeSkillRecord = (root: string, name: string): RuntimeSkillRecord => {
  const skillDir = join(root, "skills", name);
  mkdirSync(join(skillDir, "references"), { recursive: true });
  const skillPath = join(skillDir, "SKILL.md");
  const configPath = join(skillDir, "ccski.config.json");
  writeFileSync(
    skillPath,
    ["---", `name: ${name}`, "description: atom truth", "---", "", `# ${name}`, ""].join("\n"),
    "utf8",
  );
  writeFileSync(configPath, `${JSON.stringify({ files: ["references/*.md"] }, null, 2)}\n`, "utf8");
  writeFileSync(join(skillDir, "references", "b.md"), "b\n", "utf8");
  writeFileSync(join(skillDir, "references", "a.md"), "a\n", "utf8");
  return {
    name,
    summary: "atom truth",
    path: skillPath,
    skillDir,
    configPath,
    configExists: existsSync(configPath),
    root: join(root, "skills"),
    rootKind: "avatar",
    writable: true,
  };
};

const writeSkillInSkillRoot = (skillRoot: string, name: string, description: string): string => {
  const skillDir = join(skillRoot, name);
  mkdirSync(skillDir, { recursive: true });
  const skillPath = join(skillDir, "SKILL.md");
  writeFileSync(
    skillPath,
    ["---", `name: ${name}`, `description: ${description}`, "---", "", `# ${name}`, ""].join("\n"),
    "utf8",
  );
  return skillPath;
};

const diffState = (input: {
  name: string;
  rootKind: RuntimeSkillRootKind;
  skillDir: string;
  path: string;
  summary?: string;
  configExists?: boolean;
  observedFiles?: Map<string, string>;
}): RuntimeSkillDiffState => ({
  skill: {
    name: input.name,
    rootKind: input.rootKind,
    skillDir: input.skillDir,
    path: input.path,
    summary: input.summary ?? "summary",
    configExists: input.configExists ?? false,
  },
  observedFiles: input.observedFiles ?? new Map([[input.path, "fingerprint"]]),
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: runtime skill atom boundaries", () => {
  test("Scenario: Given a skill declares related files When the truth snapshot is built Then observed file fingerprints use stable sorted paths", () => {
    const root = createTempRoot();
    const record = writeSkillRecord(root, "atom-truth");

    const snapshot = buildRuntimeSkillTruthSnapshot([record]);
    const observed = [...(snapshot.get("atom-truth")?.observedFiles.keys() ?? [])];
    const relativeObserved = observed.map((path) => relative(record.skillDir, path).replace(/\\/gu, "/"));

    expect(observed).toEqual([...observed].sort((left, right) => left.localeCompare(right)));
    expect(relativeObserved).toEqual(
      ["SKILL.md", "ccski.config.json", "references/a.md", "references/b.md"].sort((left, right) =>
        left.localeCompare(right),
      ),
    );
  });

  test("Scenario: Given the same skill name moves between roots When snapshots are diffed Then the override is one updated skill", () => {
    const before = new Map<string, RuntimeSkillDiffState>([
      [
        "terminal",
        diffState({
          name: "terminal",
          rootKind: "builtin",
          skillDir: "/repo/packages/app-server/skills/terminal",
          path: "/repo/packages/app-server/skills/terminal/SKILL.md",
          observedFiles: new Map([["/repo/packages/app-server/skills/terminal/SKILL.md", "builtin-v1"]]),
        }),
      ],
    ]);
    const next = new Map<string, RuntimeSkillDiffState>([
      [
        "terminal",
        diffState({
          name: "terminal",
          rootKind: "avatar",
          skillDir: "/workspace/skills/terminal",
          path: "/workspace/skills/terminal/SKILL.md",
          observedFiles: new Map([["/workspace/skills/terminal/SKILL.md", "avatar-v1"]]),
        }),
      ],
    ]);

    const changes = diffRuntimeSkillSnapshots(before, next);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      name: "terminal",
      kind: "updated",
      rootKind: "avatar",
    });
    expect(changes[0]?.changedFiles).toEqual([
      "/repo/packages/app-server/skills/terminal/SKILL.md",
      "/workspace/skills/terminal/SKILL.md",
    ]);
  });

  test("Scenario: Given generic and dot-agent skills with the same name When merged Then the later dot-agent source wins", () => {
    const root = createTempRoot();
    const genericRoot = join(root, "skills");
    const codexRoot = join(root, ".codex", "skills");
    writeSkillInSkillRoot(genericRoot, "build", "generic source");
    const codexSkillPath = writeSkillInSkillRoot(codexRoot, "build", "codex source");

    const skills = listRuntimeSkills({
      repoRoot: root,
      skillHomeRoots: [genericRoot, codexRoot],
    });
    const skill = skills.find((entry) => entry.name === "build");

    expect(skill).toMatchObject({
      name: "build",
      summary: "codex source",
      root: codexRoot,
      rootKind: "avatar",
    });
    expect(skill?.path).toBe(codexSkillPath);
  });

  test("Scenario: Given SKILLS_HOME roots When runtime skills are listed Then rootWorkspacePath is not required as avatar authority", () => {
    const root = createTempRoot();
    const skillRoot = join(root, "skills");
    writeSkillInSkillRoot(skillRoot, "env-skill", "from skills home");

    const skills = listRuntimeSkills({
      repoRoot: root,
      skillHomeRoots: [skillRoot],
    });

    expect(skills.some((entry) => entry.name === "env-skill" && entry.root === skillRoot)).toBeTrue();
  });

  test("Scenario: Given multiple SKILLS_HOME roots When a skill is upserted Then the last source is the writable target", () => {
    const root = createTempRoot();
    const firstRoot = join(root, "skills");
    const lastRoot = join(root, ".codex", "skills");

    const skill = upsertRuntimeSkillFile({
      repoRoot: root,
      skillHomeRoots: [firstRoot, lastRoot],
      name: "created-skill",
      content: [
        "---",
        "name: created-skill",
        "description: created in env source",
        "---",
        "",
        "# created-skill",
        "",
      ].join("\n"),
    });

    expect(skill.root).toBe(lastRoot);
    expect(skill.path).toBe(join(lastRoot, "created-skill", "SKILL.md"));
    expect(existsSync(join(firstRoot, "created-skill", "SKILL.md"))).toBeFalse();
  });
});
