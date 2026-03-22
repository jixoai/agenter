import {
  TERMINAL_VIEW_TAG,
  defineTerminalView,
  type TerminalViewElement,
  type TerminalViewSnapshot,
} from "@agenter/terminal-view";
import { createElement, useEffect, useRef } from "react";

import { cn } from "../../lib/utils";

interface TerminalViewHostProps {
  terminalId: string;
  terminalTitle?: string;
  cwd?: string;
  status: "IDLE" | "BUSY";
  viewportMode?: "fit" | "cover";
  transportUrl?: string;
  snapshot?: TerminalViewSnapshot | null;
  className?: string;
  testId?: string;
}

type TerminalViewHostElement = HTMLElement &
  Pick<TerminalViewElement, "transportUrl" | "terminalId" | "terminalTitle" | "cwd" | "status" | "viewportMode" | "snapshot">;

export const TerminalViewHost = ({
  terminalId,
  terminalTitle,
  cwd,
  status,
  viewportMode = "fit",
  transportUrl,
  snapshot,
  className,
  testId,
}: TerminalViewHostProps) => {
  const elementRef = useRef<TerminalViewHostElement | null>(null);

  useEffect(() => {
    if (typeof customElements === "undefined") {
      return;
    }
    defineTerminalView();
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    element.transportUrl = transportUrl ?? "";
    element.terminalId = terminalId;
    element.terminalTitle = terminalTitle ?? terminalId;
    element.cwd = cwd ?? "";
    element.status = status;
    element.viewportMode = viewportMode;
    element.snapshot = snapshot ?? null;
  }, [cwd, snapshot, status, terminalId, terminalTitle, transportUrl, viewportMode]);

  return createElement(TERMINAL_VIEW_TAG, {
    ref: (node: Element | null) => {
      elementRef.current = node as TerminalViewHostElement | null;
    },
    className: cn("block h-full w-full", className),
    "data-terminal-host-root": "true",
    "data-testid": testId,
  });
};
