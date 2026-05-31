import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel } from "../src";
import { GLOBAL_WORKSPACE_PATH } from "../src/workspace-target";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-skill-browser-"));
  tempDirs.push(dir);
  return dir;
};

const writeSkill = (rootPath: string, name: string, files: Record<string, string | Buffer>): void => {
  const skillRoot = join(rootPath, name);
  mkdirSync(skillRoot, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(skillRoot, relativePath);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, content);
  }
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: read-only skill browser surface", () => {
  test("Scenario: Given shared skill files include references and pdf media When listing the tree and previews Then the browser surface preserves objective files and preview kinds", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const sharedSkillsRoot = join(homeDir, ".agents", "skills");
    writeSkill(sharedSkillsRoot, "shared-handbook", {
      "SKILL.md": "---\nname: shared-handbook\ndescription: Shared handbook.\n---\n\nShared handbook body.\n",
      "references/usage.md": "# Usage\n\nUse the shared handbook.\n",
      "manual.pdf": "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
      "cover.bin": Buffer.from([0, 1, 2, 3, 255]),
    });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();

    const builtins = kernel.listSkillBrowserCatalog({ rootKind: "builtin" });
    expect(builtins.some((entry) => entry.name === "agenter-runtime")).toBeTrue();

    const sharedCatalog = kernel.listSkillBrowserCatalog({ rootKind: "skills-home" });
    expect(sharedCatalog.map((entry) => entry.name)).toEqual(["shared-handbook"]);
    expect(sharedCatalog[0]).toMatchObject({
      sourceEnv: "SKILLS_HOME",
      sourcePath: sharedSkillsRoot,
    });

    const sharedTree = kernel.listSkillBrowserCatalogTree({
      rootKind: "skills-home",
      name: "shared-handbook",
      path: "/",
    });
    expect(sharedTree.items.map((entry) => [entry.path, entry.previewKind])).toEqual([
      ["/references", "directory"],
      ["/cover.bin", "binary"],
      ["/manual.pdf", "pdf"],
      ["/SKILL.md", "text"],
    ]);

    const referencesTree = kernel.listSkillBrowserCatalogTree({
      rootKind: "skills-home",
      name: "shared-handbook",
      path: "/references",
    });
    expect(referencesTree.items.map((entry) => entry.path)).toEqual(["/references/usage.md"]);

    const textPreview = kernel.readSkillBrowserCatalogPreview({
      rootKind: "skills-home",
      name: "shared-handbook",
      path: "/SKILL.md",
    });
    expect(textPreview.previewKind).toBe("text");
    expect(textPreview.textContent).toContain("Shared handbook body.");

    const pdfPreview = kernel.readSkillBrowserCatalogPreview({
      rootKind: "skills-home",
      name: "shared-handbook",
      path: "/manual.pdf",
    });
    expect(pdfPreview.previewKind).toBe("pdf");
    expect(pdfPreview.mimeType).toBe("application/pdf");
    expect(pdfPreview.mediaDataUrl?.startsWith("data:application/pdf;base64,")).toBeTrue();

    const binaryPreview = kernel.readSkillBrowserCatalogPreview({
      rootKind: "skills-home",
      name: "shared-handbook",
      path: "/cover.bin",
    });
    expect(binaryPreview.previewKind).toBe("binary");
    expect(binaryPreview.mediaDataUrl).toBeNull();
    expect(binaryPreview.note).toContain("Binary preview");

    await kernel.stop();
  });

  test("Scenario: Given avatar skills exist in root and one workspace only When avatar catalog is listed Then root workspace stays first and global skills are not duplicated into other groups", async () => {
    const root = makeTempDir();
    const homeDir = join(root, "home");
    const workspaceA = join(root, "workspace-a");
    const workspaceB = join(root, "workspace-b");
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir,
    });
    await kernel.start();

    await kernel.createGlobalAvatar({
      nickname: "architect",
      displayName: "Architect",
    });
    await kernel.forkWorkspaceAvatar({
      workspacePath: workspaceA,
      avatar: "architect",
    });
    kernel.toggleWorkspaceFavorite(workspaceB);

    const rootSkillRoot = kernel.getRuntimeWorkspaceAssetRoots({
      workspacePath: GLOBAL_WORKSPACE_PATH,
      avatar: "architect",
    }).privateRoots.skills;
    const workspaceSkillRoot = kernel.getRuntimeWorkspaceAssetRoots({
      workspacePath: workspaceA,
      avatar: "architect",
    }).privateRoots.skills;

    writeSkill(rootSkillRoot, "root-skill", {
      "SKILL.md": "---\nname: root-skill\ndescription: Root workspace skill.\n---\n",
    });
    writeSkill(workspaceSkillRoot, "workspace-skill", {
      "SKILL.md": "---\nname: workspace-skill\ndescription: Workspace private skill.\n---\n",
    });

    const avatarCatalog = await kernel.listSkillBrowserAvatarCatalog();
    const architect = avatarCatalog.find((entry) => entry.nickname === "architect");
    expect(architect).toBeTruthy();
    expect(architect?.groups.map((group) => group.workspacePath)).toEqual([GLOBAL_WORKSPACE_PATH, workspaceA]);
    expect(architect?.groups[0]?.workspaceLabel).toBe("Root workspace");
    expect(architect?.groups[0]?.skills.map((skill) => skill.name)).toEqual(["root-skill"]);
    expect(architect?.groups[0]?.skills[0]?.sourceEnv).toBe("AVATAR_HOME");
    expect(architect?.groups[1]?.skills.map((skill) => skill.name)).toEqual(["workspace-skill"]);
    expect(architect?.groups[1]?.skills[0]?.sourcePath).toBe(workspaceSkillRoot);
    expect(architect?.groups.some((group) => group.workspacePath === workspaceB)).toBeFalse();

    const avatarTree = kernel.listSkillBrowserAvatarTree({
      avatarNickname: "architect",
      workspacePath: workspaceA,
      name: "workspace-skill",
      path: "/",
    });
    expect(avatarTree.items.map((entry) => entry.path)).toEqual(["/SKILL.md"]);

    const avatarPreview = kernel.readSkillBrowserAvatarPreview({
      avatarNickname: "architect",
      workspacePath: workspaceA,
      name: "workspace-skill",
      path: "/SKILL.md",
    });
    expect(avatarPreview.previewKind).toBe("text");
    expect(avatarPreview.textContent).toContain("workspace-skill");

    await kernel.stop();
  });
});
