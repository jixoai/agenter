import { useMemo, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
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
  const selectedLayer = useMemo(() => layers.find((item) => item.layerId === selectedLayerId) ?? null, [layers, selectedLayerId]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Settings</h2>
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
        <div className="min-h-0 flex-1">
          <Textarea
            value={effectiveContent}
            readOnly
            className="min-h-[55dvh] resize-none font-mono text-xs"
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
          <section className="min-h-0 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-700">Sources</p>
              <Button size="sm" variant="secondary" onClick={onRefreshLayers} disabled={disabled}>
                Refresh
              </Button>
            </div>
            <div className="min-h-0 space-y-1 overflow-auto">
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
                    {layer.editable ? <Badge variant="success">editable</Badge> : <Badge variant="warning">readonly</Badge>}
                  </div>
                  <p className="line-clamp-2 break-all text-[11px] text-slate-700">{layer.path}</p>
                  {!layer.editable && layer.readonlyReason ? <p className="mt-1 text-[11px] text-amber-700">{layer.readonlyReason}</p> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-slate-200 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-slate-700">Layer editor</p>
                <p className="max-w-[60ch] truncate text-[11px] text-slate-500">{selectedLayer?.path ?? "Select a source layer"}</p>
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
          </section>
        </div>
      )}
    </section>
  );
};
