import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    aria-hidden="true"
    className={cn("animate-pulse rounded-md bg-slate-200/80", className)}
    {...props}
  />
);
