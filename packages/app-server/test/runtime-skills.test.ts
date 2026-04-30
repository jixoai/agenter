import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRuntimeSkillsList,
  listRuntimeSkillMountRoots,
  listRuntimeSkills,
  readRuntimeSkillContent,
} from "../src/runtime-skills";

const tempDirs: string[] = [];
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-runtime-skills-"));
  tempDirs.push(root);
  return root;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: runtime built-in skills", () => {
  test("Scenario: Given a runtime root workspace When built-in skills are listed Then concise overviews and reference expansion stay discoverable without workspace writes", () => {
    const rootWorkspacePath = createTempRoot();
    const skills = listRuntimeSkills({
      rootWorkspacePath,
      homeDir: createTempRoot(),
      principalId: "principal-test",
    });
    const collaboration = skills.find((skill) => skill.name === "agenter-collaboration");
    const attention = skills.find((skill) => skill.name === "agenter-attention");
    const message = skills.find((skill) => skill.name === "agenter-message");
    const terminal = skills.find((skill) => skill.name === "agenter-terminal");
    const runtime = skills.find((skill) => skill.name === "agenter-runtime");
    expect(collaboration).toBeTruthy();
    expect(attention).toBeTruthy();
    expect(message).toBeTruthy();
    expect(terminal).toBeTruthy();
    expect(runtime).toBeTruthy();
    expect(collaboration?.summary).toContain("shared room");
    expect(attention?.summary).toContain("attention debt");
    expect(collaboration?.path).toBe(join(repoRoot, "packages", "app-server", "skills", "collaboration", "SKILL.md"));
    expect(attention?.path).toBe(join(repoRoot, "packages", "attention-system", "skills", "attention", "SKILL.md"));
    const skillsList = buildRuntimeSkillsList(skills);
    expect(skillsList).toContain("agenter-collaboration");
    expect(skillsList).toContain("Use `skill info <skill>`");
    expect(skillsList).toContain("real filesystem path");
    expect(skillsList).toContain("references/*.md");
    expect(existsSync(join(rootWorkspacePath, "skills", "agenter-collaboration", "SKILL.md"))).toBeFalse();

    const content = readRuntimeSkillContent(collaboration!);
    expect(content).toContain("Quick start:");
    expect(content).toContain("Key laws:");
    expect(content).toContain("Keep a single source of truth for shared contracts and ownership.");
    expect(content).toContain("Claim ownership once.");
    expect(content).toContain("workspace or terminal work");
    expect(content).toContain("Another participant's acknowledgement does not by itself mean you need to answer again.");
    expect(content).toContain("Private reminders are coordination hints");
    expect(content).toContain("References:");
    expect(content).toContain("references/shared-room-protocols.md");
    expect(content).not.toContain("server.js is not on disk yet");

    const attentionContent = readRuntimeSkillContent(attention!);
    expect(attentionContent).toContain("Use this skill when you need to inspect unresolved attention work");
    expect(attentionContent).toContain("`score > 0` means the attention work still exists.");
    expect(attentionContent).toContain("`done: true`");
    expect(attentionContent).toContain("relay room");
    expect(attentionContent).toContain("origin room already received the final answer");
    expect(attentionContent).toContain("tool-level `stdin` field");
    expect(attentionContent).toContain("Do not synthesize `stdin` with shell glue");
    expect(attentionContent).toContain("root_bash.command: attention commit");
    expect(attentionContent).toContain("root_bash.stdin:");
    expect(attentionContent).toContain('attention commit \'{"contextId":"ctx-..."');
    expect(attentionContent).toContain("marks compact as `Suggested` or `Available`");
    expect(attentionContent).toContain("references/settlement.md");
    expect(attentionContent).toContain("do that real work before browsing attention");
    expect(attentionContent).toContain("default to the minimal command plus JSON in the tool-level `stdin`");
    expect(attentionContent).toContain("do not add a redundant `echo`");
    expect(attentionContent).toContain("Plain-shell fallback only when you are already inside a shell");
    expect(attentionContent).not.toContain("AttentionContexts.metadata");

    const messageContent = readRuntimeSkillContent(message!);
    expect(messageContent).toContain("Room messages are durable shared truth.");
    expect(messageContent).toContain("chat-related attention item");
    expect(messageContent).toContain("do not reread the room first");
    expect(messageContent).toContain("task already shows the exact room `chatId`");
    expect(messageContent).toContain("Run `message list` once only when you truly need a `chatId`");
    expect(messageContent).toContain("Run `message query`");
    expect(messageContent).toContain('chatId:"*"');
    expect(messageContent).toContain('mode:"sql"');
    expect(messageContent).toContain("literal room id is enough");
    expect(messageContent).toContain("After the room-visible result is in place");
    expect(messageContent).toContain("send one short acknowledgement before the deeper tool work starts");
    expect(messageContent).toContain("preserve that fact exactly instead of silently normalizing it");
    expect(messageContent).toContain("switch to `attention` and settle");
    expect(messageContent).toContain("Keep room-visible updates concise and timely without narrating every internal step");
    expect(messageContent).toContain("Private reminders");
    expect(messageContent).toContain("\"I'm asking them now\" is progress, not the delivered answer");
    expect(messageContent).toContain("deliver that answer back into the origin room");
    expect(messageContent).toContain("Terminal success alone is not the room-visible result");
    expect(messageContent).toContain("prefer `command=message send` plus JSON `stdin`");
    expect(messageContent).toContain("message query");
    expect(messageContent).toContain("message send --compact");
    expect(messageContent).toContain("message edit");
    expect(messageContent).toContain("message recall");
    expect(messageContent).toContain("followUpAfterMs");
    expect(messageContent).toContain("one-shot reminder for yourself");
    expect(messageContent).toContain("never auto-sends another room reply");
    expect(messageContent).toContain("include `ref`");
    expect(messageContent).toContain("`message send` returns `recentMessages`");
    expect(messageContent).toContain("see `referencedItems`");
    expect(messageContent).toContain("Similar wording alone is not enough to justify recall");
    expect(messageContent).toContain("intentional in the room's protocol or request");
    expect(messageContent).toContain("already know its `messageId`");
    expect(messageContent).toContain("should no longer remain visible");
    expect(messageContent).toContain("send a corrected follow-up message instead of guessing");
    expect(messageContent).toContain("References:");
    expect(messageContent).toContain("references/room-protocols.md");
    expect(messageContent).toContain("references/chat-attention-items.md");
    expect(messageContent).not.toContain("127.0.0.1");
    expect(messageContent).not.toContain("APP-URL:");

    const terminalContent = readRuntimeSkillContent(terminal!);
    expect(terminalContent).toContain("A runtime does not start with a terminal by default.");
    expect(terminalContent).toContain("Run `terminal list` first to inspect `processPhase`, `currentPath`, `currentTitle`");
    expect(terminalContent).toContain("Public `terminal create` auto-bootstraps by default");
    expect(terminalContent).toContain("`terminal get-config`");
    expect(terminalContent).toContain("run `terminal bootstrap` before expecting read/write to work");
    expect(terminalContent).toContain("`lifecycleTransition` is a coordination lock");
    expect(terminalContent).toContain("`terminal set-config`");
    expect(terminalContent).toContain("Run `terminal stop` when you want to halt the PTY");
    expect(terminalContent).toContain(
      "If work needs a port listener, local web server, watch mode, REPL, or retryable boot sequence",
    );
    expect(terminalContent).toContain(
      "If a one-shot shell hits binding or sandbox errors while you are trying to make a service reachable",
    );
    expect(terminalContent).toContain("do not prove the promised URL or API path actually responds");
    expect(terminalContent).toContain("the normal next move is to create or recover the terminal");
    expect(terminalContent).toContain("Decide whether the next payload is `raw` or `mixed`.");
    expect(terminalContent).toContain("default to `command=<bare terminal action>` plus JSON `stdin`");
    expect(terminalContent).toContain("accepts `--compact` positional arrays");
    expect(terminalContent).toContain("`terminal input` is mixed mode.");
    expect(terminalContent).toContain("run `terminal write --help` or `terminal input --help` first");
    expect(terminalContent).toContain("run `skill info agenter-terminal`");
    expect(terminalContent).toContain("references/terminal-config.md");
    expect(terminalContent).toContain("references/input-modes.md");
    expect(terminalContent).toContain("references/file-writing.md");
    expect(terminalContent).toContain("References:");
    expect(terminalContent).toContain("references/terminal-lifecycle.md");
    expect(terminalContent).toContain("references/terminal-config.md");
    expect(terminalContent).toContain("references/input-modes.md");
    expect(terminalContent).toContain("references/file-writing.md");
    expect(terminalContent).not.toContain("create/list/read/write/kill");
    expect(terminalContent).not.toContain("127.0.0.1");

    const runtimeContent = readRuntimeSkillContent(runtime!);
    expect(runtimeContent).toContain("workspace_list");
    expect(runtimeContent).toContain("skill info <skill>");
    expect(runtimeContent).toContain("make one real command for that target before browsing deeper docs");
    expect(runtimeContent).toContain("~/tools");
    expect(runtimeContent).toContain("outbound network access");
    expect(runtimeContent).toContain("objective verification of current or external facts");
    expect(runtimeContent).toContain("A local delivery URL may be verified from `root_bash`");
    expect(runtimeContent).toContain("default to `command=<bare action>` plus JSON `stdin`");
    expect(runtimeContent).toContain("marks compact as `Suggested` or `Available`");
    expect(runtimeContent).toContain("not enough to prove a local delivery URL is ready");
    expect(runtimeContent).toContain("scheme, host, port, and path are all part of the delivery contract");
    expect(runtimeContent).toContain("references/discovery.md");
    expect(runtimeContent).toContain("references/shell-surface.md");
    expect(runtimeContent).toContain("references/toolbox.md");

    const terminalLifecycleReference = readFileSync(
      join(dirname(terminal!.path), "references", "terminal-lifecycle.md"),
      "utf8",
    );
    expect(terminalLifecycleReference).toContain("anything that binds a port or serves HTTP belongs in a terminal");
    expect(terminalLifecycleReference).toContain("use `terminal list` to inspect `processPhase`, `currentPath`, `currentTitle`, and stop facts");
    expect(terminalLifecycleReference).toContain("auto-bootstraps new terminals by default");
    expect(terminalLifecycleReference).toContain("`lifecycleTransition` is `bootstrapping` or `killing`");
    expect(terminalLifecycleReference).toContain("run `terminal bootstrap`");
    expect(terminalLifecycleReference).toContain("`terminal stop` halts the PTY while preserving the terminal record");
    expect(terminalLifecycleReference).toContain("switch to `terminal get-config`");
    expect(terminalLifecycleReference).toContain("ad-hoc listener experiments such as `python -m http.server`");
    expect(terminalLifecycleReference).toContain("do not replace that HTTP verification");
    expect(terminalLifecycleReference).toContain("carry terminal JSON in `stdin` by default");
    expect(terminalLifecycleReference).toContain("accepts `--compact` positional arrays");
    expect(terminalLifecycleReference).toContain("terminal input");
    expect(terminalLifecycleReference).not.toContain("kill strategy");

    const terminalConfigReference = readFileSync(
      join(dirname(terminal!.path), "references", "terminal-config.md"),
      "utf8",
    );
    expect(terminalConfigReference).toContain("`terminal get-config`");
    expect(terminalConfigReference).toContain("`terminal set-config`");
    expect(terminalConfigReference).toContain("patch semantics");
    expect(terminalConfigReference).toContain("`cols` and `rows` may resize a running PTY immediately");
    expect(terminalConfigReference).toContain("next bootstrap");

    const terminalInputModesReference = readFileSync(
      join(dirname(terminal!.path), "references", "input-modes.md"),
      "utf8",
    );
    expect(terminalInputModesReference).toContain("`terminal write` is raw mode.");
    expect(terminalInputModesReference).toContain("`terminal input` is mixed mode.");
    expect(terminalInputModesReference).toContain("<raw>...</raw>");
    expect(terminalInputModesReference).toContain("missing `</raw>` is a hard parse error");
    expect(terminalInputModesReference).toContain('ctrl="true"');
    expect(terminalInputModesReference).toContain('<key data="d" ctrl="true"/>');

    const terminalFileWritingReference = readFileSync(
      join(dirname(terminal!.path), "references", "file-writing.md"),
      "utf8",
    );
    expect(terminalFileWritingReference).toContain("field names but not the quoting strategy");
    expect(terminalFileWritingReference).toContain("through `skill info agenter-terminal`");
    expect(terminalFileWritingReference).toContain("command=terminal write");
    expect(terminalFileWritingReference).toContain("command=terminal input");
    expect(terminalFileWritingReference).toContain("cat > proof.txt");
    expect(terminalFileWritingReference).toContain('<key data="d" ctrl="true"/>');

    expect(terminalLifecycleReference).toContain("cat > file");

    const runtimeShellReference = readFileSync(join(dirname(runtime!.path), "references", "shell-surface.md"), "utf8");
    expect(runtimeShellReference).toContain("outbound-network verification of current or external facts");
    expect(runtimeShellReference).toContain("prefer one-shot shell verification over guessing from memory");
    expect(runtimeShellReference).toContain("plus JSON `stdin`");
    expect(runtimeShellReference).toContain("marks compact as `Suggested` or `Available`");
    expect(runtimeShellReference).toContain("verify an already-running URL with one-shot commands such as `curl`");
    expect(runtimeShellReference).toContain("are not that HTTP proof");
    expect(runtimeShellReference).toContain("the next move is usually the required durable reply");
    expect(runtimeShellReference).toContain(
      "`http://127.0.0.1:54230/` and `http://127.0.0.1:54230/index.html` are different contracts",
    );
    expect(runtimeShellReference).toContain("Do not use one-shot bash to launch ad-hoc socket or HTTP listeners");

    const runtimeDiscoveryReference = readFileSync(join(dirname(runtime!.path), "references", "discovery.md"), "utf8");
    expect(runtimeDiscoveryReference).toContain("Terminal-specific escalation:");
    expect(runtimeDiscoveryReference).toContain("start with `terminal list`");
    expect(runtimeDiscoveryReference).toContain("read `terminal bootstrap --help`");
    expect(runtimeDiscoveryReference).toContain("read `terminal stop --help`");
    expect(runtimeDiscoveryReference).toContain("terminal write --help");
    expect(runtimeDiscoveryReference).toContain("terminal input --help");
    expect(runtimeDiscoveryReference).toContain("skill info agenter-terminal");
    expect(runtimeDiscoveryReference).toContain("references/input-modes.md");
    expect(runtimeDiscoveryReference).toContain("references/file-writing.md");

    const messageAttentionReference = readFileSync(
      join(dirname(message!.path), "references", "chat-attention-items.md"),
      "utf8",
    );
    expect(messageAttentionReference).toContain("send the acknowledgement before you disappear into file writes");
    expect(messageAttentionReference).toContain("does not finish the origin room's final delivery");
    expect(messageAttentionReference).toContain("send the answer back to the origin room");
    expect(messageAttentionReference).toContain("message query");
    expect(messageAttentionReference).toContain('chatId:"*"');
    expect(messageAttentionReference).toContain("default to `command=message send` plus JSON `stdin`");
    expect(messageAttentionReference).toContain("message send --compact");
    expect(messageAttentionReference).toContain("keep the promised payload exact");
    expect(messageAttentionReference).toContain("after the exact HTTP check succeeds, send the room reply");

    const messageRoomReference = readFileSync(join(dirname(message!.path), "references", "room-protocols.md"), "utf8");
    expect(messageRoomReference).toContain("that acknowledgement often helps before you start the deeper work");
    expect(messageRoomReference).toContain("origin room still owns the final user-visible answer");
    expect(messageRoomReference).toContain("message query");
    expect(messageRoomReference).toContain('mode:"sql"');
    expect(messageRoomReference).toContain("prefer `command=message send` plus JSON `stdin`");
    expect(messageRoomReference).toContain("message send --compact");
    expect(messageRoomReference).toContain("send that exact value back instead of a normalized variant");

    const collaborationReference = readFileSync(
      join(dirname(collaboration!.path), "references", "shared-room-protocols.md"),
      "utf8",
    );
    expect(collaborationReference).toContain("stop repeating that claim and go produce it");
    expect(collaborationReference).toContain("does not automatically mean you need to reply again");
    expect(collaborationReference).toContain("do not keep the room busy with status chatter");
  });

  test("Scenario: Given runtime skill mount roots When they are resolved Then shell-visible mounts include writable roots plus package-owned built-in sources", () => {
    const rootWorkspacePath = createTempRoot();
    const homeDir = createTempRoot();
    const roots = listRuntimeSkillMountRoots({
      rootWorkspacePath,
      homeDir,
      principalId: "principal-test",
    });

    expect(roots).toContain(join(homeDir, ".agents", "skills"));
    expect(roots).toContain(join(homeDir, ".agenter", "skills"));
    expect(roots).toContain(join(rootWorkspacePath, "skills"));
    expect(roots).toContain(join(repoRoot, "packages", "app-server", "skills", "runtime"));
    expect(roots).toContain(join(repoRoot, "packages", "attention-system", "skills", "attention"));
    expect(roots.some((path) => path.includes(".runtime-skills"))).toBeFalse();
  });

  test("Scenario: Given an on-disk skill with the same name When runtime skills are resolved Then the on-disk skill overrides the built-in baseline", () => {
    const rootWorkspacePath = createTempRoot();
    const overrideDir = join(rootWorkspacePath, "skills", "message");
    mkdirSync(overrideDir, { recursive: true });
    writeFileSync(
      join(overrideDir, "SKILL.md"),
      [
        "---",
        "name: agenter-message",
        "description: local override",
        "---",
        "",
        "# agenter-message",
        "",
        "This is the local override.",
        "",
      ].join("\n"),
      "utf8",
    );

    const skills = listRuntimeSkills({
      rootWorkspacePath,
      homeDir: createTempRoot(),
      principalId: "principal-test",
    });
    const message = skills.find((skill) => skill.name === "agenter-message");
    expect(message?.rootKind).toBe("avatar");
    expect(message?.path).toBe(join(overrideDir, "SKILL.md"));
    expect(readRuntimeSkillContent(message!)).toContain("This is the local override.");
  });

  test("Scenario: Given the same skill name exists across every layer When runtime-visible skills are resolved Then precedence stays shared before built-in before global before avatar-private", () => {
    const rootWorkspacePath = createTempRoot();
    const homeDir = createTempRoot();
    const skillName = "agenter-message";
    const sharedDir = join(homeDir, ".agents", "skills", "shared-message");
    const globalDir = join(homeDir, ".agenter", "skills", "global-message");
    const avatarDir = join(rootWorkspacePath, "skills", "avatar-message");

    for (const [skillDir, description, body] of [
      [sharedDir, "shared override", "This is the shared version."],
      [globalDir, "global override", "This is the global version."],
      [avatarDir, "avatar override", "This is the avatar-private version."],
    ] as const) {
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        [
          "---",
          `name: ${skillName}`,
          `description: ${description}`,
          "---",
          "",
          `# ${skillName}`,
          "",
          body,
          "",
        ].join("\n"),
        "utf8",
      );
    }

    const input = {
      rootWorkspacePath,
      homeDir,
      principalId: "principal-test",
    };

    const visibleWithAvatar = listRuntimeSkills(input).find((skill) => skill.name === skillName);
    expect(visibleWithAvatar?.rootKind).toBe("avatar");
    expect(readRuntimeSkillContent(visibleWithAvatar!)).toContain("avatar-private version");

    rmSync(avatarDir, { recursive: true, force: true });
    const visibleWithGlobal = listRuntimeSkills(input).find((skill) => skill.name === skillName);
    expect(visibleWithGlobal?.rootKind).toBe("global");
    expect(readRuntimeSkillContent(visibleWithGlobal!)).toContain("global version");

    rmSync(globalDir, { recursive: true, force: true });
    const visibleWithBuiltin = listRuntimeSkills(input).find((skill) => skill.name === skillName);
    expect(visibleWithBuiltin?.rootKind).toBe("builtin");
    expect(readRuntimeSkillContent(visibleWithBuiltin!)).toContain("Room messages are durable shared truth.");

    const builtinPath = visibleWithBuiltin?.path;
    expect(builtinPath).toBeTruthy();

    rmSync(sharedDir, { recursive: true, force: true });
    const visibleAfterSharedRemoval = listRuntimeSkills(input).find((skill) => skill.name === skillName);
    expect(visibleAfterSharedRemoval?.rootKind).toBe("builtin");
    expect(visibleAfterSharedRemoval?.path).toBe(builtinPath);
  });
});
