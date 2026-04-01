import type { WorkspaceAvatarCatalogEntry } from "@agenter/client-sdk";
import { CopyPlus, Play, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { surfaceToneClassName } from "../../components/ui/surface";
import { cn } from "../../lib/utils";

interface WorkspaceAvatarSurfaceProps {
  workspacePath: string;
  loading: boolean;
  avatars: WorkspaceAvatarCatalogEntry[];
  selectedAvatar: string | null;
  onSelectAvatar: (avatar: string) => void;
  onStartAvatar: (avatar: string) => void;
  onForkAvatar: (avatar: string) => void;
  detail: ReactNode;
}

export const WorkspaceAvatarSurface = ({
  workspacePath,
  loading,
  avatars,
  selectedAvatar,
  onSelectAvatar,
  onStartAvatar,
  onForkAvatar,
  detail,
}: WorkspaceAvatarSurfaceProps) => {
  return (
    <div className="grid h-full gap-3 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
      <section
        className={cn(
          surfaceToneClassName("panel"),
          "grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl p-4 shadow-sm",
        )}
      >
        <div className="space-y-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-700" />
            <h2 className="typo-title-3 text-slate-900">Avatars</h2>
          </div>
          <p className="text-xs text-slate-500">
            {workspacePath === "~/"
              ? "The global workspace owns the canonical avatar catalog."
              : "Workspace avatars can use global sources directly or fork into local copies before editing."}
          </p>
        </div>

        <ScrollViewport className="h-full pr-1" data-testid="workspace-avatar-scroll-viewport">
          <div className="space-y-2 pt-3">
            {avatars.map((avatar) => {
              const selected = avatar.nickname === selectedAvatar;
              const canFork = workspacePath !== "~/" && avatar.sourceScope === "global" && !avatar.workspaceAvailable;
              return (
                <article
                  key={avatar.nickname}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    selected ? "border-teal-300 bg-teal-50/70" : "border-slate-200 bg-white hover:border-slate-300",
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectAvatar(avatar.nickname)}
                    className="h-auto w-full items-start justify-start px-0 py-0 text-left whitespace-normal shadow-none hover:bg-transparent"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900">{avatar.nickname}</div>
                      {avatar.defaultAvatar ? <Badge variant="secondary">default</Badge> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <Badge variant="secondary">{avatar.sourceScope}</Badge>
                      {avatar.workspaceAvailable ? <Badge variant="secondary">workspace copy</Badge> : null}
                      {avatar.globalAvailable ? <Badge variant="secondary">global source</Badge> : null}
                    </div>
                  </Button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onStartAvatar(avatar.nickname)}>
                      <ButtonLeadingVisual>
                        <Play className="h-3.5 w-3.5" />
                      </ButtonLeadingVisual>
                      <ButtonLabel>Start</ButtonLabel>
                    </Button>
                    {canFork ? (
                      <Button size="sm" variant="secondary" onClick={() => onForkAvatar(avatar.nickname)}>
                        <ButtonLeadingVisual>
                          <CopyPlus className="h-3.5 w-3.5" />
                        </ButtonLeadingVisual>
                        <ButtonLabel>Fork</ButtonLabel>
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {!loading && avatars.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500">
                No avatars found.
              </div>
            ) : null}
          </div>
        </ScrollViewport>
      </section>

      <div className="min-h-0">{detail}</div>
    </div>
  );
};
