import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { AppKernel } from "../src/app-kernel";

const tempDirs: string[] = [];

const createKernel = (): AppKernel => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
  tempDirs.push(dir);
  return new AppKernel({
    globalSessionRoot: join(dir, "sessions"),
    workspacesPath: join(dir, "workspaces.yaml"),
  });
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: app kernel event replay", () => {
  test("Scenario: Given kernel boot cwd When start called Then workspace is tracked in workspaces.yaml", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(dir);
    const workspacePath = join(dir, "workspace");
    const workspacesPath = join(dir, "workspaces.yaml");
    const kernel = new AppKernel({
      globalSessionRoot: join(dir, "sessions"),
      workspacesPath,
      initialWorkspace: workspacePath,
    });

    await kernel.start();

    const yaml = readFileSync(workspacesPath, "utf8");
    expect(yaml).toContain(`- ${resolve(workspacePath)}`);
  });

  test("Scenario: Given emitted events When reading getEventsAfter Then return ordered backlog", async () => {
    const kernel = createKernel();
    const first = await kernel.createSession({ cwd: process.cwd(), name: "alpha", autoStart: false });
    const second = await kernel.createSession({ cwd: process.cwd(), name: "beta", autoStart: false });

    const full = kernel.getEventsAfter(0);
    expect(full.length).toBe(2);
    expect(full[0]?.eventId).toBe(1);
    expect(full[1]?.eventId).toBe(2);
    expect((full[0]?.payload as { session: { id: string } }).session.id).toBe(first.id);
    expect((full[1]?.payload as { session: { id: string } }).session.id).toBe(second.id);

    const incremental = kernel.getEventsAfter(1);
    expect(incremental.length).toBe(1);
    expect(incremental[0]?.eventId).toBe(2);
  });

  test("Scenario: Given event volume exceeds cap When reading backlog Then only latest window is kept", async () => {
    const kernel = createKernel();
    for (let index = 0; index < 2050; index += 1) {
      await kernel.createSession({
        cwd: process.cwd(),
        name: `session-${index}`,
        autoStart: false,
      });
    }

    const events = kernel.getEventsAfter(0);
    expect(events.length).toBe(2048);
    expect(events[0]?.eventId).toBe(3);
    expect(events[events.length - 1]?.eventId).toBe(2050);
  });

  test("Scenario: Given terminal preset command is missing When auto-starting session Then kernel still accepts chat input", async () => {
    const kernel = createKernel();
    await kernel.start();

    const workspace = mkdtempSync(join(tmpdir(), "agenter-missing-terminal-"));
    tempDirs.push(workspace);
    mkdirSync(join(workspace, ".agenter"), { recursive: true });
    writeFileSync(
      join(workspace, ".agenter", "settings.json"),
      JSON.stringify(
        {
          terminal: {
            presets: {
              shell: {
                command: ["__agenter_missing_binary__"],
              },
            },
            gitLog: false,
          },
          features: {
            terminal: {
              bootTerminals: [{ id: "shell", focus: true, autoRun: true }],
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const session = await kernel.createSession({
      cwd: workspace,
      autoStart: true,
    });

    expect(session.status).toBe("running");
    await expect(kernel.sendChat(session.id, "hello")).resolves.toEqual({ ok: true });
    await kernel.stop();
  });
});
