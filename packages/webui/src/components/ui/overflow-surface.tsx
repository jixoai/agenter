import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "../../lib/utils";

type DivProps = ComponentPropsWithoutRef<"div">;

const SCROLLBAR_CLASS_NAME =
  "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)]";

export const ViewportMask = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => {
  return <div ref={ref} data-overflow-role="viewport-mask" className={cn("overflow-hidden", className)} {...props} />;
});

ViewportMask.displayName = "ViewportMask";

export const ScrollViewport = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-overflow-role="scroll-viewport"
      className={cn("basis-0 overflow-auto", SCROLLBAR_CLASS_NAME, className)}
      {...props}
    />
  );
});

ScrollViewport.displayName = "ScrollViewport";

export const ClipSurface = forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => {
  return <div ref={ref} data-overflow-role="clip-surface" className={cn("overflow-hidden", className)} {...props} />;
});

ClipSurface.displayName = "ClipSurface";
