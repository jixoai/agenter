import { basename, join, relative, resolve } from "node:path";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

import type { MessageRecord } from "@agenter/message-system";

import { createRealTeamKernelHarness } from "../test-support/real-team-kernel-harness";
import { runRealProjectRoomCollaborationScenario } from "../test-support/real-project-room-collaboration-scenario";

const projectRoot = resolve(import.meta.dir, "../../..");
const outputRoot = join(projectRoot, ".chat", "generated", "real-project-room-export");
const reportPath = join(outputRoot, "story.md");
const workspaceExportPath = join(outputRoot, "workspace");

const EXCLUDED_COPY_NAMES = new Set([".agenter", ".git", "node_modules", ".turbo", "dist", "build", ".next"]);

const formatTimestamp = (value: number): string => new Date(value).toISOString();
const escapeFence = (value: string): string => value.replace(/```/g, "``\\`");

const buildTranscriptMarkdown = (messages: MessageRecord[]): string =>
  messages
    .map((message, index) =>
      [
        `### ${index + 1}. ${message.from} | ${message.senderActorId ?? "unknown"} | ${formatTimestamp(message.createdAt)}`,
        "",
        "```text",
        escapeFence(message.content),
        "```",
        ...(message.attachments?.length
          ? [
              "",
              "Attachments:",
              ...message.attachments.map((attachment) => `- ${attachment.name} (${attachment.mimeType}) ${attachment.assetId}`),
            ]
          : []),
      ].join("\n"),
    )
    .join("\n\n");

const copyWorkspaceWithoutSecrets = async (sourceDir: string, destinationDir: string): Promise<void> => {
  await cp(sourceDir, destinationDir, {
    recursive: true,
    filter: (source) => {
      const name = basename(source);
      return !EXCLUDED_COPY_NAMES.has(name);
    },
  });
};

const buildWorkspaceTree = async (rootDir: string, maxDepth = 4): Promise<string[]> => {
  const lines: string[] = [];
  const walk = async (currentDir: string, depth: number): Promise<void> => {
    if (depth > maxDepth) {
      return;
    }
    const entries = await readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = join(currentDir, entry.name);
      const relPath = relative(rootDir, absolutePath) || ".";
      lines.push(entry.isDirectory() ? `${relPath}/` : relPath);
      if (entry.isDirectory()) {
        await walk(absolutePath, depth + 1);
      }
    }
  };
  await walk(rootDir, 1);
  return lines;
};

const tryReadTextFile = async (path: string): Promise<string | null> => {
  try {
    const file = await stat(path);
    if (!file.isFile()) {
      return null;
    }
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
};

const main = async (): Promise<void> => {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const harness = await createRealTeamKernelHarness({
    logger: {
      log: (line) => {
        if (line.level === "error" || line.level === "warn") {
          console.error(`[${line.level}] ${line.message}`, line.meta ?? {});
        }
      },
    },
  });

  if (!harness) {
    throw new Error("Real AI config not found. Expected ~/.agenter/settings.json, demo/.env, or AGENTER_REAL_AI_* env.");
  }

  try {
    const result = await runRealProjectRoomCollaborationScenario(harness);
    const transcript = harness.listProjectRoomMessages(result.projectRoom, 160);
    await copyWorkspaceWithoutSecrets(harness.workspacePath, workspaceExportPath);
    const workspaceTree = await buildWorkspaceTree(workspaceExportPath);
    const indexHtml = await tryReadTextFile(join(workspaceExportPath, "index.html"));
    const serverJs = await tryReadTextFile(join(workspaceExportPath, "server.js"));
    const designSvg = await tryReadTextFile(join(workspaceExportPath, "design.svg"));

    const report = [
      "# Real Project Room Story",
      "",
      `- Generated At: ${new Date().toISOString()}`,
      `- Provider: ${harness.config.vendor}/${harness.config.apiStandard}`,
      `- Model: ${harness.config.model}`,
      `- Workspace Export: ${workspaceExportPath}`,
      `- Project Room: ${result.projectRoom.room.chatId}`,
      `- Delivery URL: ${result.deliveryUrl}`,
      `- Attached Asset: ${result.attachedAssetId}`,
      "",
      "## Transcript",
      "",
      buildTranscriptMarkdown(transcript),
      "",
      "## Delivery Check",
      "",
      "### HTML",
      "",
      "```html",
      escapeFence(result.htmlBody),
      "```",
      "",
      "### API",
      "",
      "```json",
      escapeFence(result.apiBody),
      "```",
      "",
      "## Workspace Tree",
      "",
      "```text",
      workspaceTree.join("\n"),
      "```",
    ];

    if (serverJs) {
      report.push("", "## server.js", "", "```js", escapeFence(serverJs), "```");
    }
    if (indexHtml) {
      report.push("", "## index.html", "", "```html", escapeFence(indexHtml), "```");
    }
    if (designSvg) {
      report.push("", "## design.svg", "", "```svg", escapeFence(designSvg), "```");
    }

    await writeFile(reportPath, `${report.join("\n")}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          reportPath,
          workspaceExportPath,
          deliveryUrl: result.deliveryUrl,
          projectRoomId: result.projectRoom.room.chatId,
        },
        null,
        2,
      ),
    );
  } finally {
    await harness.stop();
  }
};

await main();
