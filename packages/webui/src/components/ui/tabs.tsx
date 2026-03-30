import { Tabs as TabsPrimitive } from "@base-ui-components/react/tabs";
import { memo, useCallback, type ReactNode } from "react";

import { cn } from "../../lib/utils";

export interface TabItem {
  id: string;
  label: string;
  badgeCount?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  containerClassName?: string;
  trailing?: ReactNode;
}

export const Tabs = memo(({ items, value, onValueChange, ariaLabel = "Details tabs", className, containerClassName, trailing }: TabsProps) => {
  const handleValueChange = useCallback(
    (next: string) => {
      onValueChange(String(next));
    },
    [onValueChange],
  );

  return (
    <TabsPrimitive.Root value={value} onValueChange={handleValueChange}>
      <div className={cn("flex min-w-0 items-center gap-2", containerClassName)}>
        <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)] min-w-0 flex-1 overflow-x-auto pb-1">
          <TabsPrimitive.List
            className={cn("inline-flex min-w-max rounded-lg bg-slate-100 p-1", className)}
            aria-label={ariaLabel}
          >
            {items.map((item) => (
              <TabsPrimitive.Tab
                key={item.id}
                value={item.id}
                title={item.label}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  "data-[active]:bg-white data-[active]:text-slate-900 data-[active]:shadow-xs",
                  "text-slate-600 hover:text-slate-900",
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{item.label}</span>
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {item.badgeCount}
                    </span>
                  ) : null}
                </span>
              </TabsPrimitive.Tab>
            ))}
          </TabsPrimitive.List>
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
      </div>
    </TabsPrimitive.Root>
  );
});

Tabs.displayName = "Tabs";
