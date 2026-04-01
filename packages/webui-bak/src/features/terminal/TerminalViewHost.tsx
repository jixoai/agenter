import {
  TERMINAL_VIEW_TAG,
  defineTerminalView,
  type TerminalViewElement,
  type TerminalViewSnapshot,
} from "@agenter/terminal-view";
import { createElement, useEffect, useLayoutEffect, useRef } from "react";

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

const syncTerminalViewProps = (
  element: TerminalViewHostElement,
  props: {
    terminalId: string;
    terminalTitle?: string;
    cwd?: string;
    status: "IDLE" | "BUSY";
    viewportMode: "fit" | "cover";
    transportUrl?: string;
    snapshot?: TerminalViewSnapshot | null;
  },
) => {
  element.transportUrl = props.transportUrl ?? "";
  element.terminalId = props.terminalId;
  element.terminalTitle = props.terminalTitle ?? props.terminalId;
  element.cwd = props.cwd ?? "";
  element.status = props.status;
  element.viewportMode = props.viewportMode;
  element.snapshot = props.snapshot ?? null;
};

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
  const elementProps = {
    terminalId,
    terminalTitle,
    cwd,
    status,
    viewportMode,
    transportUrl,
    snapshot,
  };

  useEffect(() => {
    if (typeof customElements === "undefined") {
      return;
    }
    defineTerminalView();
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    syncTerminalViewProps(element, elementProps);
  }, [cwd, snapshot, status, terminalId, terminalTitle, transportUrl, viewportMode]);

  return createElement(TERMINAL_VIEW_TAG, {
    ref: (node: Element | null) => {
      const element = node as TerminalViewHostElement | null;
      elementRef.current = element;
      if (element) {
        syncTerminalViewProps(element, elementProps);
      }
    },
    className: cn("block h-full w-full", className),
    "data-terminal-host-root": "true",
    "data-testid": testId,
  });
};
