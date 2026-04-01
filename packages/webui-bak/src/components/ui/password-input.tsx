import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input, type InputProps } from "./input";

export interface PasswordInputProps extends InputProps {
  toggleLabel?: {
    show: string;
    hide: string;
  };
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, toggleLabel, type: _type, ...props }, ref) => {
    const [revealed, setRevealed] = React.useState(false);
    const labels = toggleLabel ?? { show: "Show value", hide: "Hide value" };

    return (
      <div className={cn("relative flex items-center", className)}>
        <Input ref={ref} {...props} type={revealed ? "text" : "password"} className="pr-11" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute inset-y-0 right-0 my-auto mr-1 h-7 w-7"
          aria-label={revealed ? labels.hide : labels.show}
          title={revealed ? labels.hide : labels.show}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
