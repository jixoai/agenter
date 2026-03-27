import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { listScopedSettingsGraph, readScopedSettingsLayer, saveScopedSettingsLayer } from "../src";

const tempDirs: string[] = [];

const writeJson = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "agenter-settings-scope-"));
  const workspacePath = join(root, "workspace");
  const homeDir = join(root, "home");
  mkdirSync(join(workspacePath, ".agenter"), { recursive: true });
  mkdirSync(join(homeDir, ".agenter"), { recursive: true });
  tempDirs.push(root);
  return { root, workspacePath, homeDir };
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: scoped settings graph", () => {
  test("Scenario: Given workspace scope graph When listing reading and saving layers Then schema, provenance, and conflict semantics stay stable", async () => {
    const { workspacePath, homeDir } = createFixture();
    writeJson(join(homeDir, ".agenter", "settings.json"), {
      ai: {
        activeProvider: "user-provider",
      },
    });
    writeJson(join(workspacePath, ".agenter", "settings.json"), {
      lang: "ja",
      ai: {
        activeProvider: "workspace-provider",
      },
    });

    const graph = await listScopedSettingsGraph({
      scope: "workspace",
      workspacePath,
      homeDir,
    });
    const projectLayer = graph.layers.find((layer) => layer.sourceId === "project");
    if (!projectLayer) {
      throw new Error("expected project layer");
    }

    expect(graph.effective.schema.type).toBe("object");
    expect(graph.effective.provenance["/lang"]).toBeDefined();
    expect(projectLayer.editable).toBe(true);

    const file = await readScopedSettingsLayer({
      scope: "workspace",
      workspacePath,
      homeDir,
      layerId: projectLayer.layerId,
    });
    expect(file.content).toContain('"lang": "ja"');

    const saved = await saveScopedSettingsLayer({
      scope: "workspace",
      workspacePath,
      homeDir,
      layerId: projectLayer.layerId,
      content: '{\n  "lang": "en"\n}\n',
      baseMtimeMs: file.mtimeMs,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      throw new Error("expected save to succeed");
    }
    expect(saved.effective.content).toContain('"lang": "en"');

    const conflict = await saveScopedSettingsLayer({
      scope: "workspace",
      workspacePath,
      homeDir,
      layerId: projectLayer.layerId,
      content: '{\n  "lang": "zh"\n}\n',
      baseMtimeMs: file.mtimeMs,
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) {
      throw new Error("expected conflict response");
    }
    expect(conflict.reason).toBe("conflict");
  });

  test("Scenario: Given global scope graph When listing and saving user settings Then global effective payload remains scope-shaped", async () => {
    const { homeDir } = createFixture();
    writeJson(join(homeDir, ".agenter", "settings.json"), {
      avatar: "jon",
      lang: "en",
    });

    const graph = await listScopedSettingsGraph({
      scope: "global",
      homeDir,
    });
    const userLayer = graph.layers.find((layer) => layer.sourceId === "user");
    if (!userLayer) {
      throw new Error("expected global user layer");
    }
    expect(graph.effective.provenance["/avatar"]).toBeDefined();

    const file = await readScopedSettingsLayer({
      scope: "global",
      homeDir,
      layerId: userLayer.layerId,
    });
    expect(file.content).toContain('"avatar": "jon"');

    const saved = await saveScopedSettingsLayer({
      scope: "global",
      homeDir,
      layerId: userLayer.layerId,
      content: '{\n  "avatar": "nova",\n  "lang": "en"\n}\n',
      baseMtimeMs: file.mtimeMs,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      throw new Error("expected global save to succeed");
    }
    expect(saved.effective.content).toContain('"avatar": "nova"');
  });

  test("Scenario: Given a readonly scoped layer When saving Then scope save reports readonly semantics", async () => {
    const { workspacePath, homeDir } = createFixture();

    const graph = await listScopedSettingsGraph({
      scope: "workspace",
      workspacePath,
      homeDir,
      sources: ["mock://readonly/settings.json"],
    });
    const readonlyLayer = graph.layers.find((layer) => !layer.editable);
    if (!readonlyLayer) {
      throw new Error("expected readonly layer from mock source");
    }

    const saved = await saveScopedSettingsLayer({
      scope: "workspace",
      workspacePath,
      homeDir,
      sources: ["mock://readonly/settings.json"],
      layerId: readonlyLayer.layerId,
      content: "{}\n",
      baseMtimeMs: 0,
    });
    expect(saved.ok).toBe(false);
    if (saved.ok) {
      throw new Error("expected readonly response");
    }
    expect(saved.reason).toBe("readonly");
  });
});
