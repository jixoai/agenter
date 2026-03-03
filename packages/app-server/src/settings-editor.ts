import { mkdirSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type EditableKind = "settings" | "agenter" | "system" | "template" | "contract";

export interface EditableFileResult {
  path: string;
  content: string;
  mtimeMs: number;
}

export interface EditableConflictResult {
  ok: false;
  reason: "conflict";
  latest: EditableFileResult;
}

export interface EditableSaveResult {
  ok: true;
  file: EditableFileResult;
}

const pathByKind = (cwd: string, kind: EditableKind, prompt: {
  agenterPath?: string;
  agenterSystemPath?: string;
  systemTemplatePath?: string;
  responseContractPath?: string;
}): string => {
  if (kind === "settings") {
    return resolve(cwd, ".agenter", "settings.json");
  }
  if (kind === "agenter") {
    return prompt.agenterPath ?? resolve(cwd, ".agenter", "AGENTER.mdx");
  }
  if (kind === "system") {
    return prompt.agenterSystemPath ?? resolve(cwd, ".agenter", "internal", "AGENTER_SYSTEM.mdx");
  }
  if (kind === "template") {
    return prompt.systemTemplatePath ?? resolve(cwd, ".agenter", "internal", "SYSTEM_TEMPLATE.mdx");
  }
  return prompt.responseContractPath ?? resolve(cwd, ".agenter", "internal", "RESPONSE_CONTRACT.mdx");
};

const readMaybe = async (path: string): Promise<EditableFileResult> => {
  try {
    const [text, fileStat] = await Promise.all([readFile(path, "utf8"), stat(path)]);
    return {
      path,
      content: text,
      mtimeMs: fileStat.mtimeMs,
    };
  } catch {
    return {
      path,
      content: "",
      mtimeMs: 0,
    };
  }
};

export class SettingsEditor {
  constructor(
    private readonly cwd: string,
    private readonly promptPaths: {
      agenterPath?: string;
      agenterSystemPath?: string;
      systemTemplatePath?: string;
      responseContractPath?: string;
    },
  ) {}

  resolvePath(kind: EditableKind): string {
    return pathByKind(this.cwd, kind, this.promptPaths);
  }

  async read(kind: EditableKind): Promise<EditableFileResult> {
    const path = this.resolvePath(kind);
    return readMaybe(path);
  }

  async save(kind: EditableKind, content: string, baseMtimeMs: number): Promise<EditableSaveResult | EditableConflictResult> {
    const path = this.resolvePath(kind);
    const current = await readMaybe(path);
    if (Math.abs(current.mtimeMs - baseMtimeMs) > 0.5) {
      return {
        ok: false,
        reason: "conflict",
        latest: current,
      };
    }

    mkdirSync(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
    const next = await readMaybe(path);
    return {
      ok: true,
      file: next,
    };
  }
}
