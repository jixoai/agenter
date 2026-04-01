import { rmSync } from "node:fs";
import { resolve } from "node:path";

const cacheDir = resolve(process.cwd(), "node_modules/.vite/vitest");

// Browser-mode Vitest prebundles workspace packages under node_modules/.vite/vitest.
// Clearing it before Storybook DOM runs keeps @agenter/terminal-view changes from
// being hidden behind a stale prebundle.
rmSync(cacheDir, { force: true, recursive: true });
