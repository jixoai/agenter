import { useEffect, useState } from "react";

export type AdaptiveWidthClass = "compact" | "medium" | "expanded";
export type AdaptiveOrientation = "portrait" | "landscape";
export type WorkspaceNavMode = "top" | "bottom";
export type GlobalNavMode = "rail" | "drawer";

export interface AdaptiveViewportState {
  widthClass: AdaptiveWidthClass;
  orientation: AdaptiveOrientation;
  compact: boolean;
  workspaceNavMode: WorkspaceNavMode;
  globalNavMode: GlobalNavMode;
}

const EXPANDED_MIN_WIDTH = 1280;
const MEDIUM_MIN_WIDTH = 768;

const readWindowSize = (): { width: number; height: number } => {
  if (typeof window === "undefined") {
    return { width: EXPANDED_MIN_WIDTH, height: 900 };
  }
  return {
    width: Math.max(window.innerWidth, 0),
    height: Math.max(window.innerHeight, 0),
  };
};

export const resolveAdaptiveViewportState = (input: {
  width: number;
  height: number;
}): AdaptiveViewportState => {
  const widthClass: AdaptiveWidthClass =
    input.width >= EXPANDED_MIN_WIDTH ? "expanded" : input.width >= MEDIUM_MIN_WIDTH ? "medium" : "compact";
  const orientation: AdaptiveOrientation = input.width > input.height ? "landscape" : "portrait";
  const workspaceNavMode: WorkspaceNavMode =
    widthClass === "expanded" || orientation === "landscape" ? "top" : "bottom";

  return {
    widthClass,
    orientation,
    compact: widthClass !== "expanded",
    workspaceNavMode,
    globalNavMode: widthClass === "expanded" ? "rail" : "drawer",
  };
};

export const useAdaptiveViewport = (): AdaptiveViewportState => {
  const [state, setState] = useState(() => resolveAdaptiveViewportState(readWindowSize()));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const update = () => setState(resolveAdaptiveViewportState(readWindowSize()));

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
};
