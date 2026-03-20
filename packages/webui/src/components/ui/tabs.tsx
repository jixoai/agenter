import { Tabs as TabsPrimitive } from "@base-ui-components/react/tabs";
import { memo, useCallback } from "react";

import { cn } from "../../lib/utils";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export const Tabs = memo(({ items, value, onValueChange, className }: TabsProps) => {
  const handleValueChange = useCallback(
    (next: string) => {
      onValueChange(String(next));
    },
    [onValueChange],
  );

  return (
    <TabsPrimitive.Root value={value} onValueChange={handleValueChange}>
      <TabsPrimitive.List
        className={cn("inline-flex rounded-lg bg-slate-100 p-1", className)}
        aria-label="Details tabs"
      >
        {items.map((item) => (
          <TabsPrimitive.Tab
            key={item.id}
            value={item.id}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              "data-[active]:bg-white data-[active]:text-slate-900 data-[active]:shadow-xs",
              "text-slate-600 hover:text-slate-900",
            )}
          >
            {item.label}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
});

Tabs.displayName = "Tabs";
