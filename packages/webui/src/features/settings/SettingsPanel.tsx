import { useEffect, useMemo, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { HelpHint } from "../../components/ui/help-hint";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Sheet } from "../../components/ui/sheet";
import { Skeleton } from "../../components/ui/skeleton";
import { Tabs, type TabItem } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { SettingsSchemaView } from "./SettingsSchemaView";
import { SettingsSourceEditor } from "./SettingsSourceEditor";
import type { SettingsEffectiveGraph, SettingsLayerItem, SettingsPointerJumpTarget } from "./settings-graph-types";
import { toPrettyJson, tryParseJson } from "./settings-json-pointer";

interface SettingsPanelProps {
  disabled: boolean;
  loading: boolean;
  status: string;
  title?: string;
  description?: string;
  descriptionHelpId?: string;
  effective: SettingsEffectiveGraph;
  layers: SettingsLayerItem[];
  selectedLayerId: string | null;
  layerContent: string;
  detailMode?: "split" | "sheet";
  onSelectLayer: (layerId: string) => void;
  onLayerContentChange: (content: string) => void;
  onRefreshLayers: () => void;
  onLoadLayer: (layerId: string) => void;
  onSaveLayer: () => void;
}

const MAIN_TABS: TabItem[] = [
  { id: "effective", label: "Effective" },
  { id: "layers", label: "Layer Sources" },
];

const VIEW_TABS: TabItem[] = [
  { id: "source", label: "Source" },
  { id: "view", label: "View" },
];

const layerTone = (layer: SettingsLayerItem): "success" | "warning" => (layer.editable ? "success" : "warning");

