import { mkdirSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type EditableKind = "settings" | "agenter";

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

export const resolveEditableSettingsPath = (
  cwd: string,
  kind: EditableKind,
  prompt: {
    rootDir?: string;
    agenterPath?: string;
  },
): string => {
  if (kind === "settings") {
    return resolve(cwd, ".agenter", "settings.json");
  }
  if (kind === "agenter") {
    const agenterPath = prompt.agenterPath ?? (prompt.rootDir ? resolve(prompt.rootDir, "AGENTER.mdx") : undefined);
    if (!agenterPath) {
      throw new Error("avatar AGENTER.mdx path is unavailable");
    }
    return agenterPath;
  }
  return resolve(cwd, ".agenter", "settings.json");
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
      rootDir?: string;
      agenterPath?: string;
    },
  ) {}

  resolvePath(kind: EditableKind): string {
    return resolveEditableSettingsPath(this.cwd, kind, this.promptPaths);
  }

  async read(kind: EditableKind): Promise<EditableFileResult> {
    const path = this.resolvePath(kind);
    return readMaybe(path);
  }

  async save(
    kind: EditableKind,
    content: string,
    baseMtimeMs: number,
  ): Promise<EditableSaveResult | EditableConflictResult> {
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
