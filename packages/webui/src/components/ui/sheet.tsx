import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";

const sheetVariants = cva(
  "fixed z-50 bg-white shadow-xl outline-none data-[ending-style]:animate-out data-[starting-style]:animate-in",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b border-slate-200",
        right: "inset-y-0 right-0 h-full w-screen border-l border-slate-200 sm:w-[90vw] sm:max-w-2xl",
        bottom: "inset-x-0 bottom-0 border-t border-slate-200",
        left: "inset-y-0 left-0 h-full w-screen border-r border-slate-200 sm:w-[90vw] sm:max-w-md",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetProps extends VariantProps<typeof sheetVariants> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export const Sheet = ({ open, onOpenChange, title, side, children }: SheetProps) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="data-[ending-style]:animate-out data-[starting-style]:animate-in fixed inset-0 z-40 bg-slate-900/55" />
        <DialogPrimitive.Popup className={cn(sheetVariants({ side }))}>
          <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <DialogPrimitive.Title className="typo-title-3 text-slate-900">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </header>
          <div className="h-[calc(100%-49px)] overflow-auto p-3">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
