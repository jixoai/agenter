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

export const Tabs = ({ items, value, onValueChange, className }: TabsProps) => {
  return (
    <div className={cn("inline-flex rounded-lg bg-slate-100 p-1", className)} role="tablist" aria-label="Details tabs">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