const layerBadgeLabel = (layer: SettingsLayerItem): string => {
  if (layer.kind === "avatar") {
    return "avatar";
  }
  return layer.sourceId;
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
  title = "Settings",
  description = "Merged settings stay read-only. Each source layer remains editable independently.",
  descriptionHelpId,
  effective,
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
  const [effectiveViewMode, setEffectiveViewMode] = useState<"source" | "view">("source");
  const [layerViewMode, setLayerViewMode] = useState<"source" | "view">("source");
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusedLayerPointer, setFocusedLayerPointer] = useState<string | null>(null);

  const selectedLayer = useMemo(
    () => layers.find((item) => item.layerId === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const effectiveContent = typeof effective?.content === "string" ? effective.content : "";
  const effectiveSchema = effective?.schema ?? {};
  const effectiveProvenance = effective?.provenance ?? {};
  const layerDraftJson = useMemo(() => tryParseJson(layerContent), [layerContent]);
  const effectiveValue = useMemo(
    () => effective?.value ?? tryParseJson(effectiveContent) ?? {},
    [effective?.value, effectiveContent],
  );
  const hasData = activeTab === "effective" ? effectiveContent.trim().length > 0 : layers.length > 0;
  const splitDetail = detailMode === "split";

  useEffect(() => {
    if (activeTab !== "layers" || detailMode !== "sheet") {
      setDetailOpen(false);
      return;
    }
    if (selectedLayerId) {
      setDetailOpen(true);
    }
  }, [activeTab, detailMode, selectedLayerId]);

  const openLayer = (layerId: string) => {
    onSelectLayer(layerId);
    onLoadLayer(layerId);
    if (detailMode === "sheet") {
      setDetailOpen(true);
    }
  };

  const jumpToLayer = (target: SettingsPointerJumpTarget) => {
    if (!layers.some((layer) => layer.layerId === target.layerId)) {
      return;
    }
    setActiveTab("layers");
    setLayerViewMode("view");
    setFocusedLayerPointer(target.pointer);
    openLayer(target.layerId);
  };

  const layerDetail = (
    <section className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-2 rounded-xl border border-slate-200 p-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="typo-emphasis text-xs text-slate-700">Layer Detail</p>
          <p className="truncate text-[11px] text-slate-500">{selectedLayer?.path ?? "Select a source layer"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!selectedLayerId) {
                return;
              }
              onLoadLayer(selectedLayerId);
            }}
            disabled={disabled || !selectedLayerId}
          >
            Reload
          </Button>
          <Button size="sm" onClick={onSaveLayer} disabled={disabled || !selectedLayer?.editable}>
            Save
          </Button>
        </div>
      </header>

      <Tabs
        items={VIEW_TABS}
        value={layerViewMode}
        onValueChange={(value) => setLayerViewMode(value as "source" | "view")}
      />

      {layerViewMode === "source" ? (
        <SettingsSourceEditor
          value={layerContent}
          onChange={(nextContent) => onLayerContentChange(nextContent)}
          placeholder="Select a layer and load content"
          readOnly={selectedLayer?.editable !== true}
          testId="settings-layer-source-editor"
        />
      ) : (
        <ScrollViewport data-testid="settings-layer-view-viewport" className="h-full pr-1">
          {layerDraftJson ? (
            <SettingsSchemaView
              schema={effectiveSchema}
              value={layerDraftJson}
              mode={selectedLayer?.editable ? "editable" : "readonly"}
              focusPointer={focusedLayerPointer}
              onValueChange={(nextValue) => onLayerContentChange(toPrettyJson(nextValue))}
            />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Layer source is not valid JSON. Switch to `Source` to fix it, then return to `View`.
            </div>
          )}
        </ScrollViewport>
      )}
    </section>
  );

  return (
    <section className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white/96 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="typo-title-3 text-slate-900">{title}</h2>
          {description ? (
            <HelpHint
              helpId={descriptionHelpId ?? "settings-panel:overview"}
              textContext={`${title}\n${description}`}
              content={description}
            />
          ) : null}
        </div>
        <Badge variant="secondary" className="max-w-[48ch] truncate">
          {status}
        </Badge>
      </div>

      <Tabs
        items={MAIN_TABS}
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "effective" | "layers")}
      />

      <AsyncSurface
        state={resolveAsyncSurfaceState({ loading, hasData })}
        loadingOverlayLabel={activeTab === "effective" ? "Refreshing settings..." : "Refreshing layer sources..."}
        skeleton={<LoadingShell />}
        empty={
          <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
            {activeTab === "effective" ? "No merged settings available yet." : "No settings layers discovered."}
          </div>
        }
        className="h-full"
      >
        {activeTab === "effective" ? (
          <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-2">
            <Tabs
              items={VIEW_TABS}
              value={effectiveViewMode}
              onValueChange={(value) => setEffectiveViewMode(value as "source" | "view")}
            />
            {effectiveViewMode === "source" ? (
              <SettingsSourceEditor value={effectiveContent} readOnly testId="settings-effective-source-editor" />
            ) : (
              <ScrollViewport data-testid="settings-effective-view-viewport" className="h-full pr-1">
                <SettingsSchemaView
                  schema={effectiveSchema}
                  value={effectiveValue}
                  mode="readonly"
                  provenance={effectiveProvenance}
                  onJumpToSource={jumpToLayer}
                />
              </ScrollViewport>
            )}
          </section>
        ) : (
          <div
            className={cn(
              "grid h-full grid-cols-1 gap-3",
              splitDetail ? "grid-rows-[minmax(180px,40%)_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)]",
            )}
          >
            <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-slate-200 bg-slate-50 p-2">
              <header className="mb-2 flex items-center justify-between gap-2">
                <p className="typo-emphasis text-xs text-slate-700">Layer Files</p>
                <Button size="sm" variant="secondary" onClick={onRefreshLayers} disabled={disabled}>
                  Refresh
                </Button>
              </header>
              <ScrollViewport data-testid="settings-sources-scroll-viewport" className="h-full space-y-1 pr-1">
                {layers.map((layer) => (
                  <Button
                    key={layer.layerId}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFocusedLayerPointer(null);
                      openLayer(layer.layerId);
                    }}
                    className={
                      layer.layerId === selectedLayerId
                        ? "h-auto w-full items-start justify-start rounded-md border-teal-300 bg-teal-50 px-2 py-2 text-left whitespace-normal shadow-none hover:bg-teal-50"
                        : "h-auto w-full items-start justify-start rounded-md border-slate-200 bg-white px-2 py-2 text-left whitespace-normal shadow-none hover:bg-slate-100"
                    }
                  >
                    <div className="mb-1 flex w-full flex-wrap items-center gap-1">
                      <Badge variant="secondary">{layerBadgeLabel(layer)}</Badge>
                      <Badge variant={layerTone(layer)}>{layer.editable ? "editable" : "readonly"}</Badge>
                    </div>
                    <p className="line-clamp-2 text-[11px] break-all text-slate-700">{layer.path}</p>
                    {!layer.editable && layer.readonlyReason ? (
                      <p className="mt-1 text-[11px] text-amber-700">{layer.readonlyReason}</p>
                    ) : null}
                  </Button>
                ))}
              </ScrollViewport>
            </section>
            {splitDetail ? layerDetail : null}
          </div>
        )}
      </AsyncSurface>

      {detailMode === "sheet" && activeTab === "layers" ? (
        <Sheet
          open={detailOpen}
          onOpenChange={setDetailOpen}
          side="right"
          title={selectedLayer ? "Layer Detail" : "Layer Sources"}
        >
          <div className="h-full min-h-[45dvh]">{layerDetail}</div>
        </Sheet>
      ) : null}
    </section>
  );
};
