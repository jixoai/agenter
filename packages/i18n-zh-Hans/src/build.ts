import { buildPromptJson } from "@agenter/i18n-core";

const rootDir = decodeURIComponent(new URL("..", import.meta.url).pathname);
const promptsDir = `${rootDir}/prompts`;
const outputPath = `${rootDir}/prompts.json`;

await buildPromptJson({ promptsDir, outputPath });
