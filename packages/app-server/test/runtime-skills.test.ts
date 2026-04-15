import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  buildRuntimeSkillsList,
  listRuntimeSkillMountRoots,
  listRuntimeSkills,
  readRuntimeSkillContent,
} from "../src/runtime-skills";

const tempDirs: string[] = [];

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
    expect(collaboration?.path).toContain(join(rootWorkspacePath, ".runtime-skills"));
    expect(attention?.path).toContain(join(rootWorkspacePath, ".runtime-skills"));
    const skillsList = buildRuntimeSkillsList(skills);
    expect(skillsList).toContain("agenter-collaboration");
    expect(skillsList).toContain("Use `ccski info <skill>`");
    expect(skillsList).toContain("real filesystem path");
    expect(skillsList).toContain("references/*.md");
    expect(existsSync(join(rootWorkspacePath, "skills", "agenter-collaboration", "SKILL.md"))).toBeFalse();

    const content = readRuntimeSkillContent(collaboration!);
    expect(content).toContain("Quick start:");
    expect(content).toContain("Key laws:");
    expect(content).toContain("Keep a single source of truth for shared contracts and ownership.");
    expect(content).toContain("Claim ownership once.");
    expect(content).toContain("workspace or terminal work");
    expect(content).toContain("Another participant's acknowledgement is not by itself a new obligation for you.");
    expect(content).toContain("Private reminders are coordination hints");
    expect(content).toContain("References:");
    expect(content).toContain("references/shared-room-protocols.md");
    expect(content).not.toContain("server.js is not on disk yet");

    const attentionContent = readRuntimeSkillContent(attention!);
    expect(attentionContent).toContain("Use this skill when you need to inspect unresolved obligations");
    expect(attentionContent).toContain("`score > 0` means the obligation still exists.");
    expect(attentionContent).toContain("`done: true`");
    expect(attentionContent).toContain("relay room");
    expect(attentionContent).toContain("origin room already received the final answer");
    expect(attentionContent).toContain('attention commit \'{"contextId":"ctx-..."');
    expect(attentionContent).toContain("marks compact as `Suggested` or `Available`");
    expect(attentionContent).toContain("references/settlement.md");
    expect(attentionContent).toContain("do that real work before browsing attention");
    expect(attentionContent).toContain("default to JSON `stdin`");
    expect(attentionContent).not.toContain("AttentionContexts.metadata");

    const messageContent = readRuntimeSkillContent(message!);
    expect(messageContent).toContain("Room messages are durable shared truth.");
    expect(messageContent).toContain("chat-related attention item");
    expect(messageContent).toContain("do not reread the room first");
    expect(messageContent).toContain("task already shows the exact room `chatId`");
    expect(messageContent).toContain("Run `message list` once only when you truly need a `chatId`");
    expect(messageContent).toContain("literal room id is enough");
    expect(messageContent).toContain("necessary room reply has been sent");
    expect(messageContent).toContain("send one short acknowledgement before the deeper tool work starts");
    expect(messageContent).toContain("preserve that fact exactly instead of silently normalizing it");
    expect(messageContent).toContain("switch to `attention` and settle");
    expect(messageContent).toContain("do not spam the room with every internal step");
    expect(messageContent).toContain("Private reminders");
    expect(messageContent).toContain("only an acknowledgement, not the final delivery");
    expect(messageContent).toContain("deliver that answer back into the origin room");
    expect(messageContent).toContain("Terminal success alone is not the room reply");
    expect(messageContent).toContain("prefer `command=message send` plus JSON `stdin`");
    expect(messageContent).toContain("message send --compact");
    expect(messageContent).toContain("References:");
    expect(messageContent).toContain("references/room-protocols.md");
    expect(messageContent).toContain("references/chat-attention-items.md");
    expect(messageContent).not.toContain("127.0.0.1");
    expect(messageContent).not.toContain("APP-URL:");

    const terminalContent = readRuntimeSkillContent(terminal!);
    expect(terminalContent).toContain("A runtime does not start with a terminal by default.");
    expect(terminalContent).toContain(
      "If work needs a port listener, local web server, watch mode, REPL, or retryable boot sequence",
    );
    expect(terminalContent).toContain(
      "If a one-shot shell hits binding or sandbox errors while you are trying to make a service reachable",
    );
    expect(terminalContent).toContain("do not prove the promised URL or API path actually responds");
    expect(terminalContent).toContain("the normal next move is to create or recover the terminal");
    expect(terminalContent).toContain("default to `command=<bare terminal action>` plus JSON `stdin`");
    expect(terminalContent).toContain("accepts `--compact` positional arrays");
    expect(terminalContent).toContain("References:");
    expect(terminalContent).toContain("references/terminal-lifecycle.md");
    expect(terminalContent).toContain("references/file-writing.md");
    expect(terminalContent).not.toContain("127.0.0.1");

    const runtimeContent = readRuntimeSkillContent(runtime!);
    expect(runtimeContent).toContain("root_workspace_list");
    expect(runtimeContent).toContain("ccski info <skill>");
    expect(runtimeContent).toContain("make one real command for that target before browsing deeper docs");
    expect(runtimeContent).toContain("~/tools");
    expect(runtimeContent).toContain("outbound network access");
    expect(runtimeContent).toContain("objective verification of current or external facts");
    expect(runtimeContent).toContain("A local delivery URL may be verified from `root_workspace_bash`");
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
    expect(terminalLifecycleReference).toContain("ad-hoc listener experiments such as `python -m http.server`");
    expect(terminalLifecycleReference).toContain("do not replace that HTTP verification");
    expect(terminalLifecycleReference).toContain("carry terminal JSON in `stdin` by default");
    expect(terminalLifecycleReference).toContain("accepts `--compact` positional arrays");

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

    const messageAttentionReference = readFileSync(
      join(dirname(message!.path), "references", "chat-attention-items.md"),
      "utf8",
    );
    expect(messageAttentionReference).toContain("send the acknowledgement before you disappear into file writes");
    expect(messageAttentionReference).toContain("does not satisfy the origin room's final reply obligation");
    expect(messageAttentionReference).toContain("send the answer back to the origin room");
    expect(messageAttentionReference).toContain("default to `command=message send` plus JSON `stdin`");
    expect(messageAttentionReference).toContain("message send --compact");
    expect(messageAttentionReference).toContain("keep the promised payload exact");
    expect(messageAttentionReference).toContain("after the exact HTTP check succeeds, send the room reply");

    const messageRoomReference = readFileSync(join(dirname(message!.path), "references", "room-protocols.md"), "utf8");
    expect(messageRoomReference).toContain("send that acknowledgement before you start the deeper work");
    expect(messageRoomReference).toContain("origin room still owns the final user-visible answer");
    expect(messageRoomReference).toContain("prefer `command=message send` plus JSON `stdin`");
    expect(messageRoomReference).toContain("message send --compact");
    expect(messageRoomReference).toContain("send that exact value back instead of a normalized variant");

    const collaborationReference = readFileSync(
      join(dirname(collaboration!.path), "references", "shared-room-protocols.md"),
      "utf8",
    );
    expect(collaborationReference).toContain("stop repeating that claim and go produce it");
    expect(collaborationReference).toContain("does not automatically require you to reply again");
    expect(collaborationReference).toContain("do not keep the room busy with status chatter");
  });

  test("Scenario: Given runtime skill mount roots When they are resolved Then only shell-visible user skill roots are mounted and built-ins stay inside the avatar root cache", () => {
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
});
