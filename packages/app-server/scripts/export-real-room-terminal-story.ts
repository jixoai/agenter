import { basename, join, relative, resolve } from "node:path";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

import type { MessageControlPlane, MessageControlPlaneEntry, MessageRecord } from "@agenter/message-system";

import type { ChatMessage } from "../src";
import { createRealKernelHarness } from "../test-support/real-kernel-harness";
import { runRealRoomTerminalDeliveryScenario } from "../test-support/real-room-terminal-delivery-scenario";

const projectRoot = resolve(import.meta.dir, "../../..");
const outputRoot = join(projectRoot, ".chat", "generated", "real-room-terminal-export");
const reportPath = join(outputRoot, "story.md");
const workspaceExportPath = join(outputRoot, "workspace");

const EXCLUDED_COPY_NAMES = new Set([".agenter", ".git", "node_modules", ".turbo", "dist", "build", ".next"]);

const getMessageControlPlane = (harness: NonNullable<Awaited<ReturnType<typeof createRealKernelHarness>>>): MessageControlPlane =>
  Reflect.get(harness.kernel, "messageControlPlane") as MessageControlPlane;

const toChatMessage = (
  harness: NonNullable<Awaited<ReturnType<typeof createRealKernelHarness>>>,
  message: MessageRecord,
): ChatMessage => ({
  id: message.messageId,
  chatId: message.chatId,
  role: message.from === harness.session.avatar ? "assistant" : "user",
  content: message.content,
  timestamp: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
});

const listRoomTruthMessages = (
  harness: NonNullable<Awaited<ReturnType<typeof createRealKernelHarness>>>,
): Array<ChatMessage & { title: string }> => {
  const channels = harness.kernel.listMessageChannels(harness.session.id);
  const channelTitleMap = new Map<string, string>(channels.map((channel) => [channel.chatId, channel.title || channel.chatId]));
  return channels
    .flatMap((channel) =>
      getMessageControlPlane(harness)
        .snapshot(channel.chatId, 100)
        .items.map((item) => ({
          ...toChatMessage(harness, item),
          title: channelTitleMap.get(channel.chatId) ?? channel.chatId,
        })),
    )
    .sort((left, right) => left.timestamp - right.timestamp);
};

const formatTimestamp = (value: number): string => new Date(value).toISOString();

const escapeFence = (value: string): string => value.replace(/```/g, "``\\`");

const buildTranscriptMarkdown = (
  messages: Array<ChatMessage & { title: string }>,
): string =>
  messages
    .map((message, index) =>
      [
        `### ${index + 1}. ${message.role} | ${message.title} | ${formatTimestamp(message.timestamp)}`,
        "",
        "```text",
        escapeFence(message.content),
        "```",
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

  const harness = await createRealKernelHarness({
    sessionName: "real-room-terminal-export",
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
    const result = await runRealRoomTerminalDeliveryScenario(harness);
    const transcript = listRoomTruthMessages(harness);
    await copyWorkspaceWithoutSecrets(harness.workspacePath, workspaceExportPath);
    const workspaceTree = await buildWorkspaceTree(workspaceExportPath);
    const indexHtml = await tryReadTextFile(join(workspaceExportPath, "index.html"));
    const packageJson = await tryReadTextFile(join(workspaceExportPath, "package.json"));

    const report = [
      "# Real Room Terminal Story",
      "",
      `- Generated At: ${new Date().toISOString()}`,
      `- Provider: ${harness.config.vendor}/${harness.config.apiStandard}`,
      `- Model: ${harness.config.model}`,
      `- Workspace Export: ${workspaceExportPath}`,
      `- Delivery URL: ${result.deliveryUrl}`,
      "",
      "## Transcript",
      "",
      buildTranscriptMarkdown(transcript),
      "",
      "## Delivery Check",
      "",
      "### Initial Body",
      "",
      "```html",
      escapeFence(result.initialBody),
      "```",
      "",
      "### Updated Body",
      "",
      "```html",
      escapeFence(result.updatedBody),
      "```",
      "",
      "## Workspace Tree",
      "",
      "```text",
      workspaceTree.join("\n"),
      "```",
    ];

    if (packageJson) {
      report.push(
        "",
        "## package.json",
        "",
        "```json",
        escapeFence(packageJson),
        "```",
      );
    }

    if (indexHtml) {
      report.push(
        "",
        "## index.html",
        "",
        "```html",
        escapeFence(indexHtml),
        "```",
      );
    }

    await writeFile(reportPath, `${report.join("\n")}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          reportPath,
          workspaceExportPath,
          deliveryUrl: result.deliveryUrl,
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
