import { Tooltip as TooltipPrimitive } from "@base-ui-components/react/tooltip";
import * as React from "react";

import { cn } from "../../lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<Record<string, unknown>>;
  delay?: number;
}

export const Tooltip = ({ content, children, delay = 300 }: TooltipProps) => {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={delay} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner sideOffset={8}>
          <TooltipPrimitive.Popup
            className={cn(
              "z-50 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm",
              "data-[ending-style]:animate-out data-[starting-style]:animate-in",
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
