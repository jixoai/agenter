import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readStudioStaticDocumentTitle, resolveStudioStaticRoot } from "../src/static-root";
import { resolveWebChatAppViewExampleRoot } from "../src/run-studio";
import { startStudioHost, type StudioHostHandle } from "../src/studio-host";

const tempDirs: string[] = [];
const handles: StudioHostHandle[] = [];

const createPackageLayout = (input: { build: boolean }) => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-studio-static-"));
  tempDirs.push(dir);
  const sourceDir = join(dir, "src");
  const buildDir = join(dir, "build");
  mkdirSync(sourceDir, { recursive: true });
  if (input.build) {
    mkdirSync(buildDir, { recursive: true });
    writeFileSync(
      join(buildDir, "200.html"),
      "<!doctype html><html><head><title>studio build</title></head><body>studio</body></html>",
    );
  }
  return { sourceDir, buildDir };
};

describe("Feature: Studio static root", () => {
  test("Scenario: Given a Studio package build When resolving static root Then the package-owned build is used", () => {
    const layout = createPackageLayout({ build: true });

    const resolved = resolveStudioStaticRoot(layout.sourceDir);

    expect(resolved.kind).toBe("package-build");
    expect(resolved.staticDir).toBe(layout.buildDir);
    expect(readStudioStaticDocumentTitle(resolved.staticDir)).toBe("studio build");
  });

  test("Scenario: Given a Studio package without a build When resolving static root Then startup fails with Studio build guidance", () => {
    const layout = createPackageLayout({ build: false });

    expect(() => resolveStudioStaticRoot(layout.sourceDir)).toThrow(
      "run `bun run --filter 'agenter-app-studio' build` before `agenter studio`",
    );
  });

  test("Scenario: Given Studio owns static serving When starting the host Then health and runtime env stay app-owned", async () => {
    const layout = createPackageLayout({ build: true });
    const handle = await startStudioHost({
      webHost: "127.0.0.1",
      port: 0,
      staticDir: layout.buildDir,
      daemonEndpoint: "http://127.0.0.1:4580",
      publicEnv: {
        PUBLIC_AGENTER_WS_URL: "ws://127.0.0.1:4580/trpc",
      },
    });
    handles.push(handle);

    const health = await fetch(`${handle.url}/health`);
    const healthJson = (await health.json()) as { ok?: boolean; app?: string };
    expect(health.status).toBe(200);
    expect(healthJson).toEqual({ ok: true, app: "studio" });

    const envResponse = await fetch(`${handle.url}/_app/env.js`);
    const envSource = await envResponse.text();
    expect(envResponse.status).toBe(200);
    expect(envSource).toContain("PUBLIC_AGENTER_WS_URL");
    expect(envSource).toContain("ws://127.0.0.1:4580/trpc");
  });

  test("Scenario: Given Studio lives under extensions When resolving the app-view dev root Then it points at the web-chat-view example package", () => {
    const root = resolveWebChatAppViewExampleRoot();

    expect(root.endsWith("packages/web-chat-view/example/")).toBe(true);
    expect(existsSync(join(root, "package.json"))).toBe(true);
  });
});

afterAll(async () => {
  for (const handle of handles.splice(0)) {
    await handle.stop();
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});
