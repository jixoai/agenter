import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSettings, type SettingsProvenanceEntry, type SettingsSourceInput } from "@agenter/settings";

export type SettingsScope = "workspace" | "global";

export interface ScopedSettingsLayerSnapshot {
  layerId: string;
  sourceId: string;
  kind: "file" | "avatar";
  path: string;
  exists: boolean;
  editable: boolean;
  readonlyReason?: string;
}

export interface ScopedSettingsGraphResult {
  scope: SettingsScope;
  effective: {
    content: string;
    value: unknown;
    schema: Record<string, unknown>;
    provenance: Record<string, SettingsProvenanceEntry>;
  };
  layers: ScopedSettingsLayerSnapshot[];
}

export interface ScopedSettingsLayerFileResult {
  layer: ScopedSettingsLayerSnapshot;
  path: string;
  content: string;
  mtimeMs: number;
}

const isEditableLayerPath = (path: string): boolean => {
  if (isAbsolute(path) || path.startsWith("~/")) {
    return true;
  }
  if (path.startsWith("file://")) {
    return true;
  }
  return !/^[a-z][a-z0-9+.-]*:\/\//i.test(path);
};

const resolveLayerFilePath = (workspacePath: string, path: string, homeDir: string): string | null => {
  if (isAbsolute(path)) {
    return path;
  }
  if (path.startsWith("~/")) {
    return join(homeDir, path.slice(2));
  }
  if (path.startsWith("file://")) {
    try {
      return fileURLToPath(path);
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
    return null;
  }
  return resolve(workspacePath, path);
};

const readLayerFile = async (
  workspacePath: string,
  layer: ScopedSettingsLayerSnapshot,
  homeDir: string,
): Promise<ScopedSettingsLayerFileResult> => {
  const filePath = resolveLayerFilePath(workspacePath, layer.path, homeDir);
  if (!filePath) {
    return {
      layer,
      path: layer.path,
      content: "",
      mtimeMs: 0,
    };
  }
  try {
    const [content, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    return {
      layer,
      path: filePath,
      content,
      mtimeMs: info.mtimeMs,
    };
  } catch {
    return {
      layer,
      path: filePath,
      content: "",
      mtimeMs: 0,
    };
  }
};

const attachJumpTargets = (
  input: {
    provenance: Record<string, SettingsProvenanceEntry>;
    layers: ScopedSettingsLayerSnapshot[];
  },
): Record<string, SettingsProvenanceEntry> => {
  const layerMap = new Map(input.layers.map((layer) => [layer.layerId, layer] as const));
  const entries = Object.entries(input.provenance).map(([pointer, entry]) => {
    let editableTarget: { layerId: string; pointer: string } | undefined;
    let fileFallbackTarget: { layerId: string; pointer: string } | undefined;
    let anyFallbackTarget: { layerId: string; pointer: string } | undefined;
    for (let index = entry.origins.length - 1; index >= 0; index -= 1) {
      const origin = entry.origins[index];
      if (!origin) {
        continue;
      }
      const layer = layerMap.get(origin.layerId);
      if (!layer) {
        continue;
      }
      if (!anyFallbackTarget) {
        anyFallbackTarget = {
          layerId: layer.layerId,
          pointer: origin.pointer,
        };
      }
      if (!fileFallbackTarget && layer.kind === "file") {
        fileFallbackTarget = {
          layerId: layer.layerId,
          pointer: origin.pointer,
        };
      }
      if (layer.editable && layer.kind === "file") {
        editableTarget = {
          layerId: layer.layerId,
          pointer: origin.pointer,
        };
        break;
      }
    }
    return [
      pointer,
      {
        ...entry,
        origins: entry.origins.map((origin) => ({ ...origin })),
        jumpTarget: editableTarget ?? fileFallbackTarget ?? anyFallbackTarget,
      },
    ] as const;
  });
  return Object.fromEntries(entries);
};

const resolveScopeLoadContext = (input: { scope: SettingsScope; workspacePath?: string; homeDir: string }): {
  projectRoot: string;
  cwd: string;
  sources?: Array<"user">;
} => {
  if (input.scope === "workspace") {
    if (!input.workspacePath) {
      throw new Error("workspacePath is required for workspace settings scope");
    }
    const workspacePath = resolve(input.workspacePath);
    return {
      projectRoot: workspacePath,
      cwd: workspacePath,
    };
  }
  const home = input.homeDir;
  return {
    projectRoot: home,
    cwd: home,
    sources: ["user"],
  };
};

const isScopedSettingsLayer = (
  layer: (Awaited<ReturnType<typeof loadSettings>>["graph"]["layers"])[number],
): layer is (Awaited<ReturnType<typeof loadSettings>>["graph"]["layers"])[number] & {
  kind: ScopedSettingsLayerSnapshot["kind"];
} => {
  return layer.kind === "file" || layer.kind === "avatar";
};

export const listScopedSettingsGraph = async (input: {
  scope: SettingsScope;
  workspacePath?: string;
  avatar?: string;
  homeDir?: string;
  sources?: SettingsSourceInput[];
}): Promise<ScopedSettingsGraphResult> => {
  const home = input.homeDir ?? homedir();
  const context = resolveScopeLoadContext({
    scope: input.scope,
    workspacePath: input.workspacePath,
    homeDir: home,
  });
  const loaded = await loadSettings({
    projectRoot: context.projectRoot,
    cwd: context.cwd,
    avatar: input.avatar,
    sources: input.sources ?? context.sources,
    homeDir: home,
  });
  const layers = loaded.graph.layers
    .filter(isScopedSettingsLayer)
    .map((layer) => {
      const editable = isEditableLayerPath(layer.path);
      return {
        layerId: layer.layerId,
        sourceId: layer.sourceId,
        kind: layer.kind,
        path: layer.path,
        exists: layer.exists,
        editable,
        readonlyReason: editable ? undefined : "remote settings source",
      } satisfies ScopedSettingsLayerSnapshot;
    });

  return {
    scope: input.scope,
    effective: {
      content: loaded.graph.effective.content,
      value: loaded.graph.effective.value,
      schema: loaded.graph.schema,
      provenance: attachJumpTargets({
        provenance: loaded.graph.provenance,
        layers,
      }),
    },
    layers,
  };
};

export const readScopedSettingsLayer = async (input: {
  scope: SettingsScope;
  workspacePath?: string;
  layerId: string;
  avatar?: string;
  homeDir?: string;
  sources?: SettingsSourceInput[];
}): Promise<ScopedSettingsLayerFileResult> => {
  const graph = await listScopedSettingsGraph(input);
  const layer = graph.layers.find((item) => item.layerId === input.layerId);
  if (!layer) {
    throw new Error(`settings layer not found: ${input.layerId}`);
  }
  const home = input.homeDir ?? homedir();
  const workspacePath = input.scope === "workspace" ? resolve(input.workspacePath ?? ".") : home;
  return await readLayerFile(workspacePath, layer, home);
};

export const saveScopedSettingsLayer = async (input: {
  scope: SettingsScope;
  workspacePath?: string;
  layerId: string;
  content: string;
  baseMtimeMs: number;
  avatar?: string;
  homeDir?: string;
  sources?: SettingsSourceInput[];
}): Promise<
  | {
      ok: true;
      file: ScopedSettingsLayerFileResult;
      effective: ScopedSettingsGraphResult["effective"];
    }
  | {
      ok: false;
      reason: "conflict";
      latest: ScopedSettingsLayerFileResult;
    }
  | { ok: false; reason: "readonly"; message: string }
> => {
  const graph = await listScopedSettingsGraph(input);
  const layer = graph.layers.find((item) => item.layerId === input.layerId);
  if (!layer) {
    throw new Error(`settings layer not found: ${input.layerId}`);
  }
  if (!layer.editable) {
    return {
      ok: false,
      reason: "readonly",
      message: layer.readonlyReason ?? "readonly settings source",
    };
  }

  const home = input.homeDir ?? homedir();
  const workspacePath = input.scope === "workspace" ? resolve(input.workspacePath ?? ".") : home;
  const current = await readLayerFile(workspacePath, layer, home);
  if (Math.abs(current.mtimeMs - input.baseMtimeMs) > 0.5) {
    return {
      ok: false,
      reason: "conflict",
      latest: current,
    };
  }

  await mkdir(dirname(current.path), { recursive: true });
  await writeFile(current.path, input.content, "utf8");

  const file = await readLayerFile(workspacePath, layer, home);
  const refreshed = await listScopedSettingsGraph({
    scope: input.scope,
    workspacePath: input.workspacePath,
    avatar: input.avatar,
    homeDir: input.homeDir,
    sources: input.sources,
  });

  return {
    ok: true,
    file,
    effective: refreshed.effective,
  };
};
