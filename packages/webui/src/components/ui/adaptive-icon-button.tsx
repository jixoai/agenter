import type { ComponentType, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { Button, ButtonLabel, ButtonLeadingVisual, type ButtonProps } from "./button";
import { Tooltip } from "./tooltip";

interface AdaptiveIconButtonProps extends Omit<ButtonProps, "children"> {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tooltip?: ReactNode;
  labelPriority?: "auto" | "always" | "icon-only";
  containerClassName?: string;
}

const ICON_ONLY_ALLOWANCE_PX = 42;

export const AdaptiveIconButton = ({
  icon: Icon,
  label,
  tooltip,
  title,
  className,
  labelPriority = "auto",
  containerClassName,
  ...props
}: AdaptiveIconButtonProps) => {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const [iconOnly, setIconOnly] = useState(false);

  useLayoutEffect(() => {
    if (labelPriority === "icon-only") {
      setIconOnly(true);
      return;
    }
    if (labelPriority === "always" || typeof ResizeObserver === "undefined") {
      setIconOnly(false);
      return;
    }
    const container = containerRef.current;
    const labelNode = labelRef.current;
    if (!container || !labelNode) {
      return;
    }

    const update = () => {
      const nextIconOnly =
        container.clientWidth > 0 && container.clientWidth < labelNode.scrollWidth + ICON_ONLY_ALLOWANCE_PX;
      setIconOnly((current) => (current === nextIconOnly ? current : nextIconOnly));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(labelNode);
    return () => {
      observer.disconnect();
    };
  }, [labelPriority]);

  const buttonNode = (
    <span
      ref={containerRef}
      className={cn("relative flex max-w-full min-w-0", iconOnly && "justify-center", containerClassName)}
    >
      <span ref={labelRef} aria-hidden className="pointer-events-none invisible absolute whitespace-nowrap">
        {label}
      </span>
      <Button
        {...props}
        aria-label={label}
        title={title ?? label}
        className={cn("w-full max-w-full min-w-0", className)}
      >
        <ButtonLeadingVisual>
          <Icon className="h-3.5 w-3.5" />
        </ButtonLeadingVisual>
        {!iconOnly ? (
          <ButtonLabel>
            <span className="min-w-0 truncate">{label}</span>
          </ButtonLabel>
        ) : null}
      </Button>
    </span>
  );

  if (iconOnly || tooltip) {
    return <Tooltip content={tooltip ?? label}>{buttonNode}</Tooltip>;
  }

  return buttonNode;
};
