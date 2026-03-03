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
        instances: [],
        runtimes: {},
        chatsByInstance: {},
      });
      return () => {};
    },
    connect: async () => {},
    disconnect: () => {},
    createInstance: async () => {},
    startInstance: async () => {},
    stopInstance: async () => {},
    deleteInstance: async () => {},
    sendChat: async () => {},
    readSettings: async () => ({ path: "settings.json", content: "{}", mtimeMs: 0 }),
    saveSettings: async () => ({ ok: true, file: { path: "settings.json", content: "{}", mtimeMs: 1 } }),
  }),
}));

describe("Feature: web ui app shell", () => {
  test("Scenario: Given app mounted When rendering Then show core panels", () => {
    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    expect(screen.getByText("Agenter WebUI")).toBeInTheDocument();
    expect(screen.getByText("Instances")).toBeInTheDocument();
    expect(screen.getByText(/Chat/)).toBeInTheDocument();
    expect(screen.getByText("Settings & Prompts")).toBeInTheDocument();
  });
});
