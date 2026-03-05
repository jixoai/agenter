import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_DOC_KEYS, runtimeTextCatalogSchema, type PromptDocRecord, type RuntimeTextCatalog } from "@agenter/i18n-core";

export const LANG = "en";
export const PROMPTS_PATH = new URL("../prompts.json", import.meta.url);
export const RUNTIME_TEXTS_PATH = new URL("../runtime.json", import.meta.url);

const rootDir = decodeURIComponent(new URL("..", import.meta.url).pathname);

const loadFromPromptsDir = (): PromptDocRecord => {
  const entries = PROMPT_DOC_KEYS.map((key) => {
    const mdxPath = join(rootDir, "prompts", `${key}.mdx`);
    if (existsSync(mdxPath)) {
      return [key, { syntax: "mdx", content: readFileSync(mdxPath, "utf8").trim() }] as const;
    }
    const mdPath = join(rootDir, "prompts", `${key}.md`);
    if (existsSync(mdPath)) {
      return [key, { syntax: "md", content: readFileSync(mdPath, "utf8").trim() }] as const;
    }
    if (key === "AGENTER") {
      return [key, { syntax: "mdx", content: "" }] as const;
    }
    throw new Error(`missing prompt source: ${key}.mdx|${key}.md`);
  });
  return Object.fromEntries(entries) as PromptDocRecord;
};

export const PROMPTS = existsSync(join(rootDir, "prompts")) && existsSync(join(rootDir, "prompts", "AGENTER_SYSTEM.mdx"))
  ? loadFromPromptsDir()
  : (JSON.parse(readFileSync(decodeURIComponent(PROMPTS_PATH.pathname), "utf8")) as PromptDocRecord);

export const RUNTIME_TEXTS: RuntimeTextCatalog = runtimeTextCatalogSchema.parse(
  JSON.parse(readFileSync(decodeURIComponent(RUNTIME_TEXTS_PATH.pathname), "utf8")) as unknown,
);
