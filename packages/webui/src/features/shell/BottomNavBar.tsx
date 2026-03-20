import { memo, useMemo, type ComponentType } from "react";

import { Button } from "../../components/ui/button";
import { surfaceToneClassName } from "../../components/ui/surface";
import { cn } from "../../lib/utils";

export interface BottomNavItem {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  badgeCount?: number;
  onClick: () => void;
}

interface BottomNavBarProps {
  items: readonly BottomNavItem[];
}

export const BottomNavBar = memo(({ items }: BottomNavBarProps) => {
  const renderedItems = useMemo(
    () =>
      items.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.key}
            type="button"
            variant={item.active ? "default" : "ghost"}
            className={cn("relative h-auto flex-col gap-1 rounded-2xl", item.active ? "" : "text-slate-600")}
            onClick={item.onClick}
            aria-label={item.label}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[11px] font-medium">{item.label}</span>
            {item.badgeCount && item.badgeCount > 0 ? (
              <span className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {item.badgeCount}
              </span>
            ) : null}
          </Button>
        );
      }),
    [items],
  );

  return (
    <nav
      aria-label="Workspace navigation"
      className={cn(
        surfaceToneClassName("chrome"),
        "shrink-0 border-t border-slate-200 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]",
      )}
    >
      <div className="grid grid-cols-3 gap-1.5">{renderedItems}</div>
    </nav>
  );
});

BottomNavBar.displayName = "BottomNavBar";
