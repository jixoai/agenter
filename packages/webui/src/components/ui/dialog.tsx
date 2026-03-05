import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";

import { cn } from "../../lib/utils";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Dialog = ({ open, title, description, onClose, children, footer }: DialogProps) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[90dvh] rounded-xl border border-slate-200 bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(92vw,48rem)] md:-translate-x-1/2 md:-translate-y-1/2">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-sm font-semibold text-slate-900">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="text-xs text-slate-600">{description}</DialogPrimitive.Description> : null}
            </div>
            <DialogPrimitive.Close
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-100",
              )}
              aria-label="Close dialog"
            >
              ×
            </DialogPrimitive.Close>
          </header>
          <div className="max-h-[70dvh] overflow-auto p-4">{children}</div>
          {footer ? <footer className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">{footer}</footer> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
