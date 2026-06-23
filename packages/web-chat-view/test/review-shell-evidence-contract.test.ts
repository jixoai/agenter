import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const rootPackageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
  workspaces?: string[];
};
const pnpmWorkspaceSource = readFileSync(resolve(repoRoot, "pnpm-workspace.yaml"), "utf8");
const examplePackageJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../example/package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
};
const reviewShellClientSource = readFileSync(
  resolve(import.meta.dirname, "../example/src/lib/review-shell-client.svelte"),
  "utf8",
);
const reviewShellRouteSource = readFileSync(
  resolve(import.meta.dirname, "../example/src/routes/+page.svelte"),
  "utf8",
);
const captureShellScriptSource = readFileSync(
  resolve(import.meta.dirname, "../example/scripts/capture-review-shell.ts"),
  "utf8",
);
const captureOverlaysScriptSource = readFileSync(
  resolve(import.meta.dirname, "../example/scripts/capture-review-overlays.ts"),
  "utf8",
);
const resourceTokenSource = readFileSync(
  resolve(import.meta.dirname, "../src/components/message-markdown-resource-token.svelte"),
  "utf8",
);
const resourceCardSource = readFileSync(resolve(import.meta.dirname, "../src/resource-card.svelte"), "utf8");

describe("Feature: web-chat-view review shell evidence closure", () => {
  test("Scenario: Given the nested Framework7 example When dependencies are installed from the repo root Then the icon font package is workspace-owned and route-resolvable", () => {
    expect(rootPackageJson.workspaces).toContain("packages/web-chat-view/example");
    expect(pnpmWorkspaceSource).toContain("- packages/web-chat-view/example");
    expect(examplePackageJson.dependencies).toMatchObject({
      "framework7-icons": "^5.0.5",
    });
    expect(reviewShellRouteSource).toContain('import "framework7-icons/css/framework7-icons.css";');
  });

  test("Scenario: Given the review shell renders Framework7 navigation When visible text is captured Then implementation icon names are treated as forbidden evidence text", () => {
    const forbiddenVisibleIconNames = [
      "chat_bubble_2_fill",
      "person_2_fill",
      "tray_2_fill",
      "ellipsis",
    ];

    expect(captureShellScriptSource).toContain("forbiddenVisibleIconNames");
    for (const iconName of forbiddenVisibleIconNames) {
      expect(captureShellScriptSource).toContain(iconName);
    }
    expect(reviewShellClientSource).toContain("aria-hidden");
  });

  test("Scenario: Given the iPhone source detail evidence When the screenshot flow opens a child page Then it asserts complete child-page ownership before capture", () => {
    expect(captureShellScriptSource).toContain("assertMobileChildPageIntegrity");
    expect(captureShellScriptSource).toContain("review-shell-tabbar");
    expect(captureShellScriptSource).toContain("page-current");
    expect(captureShellScriptSource).toContain("Source Details");
  });

  test("Scenario: Given inline and aggregated message resources When overlay screenshots open previews Then both entrypoints use stable accessible labels", () => {
    expect(resourceTokenSource).toContain('aria-label={`Open ${resource.kind} resource ${resource.label}`}');
    expect(resourceCardSource).toContain('aria-label={`Open ${resource.kind} resource ${resource.label}`}');
    expect(captureOverlaysScriptSource).toContain("locateResourceEntrypoint");
    expect(captureOverlaysScriptSource).toContain('byAriaLabel("message-resource-token"');
    expect(captureOverlaysScriptSource).toContain('byAriaLabel("resource-card-hitbox"');
    expect(captureOverlaysScriptSource).toContain('"Open image resource Image 1"');
    expect(captureOverlaysScriptSource).toContain('"Open file resource File 2"');
  });
});
