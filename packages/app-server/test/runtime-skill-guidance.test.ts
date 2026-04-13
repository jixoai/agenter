import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildRuntimeBuiltinSkillCatalog } from "../src/runtime-skill-catalog-builder";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

const readRepoFile = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), "utf8");
const listReferencePaths = (content: string): string[] =>
  [...content.matchAll(/`(references\/[^`]+\.md)`/gu)].map((match) => match[1]);

describe("Feature: runtime skill progressive disclosure guidance", () => {
  test("Scenario: Given built-in skill sources When a skill lists references Then each reference file stays beside its owning SKILL.md", () => {
    const catalog = buildRuntimeBuiltinSkillCatalog(repoRoot);

    for (const entry of catalog) {
      const skillPath = join(repoRoot, entry.sourcePath);
      const referencePaths = listReferencePaths(readFileSync(skillPath, "utf8"));
      for (const referencePath of referencePaths) {
        expect(existsSync(join(dirname(skillPath), referencePath))).toBeTrue();
      }
    }
  });

  test("Scenario: Given atomic built-in skills When their overviews are read Then exact-host and delivery-workaround copy stays out of the overview body", () => {
    const catalog = buildRuntimeBuiltinSkillCatalog(repoRoot);
    const message = catalog.find((entry) => entry.name === "agenter-message");
    const terminal = catalog.find((entry) => entry.name === "agenter-terminal");
    const attention = catalog.find((entry) => entry.name === "agenter-attention");

    expect(message?.template).toBeTruthy();
    expect(terminal?.template).toBeTruthy();
    expect(attention?.template).toBeTruthy();

    expect(message?.template).not.toContain("127.0.0.1");
    expect(message?.template).not.toContain("APP-URL:");
    expect(message?.template).not.toContain("curl");

    expect(terminal?.template).not.toContain("127.0.0.1");
    expect(terminal?.template).not.toContain("APP-URL:");
    expect(terminal?.template).not.toContain("localhost");

    expect(attention?.template).not.toContain("owning-room");
    expect(attention?.template).not.toContain("room reply");
  });

  test("Scenario: Given global runtime prompts When skill discovery guidance is rendered Then they teach real-path expansion one reference file at a time", () => {
    const enSystem = readRepoFile("packages/i18n-en/prompts/AGENTER_SYSTEM.mdx");
    const zhSystem = readRepoFile("packages/i18n-zh-Hans/prompts/AGENTER_SYSTEM.mdx");
    const enResponse = readRepoFile("packages/i18n-en/prompts/RESPONSE_CONTRACT.mdx");
    const zhResponse = readRepoFile("packages/i18n-zh-Hans/prompts/RESPONSE_CONTRACT.mdx");

    expect(enSystem).toContain("skills.list");
    expect(enSystem).toContain("ccski info <skill>");
    expect(enSystem).toContain("take one real command for that target first");
    expect(enSystem).toContain("real filesystem path");
    expect(enSystem).toContain("references/*.md");
    expect(enSystem).toContain("one file at a time");
    expect(enSystem).toContain("your next action must be that delivery step");
    expect(enSystem).toContain("Match the requester's language");
    expect(enSystem).toContain("exact room `chatId`");
    expect(enSystem).toContain("do not open any `SKILL.md`");
    expect(enSystem).not.toContain("message-system");
    expect(enSystem).not.toContain("terminal-system");
    expect(enSystem).not.toContain("terminal create /absolute/project/path");

    expect(zhSystem).toContain("skills.list");
    expect(zhSystem).toContain("ccski info <skill>");
    expect(zhSystem).toContain("先对那个目标执行一次真实命令");
    expect(zhSystem).toContain("真实 `SKILL.md` 文件路径");
    expect(zhSystem).toContain("references/*.md");
    expect(zhSystem).toContain("一次只读一个需要的文件");
    expect(zhSystem).toContain("你的下一步动作就必须是执行那次交付");
    expect(zhSystem).toContain("跟随请求方所使用的语言");
    expect(zhSystem).toContain("精确的房间 `chatId`");
    expect(zhSystem).toContain("不要先打开任何 `SKILL.md`");
    expect(zhSystem).not.toContain("message-system");
    expect(zhSystem).not.toContain("terminal-system");
    expect(zhSystem).not.toContain("terminal create /绝对项目路径");

    expect(enResponse).toContain("<command> --help");
    expect(enResponse).toContain("ccski info <skill>");
    expect(enResponse).toContain("prefer one direct command for that target before browsing skills");
    expect(enResponse).toContain("Default user-visible durable replies");
    expect(enResponse).toContain("do not open any `SKILL.md`");
    expect(enResponse).toContain("use that literal `chatId` directly");
    expect(enResponse).toContain("read only the specific reference files you need");
    expect(enResponse).toContain("the environment's durable delivery action");
    expect(enResponse).not.toContain("message CLI");
    expect(enResponse).not.toContain("terminal CLI");

    expect(zhResponse).toContain("<command> --help");
    expect(zhResponse).toContain("ccski info <skill>");
    expect(zhResponse).toContain("优先先对那个目标执行一次直接命令");
    expect(zhResponse).toContain("跟随请求方所使用的语言");
    expect(zhResponse).toContain("不要先打开任何 `SKILL.md`");
    expect(zhResponse).toContain("直接把这个字面量 `chatId` 用在 `message send`");
    expect(zhResponse).toContain("只读取你当前需要的那几个 reference 文件");
    expect(zhResponse).toContain("当前环境里的耐久交付动作");
    expect(zhResponse).not.toContain("message` CLI");
    expect(zhResponse).not.toContain("terminal` CLI");
  });

  test("Scenario: Given local delivery contracts When prompt and skill guidance is read Then planning URLs stay distinct from verified ready URLs", () => {
    const enSystem = readRepoFile("packages/i18n-en/prompts/AGENTER_SYSTEM.mdx");
    const zhSystem = readRepoFile("packages/i18n-zh-Hans/prompts/AGENTER_SYSTEM.mdx");
    const enAgenter = readRepoFile("packages/i18n-en/prompts/AGENTER.mdx");
    const zhAgenter = readRepoFile("packages/i18n-zh-Hans/prompts/AGENTER.mdx");
    const runtimeShell = readRepoFile("packages/app-server/skills/runtime/references/shell-surface.md");
    const collaboration = readRepoFile("packages/app-server/skills/collaboration/references/shared-room-protocols.md");
    const terminal = readRepoFile("packages/terminal-system/skills/terminal/SKILL.md");

    expect(enSystem).toContain("not yet a delivered URL");
    expect(enSystem).toContain("fresh HTTP check against the exact promised root URL or path succeeds right now");
    expect(enSystem).toContain("URL verification");
    expect(enSystem).toContain("must serve both a page and one or more API paths");
    expect(zhSystem).toContain("都还不算真正交付的 URL");
    expect(zhSystem).toContain("精确 root URL 或 path");
    expect(zhSystem).toContain("都不算 URL 验证");
    expect(zhSystem).toContain("既要提供页面，又要提供一个或多个 API path");

    expect(enAgenter).toContain("delivery contract, not a planning placeholder");
    expect(enAgenter).toContain("Keep the listener in `terminal`");
    expect(enAgenter).toContain("terminal read` snapshot");
    expect(enAgenter).toContain("the next step is to send the finished reply");
    expect(enAgenter).toContain("should not bind that final port");
    expect(enAgenter).toContain("must expose both the page and `/api/status`");
    expect(zhAgenter).toContain("交付 contract，而不是计划里的占位符");
    expect(zhAgenter).toContain("监听进程要放在 `terminal` 里");
    expect(zhAgenter).toContain("`terminal read` 的 snapshot");
    expect(zhAgenter).toContain("下一步就该把最终结果发回去");
    expect(zhAgenter).toContain("不要去绑定那个最终端口");
    expect(zhAgenter).toContain("同时要提供页面和 `/api/status`");

    expect(runtimeShell).toContain("still just a target until that exact root URL or required path actually responds");
    expect(runtimeShell).toContain("are not that HTTP proof");
    expect(runtimeShell).toContain("the next move is usually the required durable reply");
    expect(collaboration).toContain(
      "do not treat the kickoff target URL or an earlier planning mention as the final delivery reply",
    );
    expect(collaboration).toContain("do not bind that final port yourself");
    expect(collaboration).toContain("expects both `/` and `/api/status` on one shared URL");
    expect(terminal).toContain("verify the exact promised URL or path before you tell a room or user that it is ready");
    expect(terminal).toContain("do not prove the promised URL or API path actually responds");
  });

  test("Scenario: Given external-fact guidance When prompt and runtime shell docs are read Then persona law and shell capability stay separate and shell-first", () => {
    const enAgenter = readRepoFile("packages/i18n-en/prompts/AGENTER.mdx");
    const zhAgenter = readRepoFile("packages/i18n-zh-Hans/prompts/AGENTER.mdx");
    const runtimeSkill = readRepoFile("packages/app-server/skills/runtime/SKILL.md");
    const runtimeShell = readRepoFile("packages/app-server/skills/runtime/references/shell-surface.md");

    expect(enAgenter).toContain("seasoned Linux engineer");
    expect(enAgenter).toContain("current or external facts");
    expect(enAgenter).toContain("do not guess from memory");
    expect(enAgenter).not.toContain("curl wttr.in");
    expect(enAgenter).not.toContain("weather command");

    expect(zhAgenter).toContain("老练的 Linux 工程师");
    expect(zhAgenter).toContain("当前事实");
    expect(zhAgenter).toContain("不要凭记忆猜答案");
    expect(zhAgenter).not.toContain("curl wttr.in");
    expect(zhAgenter).not.toContain("固定脚本");

    expect(runtimeSkill).toContain("outbound network access");
    expect(runtimeSkill).toContain("objective verification of current or external facts");
    expect(runtimeSkill).not.toContain("wttr.in");
    expect(runtimeSkill).not.toContain("npm view");

    expect(runtimeShell).toContain("outbound-network verification of current or external facts");
    expect(runtimeShell).toContain("prefer one-shot shell verification over guessing from memory");
    expect(runtimeShell).not.toContain("wttr.in");
    expect(runtimeShell).not.toContain("curl https://");
  });
});
