import * as React from "react";

import { Button, type ButtonProps } from "./button";
import { ScrollViewport } from "./overflow-surface";
import { surfaceToneClassName } from "./surface";
import { cn } from "../../lib/utils";

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(({ className, collapsed = false, ...props }, ref) => (
  <aside
    ref={ref}
    data-sidebar-collapsed={collapsed ? "true" : "false"}
    className={cn(
      surfaceToneClassName("chrome"),
      "hidden h-full shrink-0 border-r border-slate-200 transition-[width] duration-200 ease-out xl:flex xl:flex-col",
      collapsed ? "w-[4.75rem]" : "w-[18.5rem]",
      className,
    )}
    {...props}
  />
));
Sidebar.displayName = "Sidebar";

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("shrink-0", className)} {...props} />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("min-h-0 flex-1", className)} {...props} />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarScrollArea = React.forwardRef<React.ElementRef<typeof ScrollViewport>, React.ComponentProps<typeof ScrollViewport>>(
  ({ className, ...props }, ref) => <ScrollViewport ref={ref} className={cn("h-full", className)} {...props} />,
);
SidebarScrollArea.displayName = "SidebarScrollArea";

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("shrink-0", className)} {...props} />
));
SidebarFooter.displayName = "SidebarFooter";

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <section ref={ref} className={cn("space-y-2", className)} {...props} />
));
SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = ({
  className,
  collapsed = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { collapsed?: boolean }) =>
  collapsed ? (
    <p className="sr-only">{children}</p>
  ) : (
    <div className={cn("px-1", className)} {...props}>
      <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">{children}</p>
    </div>
  );
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarMenu = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-1", className)} {...props} />
));
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(className)} {...props} />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

export interface SidebarMenuButtonProps extends ButtonProps {
  isActive?: boolean;
  collapsed?: boolean;
}

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className, variant = "ghost", size, isActive = false, collapsed = false, ...props }, ref) => (
    <Button
      ref={ref}
      variant={isActive ? "secondary" : variant}
      size={collapsed ? "icon" : size}
      className={cn(
        collapsed
          ? "relative h-11 w-11 rounded-xl"
          : "w-full justify-start rounded-xl",
        isActive ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200" : "text-slate-700",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenuButton.displayName = "SidebarMenuButton";
