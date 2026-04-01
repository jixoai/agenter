import * as React from "react";

import { cn } from "../../lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  decorative?: boolean;
  orientation?: "horizontal" | "vertical";
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, decorative = true, orientation = "horizontal", ...props }, ref) => {
    return (
      <div
        ref={ref}
        role={decorative ? "none" : "separator"}
        aria-orientation={decorative ? undefined : orientation}
        data-orientation={orientation}
        className={cn("shrink-0 bg-slate-200", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
        {...props}
      />
    );
  },
);
Separator.displayName = "Separator";
