import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
export {
  RUNTIME_TEXT_KEYS,
  runtimeTextCatalogSchema,
  type RuntimeTextCatalog,
  type RuntimeTextId,
} from "./runtime-text";

export type PromptSyntax = "md" | "mdx";

export interface PromptDocument {
  syntax: PromptSyntax;
  content: string;
}

export const PROMPT_DOC_KEYS = ["AGENTER", "AGENTER_SYSTEM", "SYSTEM_TEMPLATE", "RESPONSE_CONTRACT"] as const;
export type PromptDocKey = (typeof PROMPT_DOC_KEYS)[number];
export type PromptDocRecord = Record<PromptDocKey, PromptDocument>;

export const promptDocumentSchema = z.object({
  syntax: z.enum(["md", "mdx"]),
  content: z.string(),
});

export const promptDocRecordSchema = z.object({
  AGENTER: promptDocumentSchema,
  AGENTER_SYSTEM: promptDocumentSchema,
  SYSTEM_TEMPLATE: promptDocumentSchema,
  RESPONSE_CONTRACT: promptDocumentSchema,
});

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const readTrimmed = async (path: string): Promise<string> => {
  const content = await readFile(path, "utf8");
  return content.trim();
};

const resolvePromptPath = async (promptsDir: string, key: PromptDocKey): Promise<{ path: string; syntax: PromptSyntax } | null> => {
  const mdxPath = join(promptsDir, `${key}.mdx`);
  if (await exists(mdxPath)) {
    return { path: mdxPath, syntax: "mdx" };
  }
  const mdPath = join(promptsDir, `${key}.md`);
  if (await exists(mdPath)) {
    return { path: mdPath, syntax: "md" };
  }
  return null;
};

export const buildPromptDocsFromDir = async (promptsDir: string): Promise<PromptDocRecord> => {
  const entries = await Promise.all(
    PROMPT_DOC_KEYS.map(async (key) => {
      const resolved = await resolvePromptPath(promptsDir, key);
      if (!resolved) {
        if (key === "AGENTER") {
          return [key, { syntax: "mdx", content: "" }] as const;
        }
        throw new Error(`missing prompt file for ${key} in ${promptsDir}; expected ${key}.mdx or ${key}.md`);
      }
      const content = await readTrimmed(resolved.path);
      return [key, { syntax: resolved.syntax, content }] as const;
    }),
  );
  return promptDocRecordSchema.parse(Object.fromEntries(entries));
};

export const writePromptJson = async (outputPath: string, docs: PromptDocRecord): Promise<void> => {
  await mkdir(dirname(outputPath), { recursive: true });
  const normalized = promptDocRecordSchema.parse(docs);
  const json = JSON.stringify(normalized, null, 2);
  await writeFile(outputPath, `${json}\n`, "utf8");
};

export const buildPromptJson = async (input: { promptsDir: string; outputPath: string }): Promise<PromptDocRecord> => {
  const docs = await buildPromptDocsFromDir(input.promptsDir);
  await writePromptJson(input.outputPath, docs);
  return docs;
};

export const loadPromptJson = async (path: string): Promise<PromptDocRecord> => {
  const text = await readFile(path, "utf8");
  return promptDocRecordSchema.parse(JSON.parse(text) as unknown);
};
