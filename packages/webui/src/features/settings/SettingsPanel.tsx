import { useMemo, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

export interface SettingsLayerItem {
  layerId: string;
  sourceId: string;
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

interface SettingsPanelProps {
  disabled: boolean;
  status: string;
  effectiveContent: string;
  layers: SettingsLayerItem[];
  selectedLayerId: string | null;
  layerContent: string;
  onSelectLayer: (layerId: string) => void;
  onLayerContentChange: (content: string) => void;
  onRefreshLayers: () => void;
  onLoadLayer: () => void;
  onSaveLayer: () => void;
}

const layerTypeLabel = (sourceId: string): string => {
  if (sourceId === "user") {
    return "user";
  }
  if (sourceId === "project") {
    return "project";
  }
  if (sourceId === "local") {
    return "local";
  }
  return "source";
};

const tryParseJson = (input: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignored
  }
  return null;
};

const readPathString = (root: Record<string, unknown>, path: string[]): string => {
  let cursor: unknown = root;
  for (const token of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return "";
    }
    cursor = (cursor as Record<string, unknown>)[token];
  }
  return typeof cursor === "string" ? cursor : "";
};

const writePathString = (root: Record<string, unknown>, path: string[], value: string): Record<string, unknown> => {
  const cloned = structuredClone(root);
  let cursor: Record<string, unknown> = cloned;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  if (value.trim().length === 0) {
    delete cursor[last];
  } else {
    cursor[last] = value;
  }
  return cloned;
};

export const SettingsPanel = ({
  disabled,
  status,
  effectiveContent,
  layers,
  selectedLayerId,
  layerContent,
  onSelectLayer,
  onLayerContentChange,
  onRefreshLayers,
  onLoadLayer,
  onSaveLayer,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<"effective" | "layers">("effective");
  const selectedLayer = useMemo(
    () => layers.find((item) => item.layerId === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const editableJson = useMemo(() => tryParseJson(layerContent), [layerContent]);

  const patchVisualField = (path: string[], value: string) => {
    if (!editableJson) {
      return;
    }
    const patched = writePathString(editableJson, path, value);
    onLayerContentChange(`${JSON.stringify(patched, null, 2)}\n`);
  };

  return (
    <section className="flex h-full flex-col gap-3 overflow-hidden rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="typo-title-3 text-slate-900">Settings</h2>
        <Badge variant="secondary" className="max-w-[48ch] truncate">
          {status}
        </Badge>
      </div>

      <div className="inline-flex rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium",
            activeTab === "effective" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600",
          )}
          onClick={() => setActiveTab("effective")}
        >
          Effective (Read-only)
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium",
            activeTab === "layers" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600",
          )}
          onClick={() => setActiveTab("layers")}
        >
          Layer Sources
        </button>
      </div>

      {activeTab === "effective" ? (
        <div className="flex flex-1">
          <Textarea value={effectiveContent} readOnly className="min-h-[55dvh] resize-none font-mono text-xs" />
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[320px_1fr]">
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="typo-emphasis text-xs text-slate-700">Sources</p>
              <Button size="sm" variant="secondary" onClick={onRefreshLayers} disabled={disabled}>
                Refresh
              </Button>
            </div>
            <div className="h-full space-y-1 overflow-auto">
              {layers.length === 0 ? <p className="px-2 py-1 text-xs text-slate-500">No sources</p> : null}
              {layers.map((layer) => (
                <button
                  key={layer.layerId}
                  type="button"
                  onClick={() => onSelectLayer(layer.layerId)}
                  className={cn(
                    "w-full rounded-md border px-2 py-2 text-left",
                    layer.layerId === selectedLayerId
                      ? "border-teal-400 bg-teal-50"
                      : "border-slate-200 bg-white hover:bg-slate-100",
                  )}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <Badge variant="secondary">{layerTypeLabel(layer.sourceId)}</Badge>
                    {layer.editable ? (
                      <Badge variant="success">editable</Badge>
                    ) : (
                      <Badge variant="warning">readonly</Badge>
                    )}
                  </div>
                  <p className="line-clamp-2 text-[11px] break-all text-slate-700">{layer.path}</p>
                  {!layer.editable && layer.readonlyReason ? (
                    <p className="mt-1 text-[11px] text-amber-700">{layer.readonlyReason}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          <section className="flex h-full flex-1 flex-col gap-2 rounded-lg border border-slate-200 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="typo-emphasis text-xs text-slate-700">Layer editor</p>
                <p className="max-w-[60ch] truncate text-[11px] text-slate-500">
                  {selectedLayer?.path ?? "Select a source layer"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={onLoadLayer} disabled={disabled || !selectedLayerId}>
                  Load
                </Button>
                <Button size="sm" onClick={onSaveLayer} disabled={disabled || !selectedLayer?.editable}>
                  Save
                </Button>
              </div>
            </div>
            <Textarea
              value={layerContent}
              onChange={(event) => onLayerContentChange(event.target.value)}
              placeholder="Select a layer and load content"
              readOnly={!selectedLayer?.editable}
              className="min-h-[45dvh] resize-none font-mono text-xs"
            />
            {selectedLayer?.editable ? (
              <section className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="typo-emphasis text-xs text-slate-700">Quick fields</p>
                {editableJson ? (
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] text-slate-600">lang</span>
                      <Input
                        value={readPathString(editableJson, ["lang"])}
                        onChange={(event) => patchVisualField(["lang"], event.target.value)}
                        placeholder="en"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-slate-600">ai.activeProvider</span>
                      <Input
                        value={readPathString(editableJson, ["ai", "activeProvider"])}
                        onChange={(event) => patchVisualField(["ai", "activeProvider"], event.target.value)}
                        placeholder="default"
                      />
                    </label>
                    <label className="space-y-1 lg:col-span-2">
                      <span className="text-[11px] text-slate-600">terminal.outputRoot</span>
                      <Input
                        value={readPathString(editableJson, ["terminal", "outputRoot"])}
                        onChange={(event) => patchVisualField(["terminal", "outputRoot"], event.target.value)}
                        placeholder="./tmp"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">Visual fields require valid JSON content in the editor.</p>
                )}
              </section>
            ) : null}
          </section>
        </div>
      )}
    </section>
  );
};
