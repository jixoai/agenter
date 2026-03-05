import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { App } from "../src/App";

vi.mock("@agenter/client-sdk", () => ({
  createAgenterClient: () => ({ close: () => {} }),
  createRuntimeStore: () => ({
    subscribe: (listener: (state: unknown) => void) => {
      listener({
        connected: true,
        lastEventId: 0,
        sessions: [],
        runtimes: {},
        activityBySession: {},
        terminalSnapshotsBySession: {},
        chatsBySession: {},
        tasksBySession: {},
        recentWorkspaces: [],
      });
      return () => {};
    },
    connect: async () => {},
    disconnect: () => {},
    createSession: async () => {},
    startSession: async () => {},
    stopSession: async () => {},
    deleteSession: async () => {},
    sendChat: async () => {},
    readSettings: async () => ({ path: "settings.json", content: "{}", mtimeMs: 0 }),
    saveSettings: async () => ({ ok: true, file: { path: "settings.json", content: "{}", mtimeMs: 1 } }),
    listRecentWorkspaces: async () => [],
    listDirectories: async () => [],
    validateDirectory: async () => ({ ok: true, path: "." }),
  }),
}));

describe("Feature: web ui app shell", () => {
  test("Scenario: Given app mounted When rendering Then show quick start shell", () => {
    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    expect(screen.getByText("Agenter")).toBeInTheDocument();
    expect(screen.getByText("Quick Start")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tasks" })).not.toBeInTheDocument();
  });
});
