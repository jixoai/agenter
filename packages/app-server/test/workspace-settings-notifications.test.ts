import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AttentionSystem } from "@agenter/attention-system";

import {
  listWorkspaceSettingsLayers,
  projectSessionNotificationSnapshot,
  readWorkspaceSettingsLayer,
  saveWorkspaceSettingsLayer,
} from "../src";

const tempDirs: string[] = [];

const createWorkspace = () => {
  const root = mkdtempSync(join(tmpdir(), "agenter-workspace-settings-"));
  const workspacePath = join(root, "workspace");
  mkdirSync(join(workspacePath, ".agenter"), { recursive: true });
  tempDirs.push(root);
  return { root, workspacePath };
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: workspace settings and session notifications", () => {
  test("Scenario: Given a workspace without any session When reading settings layers Then project settings can be loaded and saved by workspacePath", async () => {
    const { workspacePath } = createWorkspace();
    const settingsPath = join(workspacePath, ".agenter", "settings.json");
    writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          lang: "en",
          ai: {
            activeProvider: "default",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const listed = await listWorkspaceSettingsLayers({ workspacePath });
    const projectLayer = listed.layers.find((layer) => layer.sourceId === "project");
    if (!projectLayer) {
      throw new Error("expected project layer");
    }

    expect(projectLayer.exists).toBe(true);
    expect(projectLayer.editable).toBe(true);
    expect(JSON.parse(listed.effective.content).lang).toBe("en");

    const file = await readWorkspaceSettingsLayer({ workspacePath, layerId: projectLayer.layerId });
    expect(file.path).toBe(settingsPath);
    expect(JSON.parse(file.content).ai.activeProvider).toBe("default");

    const saved = await saveWorkspaceSettingsLayer({
      workspacePath,
      layerId: projectLayer.layerId,
      content: JSON.stringify({ lang: "ja", ai: { activeProvider: "workspace" } }, null, 2),
      baseMtimeMs: file.mtimeMs,
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      throw new Error("expected save to succeed");
    }
    expect(JSON.parse(saved.effective.content).lang).toBe("ja");
    expect(JSON.parse(readFileSync(settingsPath, "utf8")).ai.activeProvider).toBe("workspace");
  });

  test("Scenario: Given unread assistant replies across channels When chat visibility and consume state change Then unread notifications stay scoped to the visible channel", () => {
    const attention = new AttentionSystem();
    attention.createContext({ contextId: "ctx-chat-main", owner: "demo", focusState: "background" });
    const mainPush = attention.commit("ctx-chat-main", {
      ingressType: "push",
      meta: { author: "assistant", source: "message", systemId: "message", channelId: "chat-main", subjectId: "9" },
      scores: { hash1: 100 },
      summary: "hello",
      change: { type: "update", value: "hello" },
    }).commit;

    const hiddenSnapshot = projectSessionNotificationSnapshot({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      attention: attention.snapshot(),
    });

    expect(hiddenSnapshot.unreadBySession["session-1"]).toBe(1);
    expect(hiddenSnapshot.unreadByChat["session-1"]?.["chat-main"]).toBe(1);
    expect(hiddenSnapshot.items[0]?.messageId).toBe("9");

    attention.setContextFocusState("ctx-chat-main", "focused");
    const focusedSnapshot = projectSessionNotificationSnapshot({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      attention: attention.snapshot(),
    });
    expect(focusedSnapshot.items).toEqual([]);

    attention.consumePushes("ctx-chat-main", [mainPush.commitId]);
    attention.createContext({ contextId: "ctx-room-team", owner: "demo", focusState: "background" });
    attention.commit("ctx-room-team", {
      ingressType: "push",
      meta: { author: "assistant", source: "message", systemId: "message", channelId: "room-team", subjectId: "11" },
      scores: { hash2: 100 },
      summary: "team reply",
      change: { type: "update", value: "team reply" },
    });

    const consumedSnapshot = projectSessionNotificationSnapshot({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      attention: attention.snapshot(),
    });
    expect(consumedSnapshot.items.map((item) => item.chatId)).toEqual(["room-team"]);
    expect(consumedSnapshot.unreadBySession["session-1"]).toBe(1);
    expect(consumedSnapshot.unreadByChat["session-1"]?.["room-team"]).toBe(1);
  });

  test("Scenario: Given hidden terminal completion notifications When terminal visibility and consume change Then unread terminal badges stay scoped to that terminal", () => {
    const attention = new AttentionSystem();
    attention.createContext({ contextId: "ctx-terminal-shell-main", owner: "demo", focusState: "background" });
    const mainPush = attention.commit("ctx-terminal-shell-main", {
      ingressType: "push",
      meta: { author: "terminal", source: "terminal", systemId: "terminal", subjectId: "shell-main" },
      scores: { hash1: 100 },
      summary: "Terminal shell-main is ready for your input.",
      change: { type: "update", value: "Terminal shell-main is ready for your input." },
    }).commit;

    const hiddenSnapshot = projectSessionNotificationSnapshot({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      attention: attention.snapshot(),
    });

    expect(hiddenSnapshot.unreadBySession["session-1"]).toBe(1);
    expect(hiddenSnapshot.unreadByTerminal["session-1"]?.["shell-main"]).toBe(1);
    expect(hiddenSnapshot.items[0]?.sourceType).toBe("terminal");

    attention.setContextFocusState("ctx-terminal-shell-main", "focused");
    const focusedSnapshot = projectSessionNotificationSnapshot({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      attention: attention.snapshot(),
    });
    expect(focusedSnapshot.items).toEqual([]);

    attention.consumePushes("ctx-terminal-shell-main", [mainPush.commitId]);
    attention.createContext({ contextId: "ctx-terminal-shell-side", owner: "demo", focusState: "background" });
    attention.commit("ctx-terminal-shell-side", {
      ingressType: "push",
      meta: { author: "terminal", source: "terminal", systemId: "terminal", subjectId: "shell-side" },
      scores: { hash2: 100 },
      summary: "Terminal shell-side is ready for your input.",
      change: { type: "update", value: "Terminal shell-side is ready for your input." },
    });

    const consumedSnapshot = projectSessionNotificationSnapshot({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      attention: attention.snapshot(),
    });
    expect(consumedSnapshot.unreadBySession["session-1"]).toBe(1);
    expect(consumedSnapshot.unreadByTerminal["session-1"]?.["shell-main"]).toBeUndefined();
    expect(consumedSnapshot.unreadByTerminal["session-1"]?.["shell-side"]).toBe(1);
  });
});
