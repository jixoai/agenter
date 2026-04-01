export interface SettingsProvenanceOrigin {
  layerId: string;
  sourceId: string;
  kind: "default" | "file" | "avatar" | "derived";
  path: string;
  pointer: string;
  value: unknown;
  note?: string;
}

export interface SettingsPointerJumpTarget {
  layerId: string;
  pointer: string;
}

export interface SettingsProvenanceEntry {
  pointer: string;
  origins: SettingsProvenanceOrigin[];
  jumpTarget?: SettingsPointerJumpTarget;
}

export interface SettingsEffectiveGraph {
  content: string;
  value: unknown;
  schema: Record<string, unknown>;
  provenance: Record<string, SettingsProvenanceEntry>;
}

export interface SettingsLayerItem {
  layerId: string;
  sourceId: string;
  kind: "file" | "avatar";
  path: string;
  exists: boolean;
  editable: boolean;
  readonlyReason?: string;
}

export interface SettingsLayerFile {
  layer: SettingsLayerItem;
  path: string;
  content: string;
  mtimeMs: number;
}
