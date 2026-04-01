import { Menu as MenuPrimitive } from "@base-ui-components/react/menu";
import { Check, ChevronRight } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react";
import * as React from "react";

import { cn } from "../../lib/utils";
import {
  inlineAffordanceClassName,
  resolveInlineAffordanceLayout,
} from "./inline-affordance";

export const DropdownMenu = MenuPrimitive.Root;

export const DropdownMenuTrigger = React.forwardRef<
  ElementRef<typeof MenuPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Trigger>
>(({ children, className, ...props }, ref) => {
  const layout = resolveInlineAffordanceLayout(children);

  return (
    <MenuPrimitive.Trigger
      ref={ref}
      className={cn(
        "justify-center whitespace-nowrap font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50",
        inlineAffordanceClassName({ size: "control", layout }),
        className,
      )}
      {...props}
    >
      {children}
    </MenuPrimitive.Trigger>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export const DropdownMenuContent = React.forwardRef<
  ElementRef<typeof MenuPrimitive.Popup>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Popup> & {
    sideOffset?: number;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
  }
>(({ className, sideOffset = 8, align = "end", side = "bottom", ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner sideOffset={sideOffset} align={align} side={side} className="z-50 outline-none">
      <MenuPrimitive.Popup
        ref={ref}
        className={cn(
          "min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl outline-none data-[ending-style]:animate-out data-[starting-style]:animate-in",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuLabel = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500", className)} {...props} />
);

export const DropdownMenuSeparator = React.forwardRef<
  ElementRef<typeof MenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator ref={ref} className={cn("my-1 h-px bg-slate-200", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export const DropdownMenuItem = React.forwardRef<
  ElementRef<typeof MenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset = false, ...props }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900",
      inset ? "pl-8" : "",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuItemIndicator = ({ className }: { className?: string }) => (
  <span className={cn("inline-flex h-4 w-4 items-center justify-center text-teal-700", className)}>
    <Check className="h-3.5 w-3.5" />
  </span>
);

export const DropdownMenuSubTrigger = React.forwardRef<
  ElementRef<typeof MenuPrimitive.SubmenuTrigger>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.SubmenuTrigger>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.SubmenuTrigger
    ref={ref}
    className={cn(
      "flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900",
      className,
    )}
    {...props}
  >
    <span className="min-w-0 flex-1">{children}</span>
    <ChevronRight className="h-4 w-4 text-slate-400" />
  </MenuPrimitive.SubmenuTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export const DropdownMenuSubContent = React.forwardRef<
  ElementRef<typeof MenuPrimitive.Popup>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Popup>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner sideOffset={8} align="start" side="right" className="z-50 outline-none">
      <MenuPrimitive.Popup
        ref={ref}
        className={cn(
          "min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl outline-none data-[ending-style]:animate-out data-[starting-style]:animate-in",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
