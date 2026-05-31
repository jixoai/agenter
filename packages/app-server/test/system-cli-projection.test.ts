import { describe, expect, test } from "bun:test";

import {
  AVATAR_HOME_ENV,
  SKILLS_HOME_ENV,
  deriveEnvSkillsHome,
  serializeEnvAvatarHome,
  serializeEnvSkillsHome,
} from "../src/workspace-system";
import {
  WorkspaceSystemCliProjectionController,
  projectWorkspaceSystemClis,
} from "../src/system-cli-projection";

describe("Feature: workspace system CLI capability projection", () => {
  test("Scenario: Given empty AVATAR_HOME When workspace CLIs are projected Then note is withheld but skill keeps PWD-local discovery", () => {
    const projections = projectWorkspaceSystemClis({
      mountId: "mount-a",
      runtimeId: "runtime-a",
      runtimeWorkspaceId: 1,
      workspacePath: "/repo",
      defaultCwd: "/repo",
      env: {},
    });

    expect(projections.map((projection) => projection.command)).toEqual(["skill"]);
    expect(projections[0]).toMatchObject({
      command: "skill",
      systemId: "skillSystem",
      capability: "workspace-pwd",
      sourceEnv: SKILLS_HOME_ENV,
      sourcePaths: deriveEnvSkillsHome({ pwd: "/repo", avatarHome: [], platform: "darwin" }),
    });
  });

  test("Scenario: Given non-empty AVATAR_HOME When workspace CLIs are projected Then note and skill both report env source paths", () => {
    const skillsHome = deriveEnvSkillsHome({
      pwd: "/repo",
      avatarHome: ["/avatar/user"],
      platform: "darwin",
    });
    const projections = projectWorkspaceSystemClis({
      mountId: "mount-a",
      runtimeId: "runtime-a",
      runtimeWorkspaceId: 1,
      workspacePath: "/repo",
      workspaceAlias: "repo",
      defaultCwd: "/repo",
      env: {
        [AVATAR_HOME_ENV]: serializeEnvAvatarHome(["/avatar/user"], { platform: "darwin" }),
        [SKILLS_HOME_ENV]: serializeEnvSkillsHome(skillsHome, { platform: "darwin" }),
      },
    });

    expect(projections.map((projection) => projection.command)).toEqual(["skill", "note"]);
    expect(projections[0]).toMatchObject({
      sourceEnv: SKILLS_HOME_ENV,
      sourcePaths: skillsHome,
      workspaceAlias: "repo",
    });
    expect(projections[1]).toMatchObject({
      command: "note",
      systemId: "noteSystem",
      capability: "avatar-private",
      sourceEnv: AVATAR_HOME_ENV,
      sourcePaths: ["/avatar/user"],
    });
  });

  test("Scenario: Given workspace lifecycle updates When projections are recomputed Then detached mounts stop exposing stale CLIs", () => {
    const controller = new WorkspaceSystemCliProjectionController();
    const created = controller.handleWorkspaceCreated({
      mountId: "mount-a",
      runtimeId: "runtime-a",
      runtimeWorkspaceId: 1,
      workspacePath: "/repo",
      defaultCwd: "/repo",
      env: {},
    });

    expect(created.map((projection) => projection.command)).toEqual(["skill"]);

    const updated = controller.handleWorkspaceUpdated({
      mountId: "mount-a",
      runtimeId: "runtime-a",
      runtimeWorkspaceId: 1,
      workspacePath: "/repo",
      defaultCwd: "/repo",
      env: {
        [AVATAR_HOME_ENV]: serializeEnvAvatarHome(["/avatar/user"], { platform: "darwin" }),
      },
    });

    expect(updated.map((projection) => projection.command)).toEqual(["skill", "note"]);
    expect(controller.list().map((projection) => projection.command)).toEqual(["skill", "note"]);

    controller.handleWorkspaceDetached({ mountId: "mount-a" });
    expect(controller.list()).toEqual([]);
  });
});
