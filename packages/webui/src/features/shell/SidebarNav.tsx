import type { ComponentType } from "react";

import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { Tooltip } from "../../components/ui/tooltip";

interface NavAvatar {
  label: string;
  hue: number;
}

export interface NavItem {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  avatar?: NavAvatar;
  title?: string;
  group?: "primary" | "session";
}

interface SidebarNavProps {
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
}

const AvatarGlyph = ({ avatar }: { avatar: NavAvatar }) => (
  <span
    className="inline-flex h-4 w-4 items-center justify-center rounded-md text-[10px] font-semibold"
    style={{
      backgroundColor: `oklch(0.84 0.1 ${avatar.hue})`,
      color: `oklch(0.28 0.08 ${avatar.hue})`,
    }}
  >
    {avatar.label.slice(0, 1).toUpperCase()}
  </span>
);

export const SidebarNav = ({ items, active, onSelect }: SidebarNavProps) => {
  const hasSessionItems = items.some((item) => item.group === "session");

  return (
    <aside className="hidden h-[calc(100dvh-92px)] border-r border-slate-200 bg-white md:flex md:flex-col md:items-center md:gap-1 md:p-2">
      {items.map((item, index) => {
        const Icon = item.icon;
        const previous = items[index - 1];
        const showDivider = item.group === "session" && previous?.group !== "session" && hasSessionItems;
        const glyph = item.avatar ? <AvatarGlyph avatar={item.avatar} /> : Icon ? <Icon className="h-4 w-4" /> : null;

        return (
          <div key={item.key} className="contents">
            {showDivider ? <div className="my-1 h-px w-8 bg-slate-200" /> : null}
            <Tooltip content={item.title ?? item.label}>
              <Button
                size="icon"
                variant={active === item.key ? "default" : "ghost"}
                onClick={() => onSelect(item.key)}
                aria-label={item.title ?? item.label}
                className={cn(item.avatar ? "font-semibold" : "")}
              >
                {glyph}
              </Button>
            </Tooltip>
          </div>
        );
      })}
    </aside>
  );
};
