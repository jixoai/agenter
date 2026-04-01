import type { ComponentType } from "react";

import type { ButtonProps } from "../../components/ui/button";
import { Button } from "../../components/ui/button";
import { Tooltip } from "../../components/ui/tooltip";

interface IconActionProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export const IconAction = ({
  label,
  icon: Icon,
  variant = "secondary",
  disabled,
  onClick,
  className,
}: IconActionProps) => (
  <Tooltip content={label}>
    <Button
      size="icon"
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={className}
    >
      <Icon className="h-4 w-4" />
    </Button>
  </Tooltip>
);
