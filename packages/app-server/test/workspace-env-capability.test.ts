import { describe, expect, test } from "bun:test";

import {
  deriveEnvSkillsHome,
  deriveMultiWorkspaceSkillsHome,
  parseEnvAvatarHome,
  serializeEnvAvatarHome,
  serializeEnvSkillsHome,
} from "../src/workspace-system";

describe("Feature: workspace env capability projection", () => {
  test("Scenario: Given empty AVATAR_HOME When parsed Then no private capability paths are returned", () => {
    expect(parseEnvAvatarHome()).toEqual([]);
    expect(parseEnvAvatarHome("")).toEqual([]);
    expect(parseEnvAvatarHome(" ; ; ", { platform: "darwin" })).toEqual([]);
  });

  test("Scenario: Given semicolon-delimited absolute AVATAR_HOME When parsed Then entries keep last-wins order", () => {
    expect(parseEnvAvatarHome("/avatar/a;/avatar/b;/avatar/a", { platform: "darwin" })).toEqual([
      "/avatar/b",
      "/avatar/a",
    ]);
  });

  test("Scenario: Given non-Windows colon-delimited AVATAR_HOME When parsed Then canonical serialization writes semicolon", () => {
    const parsed = parseEnvAvatarHome("/avatar/base:/avatar/user", { platform: "darwin" });

    expect(parsed).toEqual(["/avatar/base", "/avatar/user"]);
    expect(serializeEnvAvatarHome(parsed, { platform: "darwin" })).toBe("/avatar/base;/avatar/user");
  });

  test("Scenario: Given relative AVATAR_HOME When parsed or serialized Then the path is rejected", () => {
    expect(() => parseEnvAvatarHome("/avatar/base;relative/avatar", { platform: "darwin" })).toThrow(
      "AVATAR_HOME entry must be absolute: relative/avatar",
    );
    expect(() => serializeEnvAvatarHome(["/avatar/base", "relative/avatar"], { platform: "darwin" })).toThrow(
      "AVATAR_HOME entry must be absolute: relative/avatar",
    );
  });

  test("Scenario: Given one workspace group When SKILLS_HOME is derived Then PWD roots appear before Avatar-home roots", () => {
    expect(
      deriveEnvSkillsHome({
        pwd: "/repo",
        avatarHome: ["/avatar/base", "/avatar/user"],
        platform: "darwin",
      }),
    ).toEqual([
      "/repo/skills",
      "/repo/.codex/skills",
      "/repo/.claude/skills",
      "/repo/.agents/skills",
      "/avatar/base/skills",
      "/avatar/base/.codex/skills",
      "/avatar/base/.claude/skills",
      "/avatar/base/.agents/skills",
      "/avatar/user/skills",
      "/avatar/user/.codex/skills",
      "/avatar/user/.claude/skills",
      "/avatar/user/.agents/skills",
    ]);
  });

  test("Scenario: Given multiple workspace groups When SKILLS_HOME is derived Then groups preserve pwd then avatar order", () => {
    const derived = deriveMultiWorkspaceSkillsHome({
      workspaceGroups: [
        { pwd: "/repo-a", avatarHome: ["/avatar/a"] },
        { pwd: "/repo-b", avatarHome: ["/avatar/b"] },
      ],
      platform: "darwin",
    });

    expect(derived.filter((path) => path.endsWith("/skills") && !path.includes("/."))).toEqual([
      "/repo-a/skills",
      "/avatar/a/skills",
      "/repo-b/skills",
      "/avatar/b/skills",
    ]);
  });

  test("Scenario: Given empty AVATAR_HOME and PWD skills When SKILLS_HOME is derived Then only PWD roots are included", () => {
    expect(
      deriveEnvSkillsHome({
        pwd: "/repo",
        avatarHome: [],
        platform: "darwin",
      }),
    ).toEqual(["/repo/skills", "/repo/.codex/skills", "/repo/.claude/skills", "/repo/.agents/skills"]);
  });

  test("Scenario: Given SKILLS_HOME paths When serialized Then the canonical delimiter is semicolon", () => {
    expect(serializeEnvSkillsHome(["/repo/skills", "/avatar/skills"], { platform: "darwin" })).toBe(
      "/repo/skills;/avatar/skills",
    );
  });
});
