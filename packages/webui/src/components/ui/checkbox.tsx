import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <span className={cn("relative inline-flex h-4 w-4 shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[0.3rem] border border-slate-300 bg-white outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <span className="pointer-events-none inline-flex h-4 w-4 items-center justify-center rounded-[0.3rem] border border-slate-300 bg-white text-white shadow-xs transition-colors peer-checked:border-teal-700 peer-checked:bg-teal-700 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-200 peer-disabled:opacity-50">
        <Check className="h-3 w-3 opacity-0 transition-opacity peer-checked:opacity-100" />
      </span>
    </span>
  );
});
Checkbox.displayName = "Checkbox";
