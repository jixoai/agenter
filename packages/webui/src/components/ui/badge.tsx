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

const badgeVariants = cva(
  "rounded-md border text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-slate-900 text-white",
        secondary: "border-transparent bg-slate-200 text-slate-700",
        success: "border-transparent bg-emerald-100 text-emerald-800",
        warning: "border-transparent bg-amber-100 text-amber-800",
        destructive: "border-transparent bg-rose-100 text-rose-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ children, className, variant, ...props }: BadgeProps) => {
  const layout = resolveInlineAffordanceLayout(children);
  return (
    <div
      data-inline-affordance-layout={layout}
      className={cn(
        badgeVariants({ variant }),
        inlineAffordanceClassName({
          size: "pill",
          layout,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const BadgeLeadingVisual = InlineAffordanceLeadingVisual;
export const BadgeLabel = InlineAffordanceLabel;
export const BadgeTrailingVisual = InlineAffordanceTrailingVisual;
