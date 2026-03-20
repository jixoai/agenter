import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const noticeBannerVariants = cva("rounded-2xl border px-3 py-2 text-sm", {
  variants: {
    tone: {
      info: "border-sky-200 bg-sky-50 text-sky-800",
      warning: "border-amber-200 bg-amber-50 text-amber-800",
      destructive: "border-rose-200 bg-rose-50 text-rose-700",
    },
  },
  defaultVariants: {
    tone: "info",
  },
});

interface NoticeBannerProps extends VariantProps<typeof noticeBannerVariants> {
  children: ReactNode;
  className?: string;
}

export const NoticeBanner = ({ children, className, tone }: NoticeBannerProps) => (
  <div className={cn(noticeBannerVariants({ tone }), className)}>{children}</div>
);
