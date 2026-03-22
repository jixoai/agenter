import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { TerminalControlPlane, type TerminalTransportServerMessage } from "../src/terminal-control-plane";

const workspaces: string[] = [];

const createPlane = () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "ati-control-plane-"));
  workspaces.push(outputRoot);
  return new TerminalControlPlane({
    outputRoot,
    defaultShellCommand: ["sh", "-lc", "cat"],
    initialConfig: {
      defaults: {
        cols: 80,
        rows: 20,
      },
      transport: {
        port: null,
      },
    },
  });
};

afterEach(() => {
  while (workspaces.length > 0) {
    const path = workspaces.pop();
    if (path) {
      rmSync(path, { recursive: true, force: true });
    }
  }
});

describe("Feature: terminal control plane", () => {
  test("Scenario: Given default create When creating and listing terminals Then the control plane starts a shell-backed terminal with profile metadata", async () => {
    const plane = createPlane();
    plane.setConfig({
      processProfiles: {
        shell: {
          title: "Shell",
          icon: "terminal",
          shortcuts: {
            submit: "enter",
          },
        },
      },
    });

    const created = await plane.create();

    expect(created.processKind).toBe("shell");
    expect(created.running).toBe(true);
    expect(created.title).toBe("Shell");
    expect(created.icon).toBe("terminal");
    expect(created.shortcuts).toEqual({ submit: "enter" });
    expect(plane.list()).toHaveLength(1);

    await plane.dispose();
  });

  test("Scenario: Given focus set operations When replacing adding removing and clearing Then the control plane preserves a declarative focus set", async () => {
    const plane = createPlane();
    const left = await plane.create({ terminalId: "left" });
    const right = await plane.create({ terminalId: "right" });

    expect(plane.focus("replace", [left.terminalId])).toEqual(["left"]);
    expect(plane.focus("add", [right.terminalId])).toEqual(["left", "right"]);
    expect(plane.focus("remove", [left.terminalId])).toEqual(["right"]);
    expect(plane.focus("clear")).toEqual([]);

    await plane.dispose();
  });

  test("Scenario: Given a write with returnRead When the terminal echoes input Then the control plane returns an explicit inspection payload", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "echo" });

    const result = await plane.write({
      terminalId: created.terminalId,
      text: "hello control plane",
      submit: false,
      returnRead: {
        debounceMs: 150,
      },
      readMode: "snapshot",
    });

    expect(result.ok).toBe(true);
    expect(result.read?.representation).toBe("snapshot");
    expect(result.read?.kind).toBe("terminal-snapshot");

    await plane.dispose();
  });

  test("Scenario: Given terminal output exceeds viewport rows When requesting the runtime snapshot Then the control plane preserves the whole scrollback for frontend restore", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "scrollback" });

    const output = Array.from({ length: 48 }, (_, index) => `line ${index + 1}`).join("\n");
    await plane.write({
      terminalId: created.terminalId,
      text: `${output}\n`,
      submit: false,
    });
    await Bun.sleep(200);

    const snapshot = plane.getSnapshot(created.terminalId);
    const rendered = snapshot.lines.join("\n");

    expect(snapshot.lines.length).toBeGreaterThan(snapshot.rows);
    expect(rendered).toContain("line 1");
    expect(rendered).toContain("line 48");

    await plane.dispose();
  });

  test("Scenario: Given config updates When reading config and killing terminals Then profile overrides are preserved and killed terminals disappear from list", async () => {
    const plane = createPlane();
    const config = plane.setConfig({
      processProfiles: {
        iflow: {
          icon: "sparkles",
          title: "iFlow",
          shortcuts: {
            plan: "shift+tab",
          },
        },
      },
      terminalProfiles: {
        demo: {
          title: "Demo",
        },
      },
    });

    expect(config.processProfiles?.iflow?.icon).toBe("sparkles");
    expect(config.terminalProfiles?.demo?.title).toBe("Demo");

    await plane.create({ terminalId: "demo" });
    expect(plane.list()).toHaveLength(1);
    await expect(plane.kill("demo")).resolves.toEqual({ ok: true, message: "terminal stopped" });
    expect(plane.list()).toHaveLength(0);

    await plane.dispose();
  });

  test("Scenario: Given websocket transport is started When a client connects and the terminal is killed Then endpoint discovery output streaming and lifecycle shutdown stay coherent", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    const socket = new WebSocket(endpoint!.url);
    const messages: TerminalTransportServerMessage[] = [];
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)) as TerminalTransportServerMessage);
    });

    await opened;
    socket.send(JSON.stringify({ type: "input", data: "hello transport\n" }));
    await Bun.sleep(150);

    expect(messages.some((message) => message.type === "snapshot")).toBe(true);
    expect(messages.some((message) => message.type === "output" && message.data.includes("hello transport"))).toBe(true);

    const closed = new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
    });
    await plane.kill(created.terminalId);
    await closed;
    plane.stopTransport();
    await plane.dispose();
  });
});
