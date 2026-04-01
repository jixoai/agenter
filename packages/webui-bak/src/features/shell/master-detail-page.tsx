import { X } from "lucide-react";
import type { ComponentType, MouseEventHandler, ReactNode } from "react";
import { useEffect, useState } from "react";

import { Sheet } from "../../components/ui/sheet";
import { IconAction } from "./IconAction";
import { useCompactViewport } from "./useCompactViewport";

interface MasterDetailPageProps {
  main: ReactNode;
  detail: ReactNode;
  detailTitle: string;
  detailChrome?: ReactNode;
  mobileDetailOpen: boolean;
  onMobileDetailOpenChange: (open: boolean) => void;
  detailSelectionKey?: string | null;
  autoOpenMobileOnSelection?: boolean;
  desktopDetailVisible?: boolean;
  onDesktopDetailVisibleChange?: (open: boolean) => void;
  desktopResizable?: boolean;
  desktopSplitStorageKey?: string;
  defaultDesktopMainWidthPercent?: number;
  minDesktopMainWidthPercent?: number;
  maxDesktopMainWidthPercent?: number;
  hiddenDesktopDetailTrigger?: {
    label: string;
    icon: ComponentType<{ className?: string }>;
  };
}

const DEFAULT_MIN_SPLIT_PERCENT = 40;
const DEFAULT_MAX_SPLIT_PERCENT = 82;
const DEFAULT_MAIN_SPLIT_PERCENT = 64;
const clampSplitPercent = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const readSplitPercent = (storageKey: string | undefined, fallback: number, min: number, max: number): number => {
  if (typeof window === "undefined" || !storageKey) {
    return clampSplitPercent(fallback, min, max);
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return clampSplitPercent(fallback, min, max);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return clampSplitPercent(fallback, min, max);
  }
  return clampSplitPercent(value, min, max);
};

export const MasterDetailPage = ({
  main,
  detail,
  detailTitle,
  detailChrome,
  mobileDetailOpen,
  onMobileDetailOpenChange,
  detailSelectionKey,
  autoOpenMobileOnSelection = false,
  desktopDetailVisible = true,
  onDesktopDetailVisibleChange,
  desktopResizable = false,
  desktopSplitStorageKey,
  defaultDesktopMainWidthPercent = DEFAULT_MAIN_SPLIT_PERCENT,
  minDesktopMainWidthPercent = DEFAULT_MIN_SPLIT_PERCENT,
  maxDesktopMainWidthPercent = DEFAULT_MAX_SPLIT_PERCENT,
  hiddenDesktopDetailTrigger,
}: MasterDetailPageProps) => {
  const compactViewport = useCompactViewport();
  const [desktopMainWidthPercent, setDesktopMainWidthPercent] = useState(() =>
    readSplitPercent(
      desktopSplitStorageKey,
      defaultDesktopMainWidthPercent,
      minDesktopMainWidthPercent,
      maxDesktopMainWidthPercent,
    ),
  );

  useEffect(() => {
    if (!compactViewport && mobileDetailOpen) {
      onMobileDetailOpenChange(false);
    }
  }, [compactViewport, mobileDetailOpen, onMobileDetailOpenChange]);

  useEffect(() => {
    if (!compactViewport || !autoOpenMobileOnSelection || !detailSelectionKey) {
      return;
    }
    onMobileDetailOpenChange(true);
  }, [autoOpenMobileOnSelection, compactViewport, detailSelectionKey, onMobileDetailOpenChange]);

  useEffect(() => {
    setDesktopMainWidthPercent(
      readSplitPercent(
        desktopSplitStorageKey,
        defaultDesktopMainWidthPercent,
        minDesktopMainWidthPercent,
        maxDesktopMainWidthPercent,
      ),
    );
  }, [defaultDesktopMainWidthPercent, desktopSplitStorageKey, maxDesktopMainWidthPercent, minDesktopMainWidthPercent]);

  const persistDesktopSplit = (value: number) => {
    const next = clampSplitPercent(value, minDesktopMainWidthPercent, maxDesktopMainWidthPercent);
    setDesktopMainWidthPercent(next);
    if (typeof window !== "undefined" && desktopSplitStorageKey) {
      window.localStorage.setItem(desktopSplitStorageKey, String(next));
    }
  };

  const handleDesktopResizeStart: MouseEventHandler<HTMLDivElement> = (event) => {
    if (!desktopResizable || typeof window === "undefined") {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startPercent = desktopMainWidthPercent;
    const viewportWidth = Math.max(window.innerWidth, 1);

    const onMove = (moveEvent: MouseEvent) => {
      const deltaPercent = ((moveEvent.clientX - startX) / viewportWidth) * 100;
      persistDesktopSplit(startPercent + deltaPercent);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const showDesktopHide = desktopDetailVisible && onDesktopDetailVisibleChange;
  const showDesktopResize = desktopDetailVisible && desktopResizable;
  const desktopMainStyle = showDesktopResize ? { width: `${desktopMainWidthPercent}%` } : undefined;
  const desktopDetailStyle = showDesktopResize ? { width: `${100 - desktopMainWidthPercent}%` } : undefined;

  if (compactViewport) {
    return (
      <div className="h-full">
        <div className="h-full">{main}</div>
        <Sheet open={mobileDetailOpen} onOpenChange={onMobileDetailOpenChange} side="right" title={detailTitle}>
          {detailChrome ? <div className="mb-3">{detailChrome}</div> : null}
          <div className="flex h-full flex-col">{detail}</div>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex h-full items-stretch gap-3">
        <div
          data-slot="master-detail-main"
          style={desktopMainStyle}
          className={`h-full ${showDesktopResize ? "" : "flex-1"}`}
        >
          {main}
        </div>
        {desktopDetailVisible ? (
          <>
            {showDesktopResize ? (
              <div
                data-slot="master-detail-resizer"
                role="separator"
                aria-orientation="vertical"
                title={`Resize ${detailTitle} panel`}
                onMouseDown={handleDesktopResizeStart}
                className="w-1 cursor-col-resize rounded-full bg-slate-200 transition-colors hover:bg-teal-400"
              />
            ) : null}
            <aside
              data-slot="master-detail-detail"
              style={desktopDetailStyle}
              className={`flex h-full ${showDesktopResize ? "" : "flex-1"} flex-col gap-3`}
            >
              {showDesktopHide ? (
                <div className="flex items-center justify-end gap-2">
                  <IconAction
                    label={`Hide ${detailTitle}`}
                    icon={X}
                    variant="ghost"
                    onClick={() => onDesktopDetailVisibleChange(false)}
                  />
                </div>
              ) : null}
              {detailChrome ? <div>{detailChrome}</div> : null}
              <div className="flex-1">{detail}</div>
            </aside>
          </>
        ) : null}
      </div>

      {!desktopDetailVisible && hiddenDesktopDetailTrigger && onDesktopDetailVisibleChange ? (
        <div className="fixed right-4 bottom-4">
          <IconAction
            label={hiddenDesktopDetailTrigger.label}
            icon={hiddenDesktopDetailTrigger.icon}
            onClick={() => onDesktopDetailVisibleChange(true)}
          />
        </div>
      ) : null}
    </div>
  );
};
