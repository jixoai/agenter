import type { AvatarCatalogItem } from "@agenter/client-sdk";
import { Plus, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { ProfileImage } from "../../components/ui/profile-image";
import { Tabs, type TabItem } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { SettingsPanel } from "./SettingsPanel";
import type { SettingsEffectiveGraph, SettingsLayerItem } from "./settings-graph-types";

const GLOBAL_TABS: TabItem[] = [
  { id: "user", label: "User Settings" },
  { id: "avatars", label: "Avatars" },
];

const patchActiveAvatar = (content: string, nickname: string): string => {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    parsed.avatar = nickname;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return `{\n  "avatar": "${nickname}"\n}\n`;
  }
};

interface GlobalSettingsPanelProps {
  loading: boolean;
  saving: boolean;
  status: string;
  detailMode?: "split" | "sheet";
  effective: SettingsEffectiveGraph;
  layers: SettingsLayerItem[];
  selectedLayerId: string | null;
  layerContent: string;
  avatars: AvatarCatalogItem[];
  activeAvatar: string;
  onSelectLayer: (layerId: string) => void;
  onLayerContentChange: (content: string) => void;
  onRefreshLayers: () => void;
  onLoadLayer: (layerId: string) => void;
  onSaveLayer: () => void;
  onCreateAvatar: (nickname: string) => Promise<void> | void;
  onUploadAvatarIcon: (nickname: string, file: File) => Promise<void> | void;
}

export const GlobalSettingsPanel = ({
  loading,
  saving,
  status,
  detailMode = "split",
  effective,
  layers,
  selectedLayerId,
  layerContent,
  avatars,
  activeAvatar,
  onSelectLayer,
  onLayerContentChange,
  onRefreshLayers,
  onLoadLayer,
  onSaveLayer,
  onCreateAvatar,
  onUploadAvatarIcon,
}: GlobalSettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<"user" | "avatars">("user");
  const [newAvatar, setNewAvatar] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedAvatarRef = useRef<string | null>(null);
  const sortedAvatars = useMemo(() => avatars.slice(), [avatars]);

  return (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3">
      <Tabs items={GLOBAL_TABS} value={activeTab} onValueChange={(value) => setActiveTab(value as "user" | "avatars")} />

      {activeTab === "user" ? (
        <SettingsPanel
          disabled={false}
          loading={loading}
          status={saving ? "Saving..." : status}
          title="Global Settings"
          description="Global user settings share the same source/view workbench. Avatar catalog management stays in the Avatars tab."
          effective={effective}
          layers={layers}
          selectedLayerId={selectedLayerId}
          layerContent={layerContent}
          detailMode={detailMode}
          onSelectLayer={onSelectLayer}
          onLayerContentChange={onLayerContentChange}
          onRefreshLayers={onRefreshLayers}
          onLoadLayer={onLoadLayer}
          onSaveLayer={onSaveLayer}
        />
      ) : (
        <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white/96 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Input
              value={newAvatar}
              onChange={(event) => setNewAvatar(event.target.value)}
              placeholder="new-avatar"
              className="max-w-[16rem]"
            />
            <Button
              variant="secondary"
              onClick={() => {
                const nickname = newAvatar.trim();
                if (!nickname) {
                  return;
                }
                void Promise.resolve(onCreateAvatar(nickname)).then(() => {
                  setNewAvatar("");
                });
              }}
            >
              <Plus className="h-4 w-4" />
              Create avatar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                const nickname = selectedAvatarRef.current;
                event.currentTarget.value = "";
                if (!file || !nickname) {
                  return;
                }
                void onUploadAvatarIcon(nickname, file);
              }}
            />
          </div>

          <ScrollViewport className="h-full pr-1" data-testid="global-settings-avatars-scroll-viewport">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedAvatars.map((avatar) => (
                <article
                  key={avatar.nickname}
                  className={cn(
                    "rounded-2xl border px-3 py-3",
                    avatar.active ? "border-teal-300 bg-teal-50/70" : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <ProfileImage src={avatar.iconUrl} label={avatar.nickname} className="h-14 w-14 rounded-2xl" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{avatar.nickname}</p>
                        {avatar.nickname === activeAvatar ? (
                          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                            active
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500">Used for assistant identity, prompts, and default avatar rendering.</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={avatar.nickname === activeAvatar ? "secondary" : "outline"}
                      onClick={() => onLayerContentChange(patchActiveAvatar(layerContent, avatar.nickname))}
                    >
                      Set active
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        selectedAvatarRef.current = avatar.nickname;
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      Upload icon
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </ScrollViewport>
        </section>
      )}
    </section>
  );
};
