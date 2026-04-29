#!/usr/bin/env bun
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { AppKernel } from "../../../app-server/src";
import { GLOBAL_WORKSPACE_PATH } from "../../../app-server/src/workspace-target";

const [, , homeArg] = process.argv;

if (!homeArg) {
  throw new Error("usage: bun run ./tests/e2e/setup-skills-home.ts <home-dir>");
}

const homeDir = resolve(homeArg);
const playgroundRoot = resolve(homeDir, "..");
const workspacePath = join(playgroundRoot, "workspaces", "skills-lab");
const globalSessionRoot = join(homeDir, ".agenter", "sessions");
const archiveSessionRoot = join(homeDir, ".agenter", "archive", "sessions");
const workspacesPath = join(homeDir, ".agenter", "workspaces.yaml");

const writeSkill = (rootPath: string, name: string, files: Record<string, Buffer | string>): void => {
  const skillRoot = join(rootPath, name);
  mkdirSync(skillRoot, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(skillRoot, relativePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
};

const createPdf = (label: string): Buffer => {
  const escaped = label.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = `BT
/F1 18 Tf
24 96 Td
(${escaped}) Tj
ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 160] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, objectBody] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
};

rmSync(playgroundRoot, { recursive: true, force: true });
mkdirSync(workspacePath, { recursive: true });

const kernel = new AppKernel({
  globalSessionRoot,
  archiveSessionRoot,
  workspacesPath,
  homeDir,
});

await kernel.start();

await kernel.createGlobalAvatar({
  nickname: "architect",
  displayName: "Architect",
});
await kernel.forkWorkspaceAvatar({
  workspacePath,
  avatar: "architect",
});
kernel.toggleWorkspaceFavorite(workspacePath);

writeSkill(join(homeDir, ".agents", "skills"), "shared-handbook", {
  "SKILL.md": "---\nname: shared-handbook\ndescription: Shared handbook.\n---\n\nShared handbook body.\n",
  "references/usage.md": "# Usage\n\nUse the shared handbook.\n",
  "manual.pdf": createPdf("Shared handbook PDF"),
});

writeSkill(join(homeDir, ".agenter", "skills"), "global-playbook", {
  "SKILL.md": "---\nname: global-playbook\ndescription: Global playbook.\n---\n\nGlobal playbook body.\n",
});

const rootAvatarSkills = kernel.getRuntimeWorkspaceAssetRoots({
  workspacePath: GLOBAL_WORKSPACE_PATH,
  avatar: "architect",
}).privateRoots.skills;
const workspaceAvatarSkills = kernel.getRuntimeWorkspaceAssetRoots({
  workspacePath,
  avatar: "architect",
}).privateRoots.skills;

writeSkill(rootAvatarSkills, "root-skill", {
  "SKILL.md": "---\nname: root-skill\ndescription: Root workspace skill.\n---\n\nRoot workspace skill.\n",
});
writeSkill(workspaceAvatarSkills, "workspace-skill", {
  "SKILL.md": "---\nname: workspace-skill\ndescription: Workspace private skill.\n---\n\nWorkspace private skill.\n",
});

await kernel.stop();
