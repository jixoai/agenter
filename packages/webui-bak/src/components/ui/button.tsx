import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";
import {
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceTrailingVisual,
  inlineAffordanceClassName,
  resolveInlineAffordanceLayout,
} from "./inline-affordance";

const buttonVariants = cva(
  "justify-center whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-teal-700 text-white hover:bg-teal-600",
        secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300",
        outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
        ghost: "text-slate-700 hover:bg-slate-100",
        destructive: "bg-rose-700 text-white hover:bg-rose-600",
      },
      size: {
        default: "text-sm",
        sm: "text-xs",
        lg: "text-sm",
        icon: "text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant, size = "default", ...props }, ref) => {
    const layout = size === "icon" ? "icon-only" : resolveInlineAffordanceLayout(children);
    const surfaceSize =
      size === "sm" ? "controlSm" : size === "lg" ? "controlLg" : "control";

    return (
      <button
        ref={ref}
        data-inline-affordance-layout={layout}
        className={cn(
          buttonVariants({ variant, size }),
          inlineAffordanceClassName({
            size: size === "icon" ? "control" : surfaceSize,
            layout,
          }),
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export const ButtonLeadingVisual = InlineAffordanceLeadingVisual;
export const ButtonLabel = InlineAffordanceLabel;
export const ButtonTrailingVisual = InlineAffordanceTrailingVisual;
