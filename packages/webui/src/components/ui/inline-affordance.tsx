import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

type InlineAffordanceSlotKind = "leading" | "label" | "trailing" | "meta";
export type InlineAffordanceLayout = "plain" | "icon-only" | "leading" | "trailing" | "both";

const INLINE_AFFORDANCE_SLOT = Symbol("agenter.inline-affordance-slot");

type SlotComponent = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLSpanElement> & React.RefAttributes<HTMLSpanElement>
> & {
  [INLINE_AFFORDANCE_SLOT]?: InlineAffordanceSlotKind;
};

const createInlineAffordanceSlot = (
  displayName: string,
  dataSlot: string,
  kind: InlineAffordanceSlotKind,
  defaultClassName: string,
): SlotComponent => {
  const Component = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
      <span ref={ref} data-slot={dataSlot} className={cn(defaultClassName, className)} {...props} />
    ),
  ) as SlotComponent;

  Component.displayName = displayName;
  Component[INLINE_AFFORDANCE_SLOT] = kind;
  return Component;
};

const resolveSlotKind = (child: React.ReactNode): InlineAffordanceSlotKind | null => {
  if (!React.isValidElement(child)) {
    return null;
  }
  const type = child.type as { [INLINE_AFFORDANCE_SLOT]?: InlineAffordanceSlotKind };
  return type[INLINE_AFFORDANCE_SLOT] ?? null;
};

export const resolveInlineAffordanceLayout = (children: React.ReactNode): InlineAffordanceLayout => {
  let hasLeading = false;
  let hasLabel = false;
  let hasTrailing = false;

  React.Children.forEach(children, (child) => {
    const kind = resolveSlotKind(child);
    if (kind === "leading") {
      hasLeading = true;
      return;
    }
    if (kind === "label") {
      hasLabel = true;
      return;
    }
    if (kind === "trailing" || kind === "meta") {
      hasTrailing = true;
    }
  });

  if (!hasLeading && !hasLabel && !hasTrailing) {
    return "plain";
  }
  if (!hasLabel && (hasLeading || hasTrailing)) {
    return "icon-only";
  }
  if (hasLeading && hasTrailing) {
    return "both";
  }
  if (hasLeading) {
    return "leading";
  }
  if (hasTrailing) {
    return "trailing";
  }
  return "plain";
};

const inlineAffordanceVariants = cva("min-w-0 items-center", {
  variants: {
    size: {
      inline: "inline-flex gap-2",
      control: "inline-flex min-h-9 gap-2 rounded-md text-sm",
      controlSm: "inline-flex min-h-8 gap-1.5 rounded-md text-xs",
      controlLg: "inline-flex min-h-10 gap-2 rounded-md text-sm",
      pill: "inline-flex gap-1.5 rounded-full text-[11px] leading-none",
    },
    layout: {
      plain: "",
      "icon-only": "justify-center",
      leading: "",
      trailing: "",
      both: "",
    },
    fill: {
      true: "flex w-full",
      false: "",
    },
  },
  compoundVariants: [
    { size: "control", layout: "plain", className: "px-4 py-2" },
    { size: "control", layout: "icon-only", className: "h-9 w-9 p-0" },
    { size: "control", layout: "leading", className: "ps-2 pe-4 py-2" },
    { size: "control", layout: "trailing", className: "ps-4 pe-2 py-2" },
    { size: "control", layout: "both", className: "px-2 py-2" },

    { size: "controlSm", layout: "plain", className: "px-3 py-1.5" },
    { size: "controlSm", layout: "icon-only", className: "h-8 w-8 p-0" },
    { size: "controlSm", layout: "leading", className: "ps-1.5 pe-3 py-1.5" },
    { size: "controlSm", layout: "trailing", className: "ps-3 pe-1.5 py-1.5" },
    { size: "controlSm", layout: "both", className: "px-1.5 py-1.5" },

    { size: "controlLg", layout: "plain", className: "px-6 py-2.5" },
    { size: "controlLg", layout: "icon-only", className: "h-10 w-10 p-0" },
    { size: "controlLg", layout: "leading", className: "ps-2.5 pe-6 py-2.5" },
    { size: "controlLg", layout: "trailing", className: "ps-6 pe-2.5 py-2.5" },
    { size: "controlLg", layout: "both", className: "px-2.5 py-2.5" },

    { size: "pill", layout: "plain", className: "px-2 py-0.5" },
    { size: "pill", layout: "icon-only", className: "h-6 w-6 p-0" },
    { size: "pill", layout: "leading", className: "ps-1 pe-2 py-1" },
    { size: "pill", layout: "trailing", className: "ps-2 pe-1 py-1" },
    { size: "pill", layout: "both", className: "px-1 py-1" },
  ],
  defaultVariants: {
    size: "inline",
    layout: "plain",
    fill: false,
  },
});

export interface InlineAffordanceProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: VariantProps<typeof inlineAffordanceVariants>["size"];
  fill?: boolean;
}

export const inlineAffordanceClassName = (input: {
  size?: VariantProps<typeof inlineAffordanceVariants>["size"];
  layout: InlineAffordanceLayout;
  fill?: boolean;
  className?: string;
}): string =>
  cn(
    inlineAffordanceVariants({
      size: input.size,
      layout: input.layout,
      fill: input.fill,
    }),
    input.className,
  );

export const InlineAffordance = React.forwardRef<HTMLSpanElement, InlineAffordanceProps>(
  ({ children, className, size = "inline", fill = false, ...props }, ref) => {
    const layout = resolveInlineAffordanceLayout(children);
    return (
      <span
        ref={ref}
        data-inline-affordance=""
        data-inline-affordance-layout={layout}
        className={inlineAffordanceClassName({
          size,
          layout,
          fill,
          className,
        })}
        {...props}
      >
        {children}
      </span>
    );
  },
);
InlineAffordance.displayName = "InlineAffordance";

export const InlineAffordanceLeadingVisual = createInlineAffordanceSlot(
  "InlineAffordanceLeadingVisual",
  "inline-affordance-leading",
  "leading",
  "shrink-0",
);

export const InlineAffordanceLabel = createInlineAffordanceSlot(
  "InlineAffordanceLabel",
  "inline-affordance-label",
  "label",
  "min-w-0",
);

export const InlineAffordanceTrailingVisual = createInlineAffordanceSlot(
  "InlineAffordanceTrailingVisual",
  "inline-affordance-trailing",
  "trailing",
  "shrink-0",
);

export const InlineAffordanceMeta = createInlineAffordanceSlot(
  "InlineAffordanceMeta",
  "inline-affordance-meta",
  "meta",
  "ml-auto shrink-0",
);
