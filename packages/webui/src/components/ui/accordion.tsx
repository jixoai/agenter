import { Accordion as AccordionPrimitive } from "@base-ui-components/react/accordion";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";

type AccordionSingleProps = {
  type?: "single";
  collapsible?: boolean;
} & Omit<React.ComponentProps<typeof AccordionPrimitive.Root>, "multiple">;

type AccordionMultipleProps = {
  type: "multiple";
  collapsible?: boolean;
} & Omit<React.ComponentProps<typeof AccordionPrimitive.Root>, "multiple">;

type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

function Accordion({ type = "single", collapsible, ...props }: AccordionProps) {
  return <AccordionPrimitive.Root data-slot="accordion" multiple={type === "multiple"} {...props} />;
}

function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b", className)} {...props} />;
}

function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:ring-ring/50 flex flex-1 items-center justify-between gap-2 rounded-md py-1.5 text-left text-xs font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 data-[panel-open]:[&>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Panel>) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        "data-[ending-style]:animate-accordion-up data-[starting-style]:animate-accordion-down overflow-hidden text-xs",
        className,
      )}
      {...props}
    >
      <div className={cn("pb-2", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
