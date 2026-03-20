import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSettings } from "@agenter/settings";

export interface SettingsLayerSnapshot {
  layerId: string;
  sourceId: string;
  path: string;
  exists: boolean;
  editable: boolean;
  readonlyReason?: string;
}

export interface SettingsLayersResult {
  effective: {
    content: string;
  };
  layers: SettingsLayerSnapshot[];
}

export interface SettingsLayerFileResult {
  layer: SettingsLayerSnapshot;
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

const resolveLayerFilePath = (workspacePath: string, path: string): string | null => {
  if (isAbsolute(path)) {
    return path;
  }
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
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

const readLayerFile = async (workspacePath: string, layer: SettingsLayerSnapshot): Promise<SettingsLayerFileResult> => {
  const filePath = resolveLayerFilePath(workspacePath, layer.path);
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

export const listWorkspaceSettingsLayers = async (input: {
  workspacePath: string;
  avatar?: string;
}): Promise<SettingsLayersResult> => {
  const workspacePath = resolve(input.workspacePath);
  const loaded = await loadSettings({
    projectRoot: workspacePath,
    cwd: workspacePath,
    avatar: input.avatar,
  });

  return {
    effective: {
      content: JSON.stringify(loaded.settings, null, 2),
    },
    layers: loaded.meta.sources.map((source, index) => {
      const editable = isEditableLayerPath(source.path);
      return {
        layerId: `${index}:${source.id}`,
        sourceId: source.id,
        path: source.path,
        exists: source.exists,
        editable,
        readonlyReason: editable ? undefined : "remote settings source",
      };
    }),
  };
};

export const readWorkspaceSettingsLayer = async (input: {
  workspacePath: string;
  layerId: string;
  avatar?: string;
}): Promise<SettingsLayerFileResult> => {
  const layers = await listWorkspaceSettingsLayers(input);
  const layer = layers.layers.find((item) => item.layerId === input.layerId);
  if (!layer) {
    throw new Error(`settings layer not found: ${input.layerId}`);
  }
  return await readLayerFile(resolve(input.workspacePath), layer);
};

export const saveWorkspaceSettingsLayer = async (input: {
  workspacePath: string;
  layerId: string;
  content: string;
  baseMtimeMs: number;
  avatar?: string;
}): Promise<
  | {
      ok: true;
      file: SettingsLayerFileResult;
      effective: { content: string };
    }
  | {
      ok: false;
      reason: "conflict";
      latest: SettingsLayerFileResult;
    }
  | { ok: false; reason: "readonly"; message: string }
> => {
  const workspacePath = resolve(input.workspacePath);
  const layers = await listWorkspaceSettingsLayers({
    workspacePath,
    avatar: input.avatar,
  });
  const layer = layers.layers.find((item) => item.layerId === input.layerId);
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

  const current = await readLayerFile(workspacePath, layer);
  if (Math.abs(current.mtimeMs - input.baseMtimeMs) > 0.5) {
    return {
      ok: false,
      reason: "conflict",
      latest: current,
    };
  }

  await mkdir(dirname(current.path), { recursive: true });
  await writeFile(current.path, input.content, "utf8");

  const file = await readLayerFile(workspacePath, layer);
  const effective = await listWorkspaceSettingsLayers({
    workspacePath,
    avatar: input.avatar,
  });

  return {
    ok: true,
    file,
    effective: {
      content: effective.effective.content,
    },
  };
};
