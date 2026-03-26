import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SessionNotificationRegistry,
  listWorkspaceSettingsLayers,
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
    const registry = new SessionNotificationRegistry();

    const hiddenSnapshot = registry.noteAssistantReply({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      message: {
        id: "9",
        chatId: "chat-main",
        role: "assistant",
        content: "hello",
        timestamp: 9,
        channel: "to_user",
      },
    });

    expect(hiddenSnapshot?.unreadBySession["session-1"]).toBe(1);
    expect(hiddenSnapshot?.items[0]?.messageId).toBe("9");

    registry.setChatVisibility({ sessionId: "session-1", chatId: "chat-main", visible: true, focused: true });
    const visibleSnapshot = registry.noteAssistantReply({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      message: {
        id: "10",
        chatId: "chat-main",
        role: "assistant",
        content: "already visible",
        timestamp: 10,
        channel: "to_user",
      },
    });

    expect(visibleSnapshot).toBeNull();
    expect(registry.snapshot().unreadBySession["session-1"]).toBe(1);

    const otherChannelSnapshot = registry.noteAssistantReply({
      sessionId: "session-1",
      workspacePath: "/repo/demo",
      sessionName: "Demo",
      message: {
        id: "11",
        chatId: "room-team",
        role: "assistant",
        content: "team reply",
        timestamp: 11,
        channel: "to_user",
      },
    });

    expect(otherChannelSnapshot?.unreadBySession["session-1"]).toBe(2);

    const consumed = registry.consume({ sessionId: "session-1", chatId: "chat-main", upToMessageId: "9" });
    expect(consumed?.items.map((item) => item.messageId)).toEqual(["11"]);
    expect(consumed?.unreadBySession["session-1"]).toBe(1);
    expect(registry.snapshot().items.map((item) => item.chatId)).toEqual(["room-team"]);
  });
});
