import type { AvatarCatalogItem } from "@agenter/client-sdk";
import { Plus, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { ProfileImage } from "../../components/ui/profile-image";
import { Tabs, type TabItem } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

const SETTINGS_TABS: TabItem[] = [
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
  settingsContent: string;
  avatars: AvatarCatalogItem[];
  activeAvatar: string;
  onSettingsContentChange: (content: string) => void;
  onSaveSettings: () => void;
  onCreateAvatar: (nickname: string) => Promise<void> | void;
  onUploadAvatarIcon: (nickname: string, file: File) => Promise<void> | void;
}

export const GlobalSettingsPanel = ({
  loading,
  saving,
  status,
  settingsContent,
  avatars,
  activeAvatar,
  onSettingsContentChange,
  onSaveSettings,
  onCreateAvatar,
  onUploadAvatarIcon,
}: GlobalSettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<"user" | "avatars">("user");
  const [newAvatar, setNewAvatar] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedAvatarRef = useRef<string | null>(null);
  const hasData = settingsContent.trim().length > 0 || avatars.length > 0;
  const sortedAvatars = useMemo(() => avatars.slice(), [avatars]);

  return (
    <section className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white/96 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="typo-title-3 text-slate-900">Global Settings</h2>
          <p className="text-xs text-slate-500">User defaults and avatar catalog live here. Workspace layer editing stays in the workspace shell.</p>
        </div>
        <Badge variant="secondary" className="max-w-[48ch] truncate">
          {status}
        </Badge>
      </div>

      <Tabs items={SETTINGS_TABS} value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} />

      <AsyncSurface
        state={resolveAsyncSurfaceState({ loading, hasData })}
        loadingOverlayLabel="Refreshing global settings..."
        empty={
          <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
            No global settings or avatars have been created yet.
          </div>
        }
        className="h-full"
      >
        {activeTab === "user" ? (
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-slate-700">User settings JSON</p>
                <p className="text-[11px] text-slate-500">Editing the `avatar` field changes the globally active avatar.</p>
              </div>
              <Button onClick={onSaveSettings} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
            <Textarea
              value={settingsContent}
              onChange={(event) => onSettingsContentChange(event.target.value)}
              className="h-full resize-none font-mono text-xs"
            />
          </div>
        ) : (
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3">
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
                          {avatar.nickname === activeAvatar ? <Badge variant="success">active</Badge> : null}
                        </div>
                        <p className="text-[11px] text-slate-500">Used for assistant identity, prompts, and default avatar rendering.</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={avatar.nickname === activeAvatar ? "secondary" : "outline"}
                        onClick={() => onSettingsContentChange(patchActiveAvatar(settingsContent, avatar.nickname))}
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
          </div>
        )}
      </AsyncSurface>
    </section>
  );
};
