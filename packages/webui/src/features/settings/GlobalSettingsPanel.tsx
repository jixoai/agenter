import type { AuthServiceInfoOutput, AuthSessionOutput, ProfileListItem } from "@agenter/client-sdk";
import { KeyRound, Save, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { PasswordInput } from "../../components/ui/password-input";
import { ProfileImage } from "../../components/ui/profile-image";
import { Tabs, type TabItem } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { SettingsPanel } from "./SettingsPanel";
import type { SettingsEffectiveGraph, SettingsLayerItem } from "./settings-graph-types";

const GLOBAL_TABS: TabItem[] = [
  { id: "user", label: "User Settings" },
  { id: "profile", label: "Profile" },
];

export interface GlobalProfileDraft {
  nickname: string;
  displayName: string;
  phone: string;
  address: string;
}

type DurableProfileItem = ProfileListItem & { profileId: string };

const formatIdentifierLabel = (kind: string, value: string): string => `${kind}:${value}`;

const resolveProfileTitle = (profile: DurableProfileItem): string =>
  profile.metadata.displayName?.trim() ||
  profile.metadata.nickname?.trim() ||
  profile.identifiers[0]?.value ||
  profile.profileId;

const resolveProfileSubtitle = (profile: DurableProfileItem): string =>
  profile.metadata.nickname?.trim() || profile.identifiers[0]?.value || profile.profileId;

const resolveAuthRoleLabel = (authSession: AuthSessionOutput | null): string => {
  if (!authSession) {
    return "none";
  }
  if (authSession.claims.superadmin) {
    return "superadmin";
  }
  return authSession.claims.admin ? "admin" : "member";
};

interface GlobalSettingsPanelProps {
  loading: boolean;
  saving: boolean;
  status: string;
  authStatus: string;
  authService: AuthServiceInfoOutput | null;
  authSession: AuthSessionOutput | null;
  privateKeyDraft: string;
  detailMode?: "split" | "sheet";
  effective: SettingsEffectiveGraph;
  layers: SettingsLayerItem[];
  selectedLayerId: string | null;
  layerContent: string;
  profiles: DurableProfileItem[];
  activeProfileReference: string;
  selectedProfileReference: string | null;
  profileDraft: GlobalProfileDraft;
  onSelectLayer: (layerId: string) => void;
  onLayerContentChange: (content: string) => void;
  onRefreshLayers: () => void;
  onLoadLayer: (layerId: string) => void;
  onSaveLayer: () => void;
  onSelectProfile: (reference: string) => void;
  onSetActiveProfile: (reference: string) => void;
  onProfileDraftChange: (draft: GlobalProfileDraft) => void;
  onPrivateKeyDraftChange: (value: string) => void;
  onAuthenticate: () => Promise<void> | void;
  onUploadProfileIcon: (reference: string, file: File) => Promise<void> | void;
  onSaveProfile: () => Promise<void> | void;
  onClearAuthSession: () => void;
}

export const GlobalSettingsPanel = ({
  loading,
  saving,
  status,
  authStatus,
  authService,
  authSession,
  privateKeyDraft,
  detailMode = "split",
  effective,
  layers,
  selectedLayerId,
  layerContent,
  profiles,
  activeProfileReference,
  selectedProfileReference,
  profileDraft,
  onSelectLayer,
  onLayerContentChange,
  onRefreshLayers,
  onLoadLayer,
  onSaveLayer,
  onSelectProfile,
  onSetActiveProfile,
  onProfileDraftChange,
  onPrivateKeyDraftChange,
  onAuthenticate,
  onUploadProfileIcon,
  onSaveProfile,
  onClearAuthSession,
}: GlobalSettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<"user" | "profile">("user");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sortedProfiles = useMemo(() => profiles.slice().sort((left, right) => left.profileId.localeCompare(right.profileId)), [profiles]);
  const selectedProfile = sortedProfiles.find((profile) => profile.profileId === selectedProfileReference) ?? null;
  const authenticatedProfileId = authSession?.profile.profileId ?? null;
  const canMutateSelectedProfile = Boolean(
    selectedProfile?.profileId && authenticatedProfileId === selectedProfile.profileId && authSession?.token,
  );

  return (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3">
      <Tabs items={GLOBAL_TABS} value={activeTab} onValueChange={(value) => setActiveTab(value as "user" | "profile")} />

      {activeTab === "user" ? (
        <SettingsPanel
          disabled={false}
          loading={loading}
          status={saving ? "Saving..." : status}
          title="Global Settings"
          description="User settings stay responsible for prompt persona and global defaults. Durable auth identity and profile editing now live in the Profile tab."
          descriptionHelpId="settings:global:overview"
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
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <PasswordInput
                value={privateKeyDraft}
                onChange={(event) => onPrivateKeyDraftChange(event.target.value)}
                placeholder="0x-prefixed private key"
                className="min-w-[18rem] flex-1 basis-[18rem]"
                toggleLabel={{ show: "Show private key", hide: "Hide private key" }}
              />
              <Button variant="secondary" onClick={() => void onAuthenticate()} disabled={!privateKeyDraft}>
                <KeyRound className="h-4 w-4" />
                Sign challenge
              </Button>
              {authSession ? (
                <Button variant="ghost" onClick={onClearAuthSession}>
                  <Trash2 className="h-4 w-4" />
                  Clear token
                </Button>
              ) : null}
            </div>

            <p className="text-xs text-slate-500">
              Private key input is only used locally to sign one challenge. The browser stores only the short-lived JWT.
            </p>

            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded border border-slate-200 bg-white px-2 py-1">Mode: {authService?.authMode ?? "unavailable"}</span>
              <span className="rounded border border-slate-200 bg-white px-2 py-1">Root auth: {authService?.rootAuthId ?? "unavailable"}</span>
              <span className="rounded border border-slate-200 bg-white px-2 py-1">
                Root key: {authService?.rootAuthKeyPath ?? "~/.agenter/profile-service/root-auth.key"}
              </span>
              <span className="rounded border border-slate-200 bg-white px-2 py-1">JWT TTL: {authService ? `${authService.jwtTtlSeconds}s` : "unknown"}</span>
              <span className="rounded border border-slate-200 bg-white px-2 py-1">Auth identity: {authSession?.claims.authId ?? "none"}</span>
              <span className="rounded border border-slate-200 bg-white px-2 py-1">Auth profile: {authenticatedProfileId ?? "none"}</span>
              <span className="rounded border border-slate-200 bg-white px-2 py-1">Claims: {resolveAuthRoleLabel(authSession)}</span>
            </div>

            <p className="text-sm text-slate-700">{authStatus}</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (!file || !selectedProfile) {
                return;
              }
              void onUploadProfileIcon(selectedProfile.profileId, file);
            }}
          />

          <ScrollViewport className="h-full pr-1" data-testid="global-settings-profiles-scroll-viewport">
            {sortedProfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600">
                No durable profiles yet. Authenticate with a private key first, then edit whichever durable profile the auth session resolves.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sortedProfiles.map((profile) => {
                  const selected = profile.profileId === selectedProfileReference;
                  const active = profile.profileId === activeProfileReference;
                  const authenticated = profile.profileId === authenticatedProfileId;
                  return (
                    <article
                      key={profile.profileId}
                      className={cn(
                        "rounded-2xl border px-3 py-3",
                        selected ? "border-sky-300 bg-sky-50/70" : "border-slate-200 bg-white",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <ProfileImage src={profile.iconUrl} label={resolveProfileTitle(profile)} className="h-14 w-14 rounded-2xl" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-slate-900">{resolveProfileTitle(profile)}</p>
                            {active ? (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">active</span>
                            ) : null}
                            {authenticated ? (
                              <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">authenticated</span>
                            ) : null}
                          </div>
                          <p className="truncate text-[11px] text-slate-500">{resolveProfileSubtitle(profile)}</p>
                          <div className="flex flex-wrap gap-1">
                            {profile.identifiers.map((identifier) => (
                              <span
                                key={formatIdentifierLabel(identifier.kind, identifier.value)}
                                className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600"
                              >
                                {formatIdentifierLabel(identifier.kind, identifier.value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant={selected ? "secondary" : "outline"} onClick={() => onSelectProfile(profile.profileId)}>
                          Select
                        </Button>
                        <Button size="sm" variant={active ? "secondary" : "outline"} onClick={() => onSetActiveProfile(profile.profileId)}>
                          Set active
                        </Button>
                      </div>

                      {selected ? (
                        <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white/80 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1 text-xs text-slate-600">
                              <span>Display name</span>
                              <Input
                                value={profileDraft.displayName}
                                onChange={(event) => onProfileDraftChange({ ...profileDraft, displayName: event.target.value })}
                                placeholder="Display name"
                              />
                            </label>
                            <label className="grid gap-1 text-xs text-slate-600">
                              <span>Nickname</span>
                              <Input
                                value={profileDraft.nickname}
                                onChange={(event) => onProfileDraftChange({ ...profileDraft, nickname: event.target.value })}
                                placeholder="nickname"
                              />
                            </label>
                            <label className="grid gap-1 text-xs text-slate-600">
                              <span>Phone</span>
                              <Input
                                value={profileDraft.phone}
                                onChange={(event) => onProfileDraftChange({ ...profileDraft, phone: event.target.value })}
                                placeholder="+86 ..."
                              />
                            </label>
                            <label className="grid gap-1 text-xs text-slate-600">
                              <span>Address</span>
                              <Input
                                value={profileDraft.address}
                                onChange={(event) => onProfileDraftChange({ ...profileDraft, address: event.target.value })}
                                placeholder="Address"
                              />
                            </label>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => void onSaveProfile()} disabled={!canMutateSelectedProfile}>
                              <Save className="h-4 w-4" />
                              Save metadata
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={!canMutateSelectedProfile}
                            >
                              <Upload className="h-4 w-4" />
                              Upload icon
                            </Button>
                          </div>

                          {!canMutateSelectedProfile ? (
                            <p className="text-xs text-slate-500">
                              Authenticate the selected profile with a private-key-signed auth session before editing metadata or replacing the icon.
                            </p>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-emerald-700">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Auth session matches this profile.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </ScrollViewport>
        </section>
      )}
    </section>
  );
};
