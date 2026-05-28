import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const packageRoot = process.cwd();
const playwrightEntrypointCandidates = [
  path.resolve(packageRoot, "node_modules/.bun/playwright@1.59.1/node_modules/playwright/index.mjs"),
  path.resolve(packageRoot, "../../node_modules/.bun/playwright@1.59.1/node_modules/playwright/index.mjs"),
  path.resolve(packageRoot, "../../../node_modules/.bun/playwright@1.59.1/node_modules/playwright/index.mjs"),
];

const normalizeRelativeOutput = (value: string): string =>
  value.replace(/\\/gu, "/").replace(/^\.?\/?packages\/web-chat-view\//u, "");

export const resolveReviewUrl = (fallback: string): string => process.env.WEB_CHAT_VIEW_REVIEW_URL?.trim() || fallback;

export const resolveScreenshotDir = (fallbackRelativeDir: string): string => {
  const requestedDir = process.env.WEB_CHAT_VIEW_SCREENSHOT_DIR?.trim();
  const outputDir = requestedDir
    ? path.resolve(packageRoot, normalizeRelativeOutput(requestedDir))
    : path.resolve(packageRoot, fallbackRelativeDir);
  mkdirSync(outputDir, { recursive: true });
  return outputDir;
};

export const importPlaywright = async () => {
  const playwrightPath = playwrightEntrypointCandidates.find((candidate) => existsSync(candidate));
  if (!playwrightPath) {
    throw new Error(`Unable to locate Playwright entrypoint from: ${playwrightEntrypointCandidates.join(", ")}`);
  }
  return import(pathToFileURL(playwrightPath).href);
};
