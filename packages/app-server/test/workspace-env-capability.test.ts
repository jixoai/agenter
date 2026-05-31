import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel } from "../src";
import {
  AVATAR_HOME_ENV,
  deriveEnvSkillsHome,
  deriveMultiWorkspaceSkillsHome,
  parseEnvAvatarHome,
  serializeEnvAvatarHome,
  serializeEnvSkillsHome,
  WorkspaceSystemStore,
} from "../src/workspace-system";

const tempDirs: string[] = [];

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-workspace-env-"));
  tempDirs.push(root);
  return root;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

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

  test("Scenario: Given a workspace instance with inherited Avatar home When getAvatarHome runs Then normalized paths are returned", () => {
    const root = createTempRoot();
    const store = new WorkspaceSystemStore({ filePath: join(root, "workspace-system.json") });
    const mount = store.attachRuntime({
      runtimeId: "runtime-a",
      workspacePath: "/repo",
      env: {
        [AVATAR_HOME_ENV]: "/avatar/base;/avatar/user",
      },
    });

    expect(
      store.getRuntimeWorkspaceAvatarHome({
        runtimeId: "runtime-a",
        runtimeWorkspaceId: mount.runtimeWorkspaceId,
      }),
    ).toEqual(["/avatar/base", "/avatar/user"]);
  });

  test("Scenario: Given setAvatarHome receives duplicate paths When env is persisted Then canonical last-wins serialization is stored", () => {
    const root = createTempRoot();
    const store = new WorkspaceSystemStore({ filePath: join(root, "workspace-system.json") });
    const mount = store.attachRuntime({
      runtimeId: "runtime-a",
      workspacePath: "/repo",
    });

    const updated = store.setRuntimeWorkspaceAvatarHome({
      runtimeId: "runtime-a",
      runtimeWorkspaceId: mount.runtimeWorkspaceId,
      paths: ["/avatar/a", "/avatar/b", "/avatar/a"],
    });

    expect(updated?.env[AVATAR_HOME_ENV]).toBe("/avatar/b;/avatar/a");
    expect(store.snapshotState().mounts[0]?.env[AVATAR_HOME_ENV]).toBe("/avatar/b;/avatar/a");
  });

  test("Scenario: Given setAvatarHome receives a relative path When rejected Then previous env remains unchanged", () => {
    const root = createTempRoot();
    const store = new WorkspaceSystemStore({ filePath: join(root, "workspace-system.json") });
    const mount = store.attachRuntime({
      runtimeId: "runtime-a",
      workspacePath: "/repo",
      env: {
        [AVATAR_HOME_ENV]: "/avatar/current",
      },
    });

    expect(() =>
      store.setRuntimeWorkspaceAvatarHome({
        runtimeId: "runtime-a",
        runtimeWorkspaceId: mount.runtimeWorkspaceId,
        paths: ["/avatar/current", "relative/avatar"],
      }),
    ).toThrow("AVATAR_HOME entry must be absolute: relative/avatar");
    expect(store.snapshotState().mounts[0]?.env[AVATAR_HOME_ENV]).toBe("/avatar/current");
  });

  test("Scenario: Given a command env overlay includes AVATAR_HOME When capabilities are inspected Then it is not durable authority", () => {
    const root = createTempRoot();
    const store = new WorkspaceSystemStore({ filePath: join(root, "workspace-system.json") });
    const mount = store.attachRuntime({
      runtimeId: "runtime-a",
      workspacePath: "/repo",
      env: {},
    });
    const commandOverlay = {
      [AVATAR_HOME_ENV]: "/avatar/private",
    };

    expect(commandOverlay[AVATAR_HOME_ENV]).toBe("/avatar/private");
    expect(
      store.getRuntimeWorkspaceAvatarHome({
        runtimeId: "runtime-a",
        runtimeWorkspaceId: mount.runtimeWorkspaceId,
      }),
    ).toEqual([]);
    expect(store.snapshotState().mounts[0]?.env[AVATAR_HOME_ENV]).toBeUndefined();
  });

  test("Scenario: Given a project workspace is granted When mounted Then it inherits the runtime Avatar home env", async () => {
    const root = createTempRoot();
    const workspace = join(root, "repo");
    mkdirSync(workspace, { recursive: true });
    const kernel = new AppKernel({
      homeDir: join(root, "home"),
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();
    try {
      const session = await kernel.createSession({
        cwd: workspace,
        avatar: "architect",
        autoStart: false,
      });

      kernel.grantRuntimeWorkspace({
        runtimeId: session.id,
        workspacePath: workspace,
        grants: [{ pattern: "/", mode: "rw" }],
      });

      const mounts = kernel.listRuntimeWorkspaceMounts(session.id);
      const avatarRoot = mounts.find((mount) => mount.kind === "avatar-root");
      const projectMount = mounts.find((mount) => mount.workspacePath === workspace);
      expect(avatarRoot?.env[AVATAR_HOME_ENV]).toBe(avatarRoot?.workspacePath);
      expect(projectMount?.env[AVATAR_HOME_ENV]).toBe(avatarRoot?.workspacePath);
    } finally {
      await kernel.stop();
    }
  });
});
