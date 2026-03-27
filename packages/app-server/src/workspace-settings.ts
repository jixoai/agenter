import {
  listScopedSettingsGraph,
  readScopedSettingsLayer,
  saveScopedSettingsLayer,
  type ScopedSettingsLayerFileResult,
  type ScopedSettingsLayerSnapshot,
} from "./settings-scope";

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

const toLegacyLayer = (layer: ScopedSettingsLayerSnapshot): SettingsLayerSnapshot => ({
  layerId: layer.layerId,
  sourceId: layer.sourceId,
  path: layer.path,
  exists: layer.exists,
  editable: layer.editable,
  readonlyReason: layer.readonlyReason,
});

const toLegacyFile = (file: ScopedSettingsLayerFileResult): SettingsLayerFileResult => ({
  layer: toLegacyLayer(file.layer),
  path: file.path,
  content: file.content,
  mtimeMs: file.mtimeMs,
});

export const listWorkspaceSettingsLayers = async (input: {
  workspacePath: string;
  avatar?: string;
}): Promise<SettingsLayersResult> => {
  const graph = await listScopedSettingsGraph({
    scope: "workspace",
    workspacePath: input.workspacePath,
    avatar: input.avatar,
  });
  return {
    effective: {
      content: graph.effective.content,
    },
    layers: graph.layers.map(toLegacyLayer),
  };
};

export const readWorkspaceSettingsLayer = async (input: {
  workspacePath: string;
  layerId: string;
  avatar?: string;
}): Promise<SettingsLayerFileResult> => {
  return toLegacyFile(
    await readScopedSettingsLayer({
      scope: "workspace",
      workspacePath: input.workspacePath,
      layerId: input.layerId,
      avatar: input.avatar,
    }),
  );
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
  const saved = await saveScopedSettingsLayer({
    scope: "workspace",
    workspacePath: input.workspacePath,
    layerId: input.layerId,
    content: input.content,
    baseMtimeMs: input.baseMtimeMs,
    avatar: input.avatar,
  });
  if (!saved.ok) {
    if (saved.reason === "readonly") {
      return saved;
    }
    return {
      ok: false,
      reason: "conflict",
      latest: toLegacyFile(saved.latest),
    };
  }
  return {
    ok: true,
    file: toLegacyFile(saved.file),
    effective: {
      content: saved.effective.content,
    },
  };
};
