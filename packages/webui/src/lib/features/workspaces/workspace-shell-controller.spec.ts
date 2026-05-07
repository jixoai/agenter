import { describe, expect, test, vi } from "vitest";

import { resolveWorkspaceShellPromptFolderName } from "./workspace-shell-contract";
import { WorkspaceShellController } from "./workspace-shell-controller";

const stripAnsi = (value: string): string =>
  value
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\r/g, "")
    .replace(/\u001b./g, "");

class FakeTerminal {
  focusCalls = 0;
  writes: string[] = [];

  focus(): void {
    this.focusCalls += 1;
  }

  write(data: string): void {
    this.writes.push(data);
  }
}

describe("Feature: Workspace shell controller", () => {
  test("Scenario: Given one helpcenter command When the shell controller starts Then it auto-runs through backend exec and prints the next prompt with the returned cwd", async () => {
    const terminal = new FakeTerminal();
    const cwdChanges: string[] = [];
    const exec = vi.fn().mockResolvedValue({
      cwd: "/repo/agenter/docs",
      exitCode: 0,
      stderr: "",
      stdout: "workspace list output",
    });

    const controller = new WorkspaceShellController({
      exec,
      initialCommand: "workspace list --help",
      initialCwd: "/repo/agenter",
      onCwdChange: (cwd) => {
        cwdChanges.push(cwd);
      },
      promptLabel: "default@workspace",
      surface: "public-workspace",
      terminal,
    });

    await controller.start();

    const rawTranscript = terminal.writes.join("");
    expect(rawTranscript).toContain("\u001b[36mdefault@workspace\u001b[0m:\u001b[94magenter\u001b[0m");
    expect(exec).toHaveBeenCalledWith({
      command: "workspace list --help",
      cwd: "/repo/agenter",
      surface: "public-workspace",
    });
    const transcript = stripAnsi(rawTranscript);
    expect(transcript).toContain(
      `default@workspace:${resolveWorkspaceShellPromptFolderName("/repo/agenter")}$ workspace list --help`,
    );
    expect(transcript).toContain("workspace list output");
    expect(transcript).toContain(`default@workspace:${resolveWorkspaceShellPromptFolderName("/repo/agenter/docs")}$ `);
    expect(cwdChanges).toEqual(["/repo/agenter", "/repo/agenter/docs"]);
    expect(terminal.focusCalls).toBeGreaterThan(0);
  });

  test("Scenario: Given backend stderr When one shell command fails Then the shell prints error output and exit status with terminal colors", async () => {
    const terminal = new FakeTerminal();
    const exec = vi.fn().mockResolvedValue({
      cwd: "/repo/agenter",
      exitCode: 2,
      stderr: "failure line",
      stdout: "",
    });

    const controller = new WorkspaceShellController({
      exec,
      initialCommand: "workspace broken",
      initialCwd: "/repo/agenter",
      promptLabel: "default@workspace",
      surface: "public-workspace",
      terminal,
    });

    await controller.start();

    const rawTranscript = terminal.writes.join("");
    expect(rawTranscript).toContain("\u001b[31mfailure line\r\n\u001b[0m");
    expect(rawTranscript).toContain("\u001b[31m[exit 2]\u001b[0m");
    const transcript = stripAnsi(rawTranscript);
    expect(transcript).toContain("failure line");
    expect(transcript).toContain("[exit 2]");
  });

  test("Scenario: Given one finished shell command When arrow-up recalls history and ctrl-c clears the line Then editing stays local without another backend call", async () => {
    const terminal = new FakeTerminal();
    const exec = vi.fn().mockResolvedValue({
      cwd: "/repo/agenter",
      exitCode: 0,
      stderr: "",
      stdout: "",
    });

    const controller = new WorkspaceShellController({
      exec,
      initialCwd: "/repo/agenter",
      promptLabel: "default@root",
      surface: "root-workspace",
      terminal,
    });

    await controller.start();
    controller.handleData("echo hi");
    controller.handleData("\r");
    await Promise.resolve();
    await Promise.resolve();
    controller.handleData("\u001b[A");
    controller.handleData("\u0003");

    expect(exec).toHaveBeenCalledTimes(1);
    const transcript = stripAnsi(terminal.writes.join(""));
    expect(transcript).toContain(`default@root:${resolveWorkspaceShellPromptFolderName("/repo/agenter")}$ echo hi`);
    expect(transcript).toContain("^C");
  });

  test("Scenario: Given a long home-directory path When building the shell prompt Then the prompt prints only the current folder name", () => {
    expect(resolveWorkspaceShellPromptFolderName("/Users/demo/projects/agenter/packages/webui")).toBe("webui");
  });
});
