import { useEffect, useMemo, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Sheet } from "../../components/ui/sheet";
import { Skeleton } from "../../components/ui/skeleton";
import { Tabs, type TabItem } from "../../components/ui/tabs";
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
  loading: boolean;
  status: string;
  effectiveContent: string;
  layers: SettingsLayerItem[];
  selectedLayerId: string | null;
  layerContent: string;
  detailMode?: "split" | "sheet";
  onSelectLayer: (layerId: string) => void;
  onLayerContentChange: (content: string) => void;
  onRefreshLayers: () => void;
  onLoadLayer: () => void;
  onSaveLayer: () => void;
}

const SETTINGS_TABS: TabItem[] = [
  { id: "effective", label: "Effective" },
  { id: "layers", label: "Layer Sources" },
];

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

const LoadingShell = () => (
  <div className="space-y-3">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="mt-3 h-10 w-full" />
      <Skeleton className="mt-2 h-10 w-full" />
      <Skeleton className="mt-2 h-10 w-full" />
    </div>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-48 w-full" />
    </div>
  </div>
);

export const SettingsPanel = ({
  disabled,
  loading,
  status,
  effectiveContent,
  layers,
  selectedLayerId,
  layerContent,
  detailMode = "split",
  onSelectLayer,
  onLayerContentChange,
  onRefreshLayers,
  onLoadLayer,
  onSaveLayer,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<"effective" | "layers">("effective");
  const [detailOpen, setDetailOpen] = useState(false);
  const selectedLayer = useMemo(
    () => layers.find((item) => item.layerId === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const editableJson = useMemo(() => tryParseJson(layerContent), [layerContent]);
  const showSplitDetail = detailMode === "split";

  const selectLayer = (layerId: string) => {
    onSelectLayer(layerId);
    if (detailMode === "sheet") {
      setDetailOpen(true);
    }
  };

  const patchVisualField = (path: string[], value: string) => {
    if (!editableJson) {
      return;
    }
    const patched = writePathString(editableJson, path, value);
    onLayerContentChange(`${JSON.stringify(patched, null, 2)}\n`);
  };

  const hasData = activeTab === "effective" ? effectiveContent.trim().length > 0 : layers.length > 0;

  useEffect(() => {
    if (activeTab !== "layers" || detailMode !== "sheet") {
      setDetailOpen(false);
      return;
    }
    if (selectedLayerId) {
      setDetailOpen(true);
    }
  }, [activeTab, detailMode, selectedLayerId]);

  const layerEditor = (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 rounded-xl border border-slate-200 p-2">
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
        className="h-full resize-none font-mono text-xs"
      />
      {selectedLayer?.editable ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
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
  );

  return (
    <section className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white/96 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="typo-title-3 text-slate-900">Settings</h2>
          <p className="text-xs text-slate-500">Merged settings stay read-only. Each source layer remains editable independently.</p>
        </div>
        <Badge variant="secondary" className="max-w-[48ch] truncate">
          {status}
        </Badge>
      </div>

      <Tabs items={SETTINGS_TABS} value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} />

      <AsyncSurface
        state={resolveAsyncSurfaceState({ loading, hasData })}
        loadingOverlayLabel={activeTab === "effective" ? "Refreshing settings..." : "Refreshing layers..."}
        skeleton={<LoadingShell />}
        empty={
          <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
            {activeTab === "effective" ? "No merged settings available yet." : "No settings sources discovered for this workspace."}
          </div>
        }
        className="h-full"
      >
        {activeTab === "effective" ? (
          <div className="h-full">
            <Textarea value={effectiveContent} readOnly className="h-full resize-none font-mono text-xs" />
          </div>
        ) : (
          <div className={cn("grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3", showSplitDetail ? "xl:grid-cols-[320px_minmax(0,1fr)]" : "")}>
            <section className="grid grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="typo-emphasis text-xs text-slate-700">Sources</p>
                <Button size="sm" variant="secondary" onClick={onRefreshLayers} disabled={disabled}>
                  Refresh
                </Button>
              </div>
              <ScrollViewport data-testid="settings-sources-scroll-viewport" className="h-full space-y-1">
                {layers.map((layer) => (
                  <button
                    key={layer.layerId}
                    type="button"
                    onClick={() => selectLayer(layer.layerId)}
                    className={
                      layer.layerId === selectedLayerId
                        ? "w-full rounded-md border border-teal-300 bg-teal-50 px-2 py-2 text-left"
                        : "w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-left hover:bg-slate-100"
                    }
                  >
                    <div className="mb-1 flex items-center gap-1">
                      <Badge variant="secondary">{layerTypeLabel(layer.sourceId)}</Badge>
                      {layer.editable ? <Badge variant="success">editable</Badge> : <Badge variant="warning">readonly</Badge>}
                    </div>
                    <p className="line-clamp-2 text-[11px] break-all text-slate-700">{layer.path}</p>
                    {!layer.editable && layer.readonlyReason ? (
                      <p className="mt-1 text-[11px] text-amber-700">{layer.readonlyReason}</p>
                    ) : null}
                  </button>
                ))}
              </ScrollViewport>
            </section>

            {showSplitDetail ? layerEditor : null}
          </div>
        )}
      </AsyncSurface>

      {detailMode === "sheet" && activeTab === "layers" ? (
        <Sheet
          open={detailOpen}
          onOpenChange={setDetailOpen}
          side="right"
          title={selectedLayer ? "Layer editor" : "Layer source"}
        >
          <div className="h-full min-h-[40dvh]">{layerEditor}</div>
        </Sheet>
      ) : null}
    </section>
  );
};
