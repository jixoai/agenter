import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const codemirrorDedupe = [
  "@codemirror/autocomplete",
  "@codemirror/lang-markdown",
  "@codemirror/language",
  "@codemirror/language-data",
  "@codemirror/state",
  "@codemirror/view",
];

const appSveltePackages = [
  "@agenter/svelte-components",
  "@agenter/terminal-view",
  "@agenter/web-chat-view",
  "@agenter/web-components",
  "@lucide/svelte",
  "bits-ui",
  "shadcn-svelte",
];

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const resolveHarnessTemplateRoot = (templateDirName: string): string => path.join(moduleDir, templateDirName);

const runCommand = async (cwd: string, command: string[]): Promise<string> => {
  const proc = Bun.spawn(command, {
    cwd,
    env: process.env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed in ${cwd}\n${stderr || stdout}`);
  }
  return stdout.trim();
};

const renderViteConfig = (targetRoot: string): string => {
  const bitsUiPluginPath = path.join(targetRoot, "packages/studio/vite.bits-ui-style-plugin.ts");
  return `import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { bitsUiVirtualStylePlugin } from ${JSON.stringify(bitsUiPluginPath)};

const targetRoot = ${JSON.stringify(targetRoot)};
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const codemirrorDedupe = ${JSON.stringify(codemirrorDedupe, null, 2)};
const appSveltePackages = ${JSON.stringify(appSveltePackages, null, 2)};

export default defineConfig({
  root: rootDir,
  plugins: [bitsUiVirtualStylePlugin(), tailwindcss(), svelte()],
  resolve: {
    alias: {
      "$lib": path.join(targetRoot, "packages/studio/src/lib"),
      "@perf-target-layout-css": path.join(targetRoot, "packages/studio/src/routes/layout.css"),
      "@perf-target-web-chat-view": path.join(targetRoot, "packages/web-chat-view/src"),
      "@perf-target-studio-runtime": path.join(targetRoot, "packages/studio/src/lib/features/runtime"),
    },
    dedupe: codemirrorDedupe,
  },
  optimizeDeps: {
    exclude: appSveltePackages,
  },
  server: {
    host: "127.0.0.1",
    fs: {
      allow: [targetRoot],
    },
  },
  build: {
    cssMinify: false,
    minify: false,
  },
});
`;
};

export const resolveRepoRoot = async (cwd: string): Promise<string> => {
  return await runCommand(cwd, ["git", "rev-parse", "--show-toplevel"]);
};

export const createBaselineWorktree = async (
  repoRoot: string,
): Promise<{ cleanup: () => Promise<void>; root: string }> => {
  const baselineRoot = await mkdtemp(path.join(os.tmpdir(), "agenter-reverse-flow-baseline-"));
  await runCommand(repoRoot, ["git", "worktree", "add", "--detach", baselineRoot, "HEAD"]);
  await runCommand(baselineRoot, ["pnpm", "install", "--no-frozen-lockfile"]);
  return {
    root: baselineRoot,
    cleanup: async () => {
      try {
        await runCommand(repoRoot, ["git", "worktree", "remove", "--force", baselineRoot]);
      } finally {
        await rm(baselineRoot, { force: true, recursive: true });
      }
    },
  };
};

export const prepareHarnessRoot = async (input: {
  label: string;
  targetRoot: string;
  templateDirName?: string;
}): Promise<string> => {
  const harnessRoot = path.join(
    input.targetRoot,
    "packages",
    "studio",
    ".tmp",
    "reverse-flow-conversation-harness",
    input.label,
  );
  await rm(harnessRoot, { force: true, recursive: true });
  await mkdir(harnessRoot, { recursive: true });
  await cp(resolveHarnessTemplateRoot(input.templateDirName ?? "harness"), harnessRoot, { recursive: true });
  await writeFile(path.join(harnessRoot, "vite.config.ts"), renderViteConfig(input.targetRoot));
  return harnessRoot;
};
