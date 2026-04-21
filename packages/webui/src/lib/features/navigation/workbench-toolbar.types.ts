export type WorkbenchToolbarBreakpoint = "narrow" | "compact" | "wide";
export type WorkbenchToolbarDensity = "dense" | "regular" | "relaxed";
export type WorkbenchToolbarPlacement = "inline" | "overflow";
export type WorkbenchToolbarAnchorKind = "page-tabs" | "identity" | "none";
export type WorkbenchToolbarCollapseStage = "wide" | "overflow-secondary" | "overflow-subtitle" | "overflow-identity";

export interface WorkbenchToolbarRenderState {
  width: number;
  breakpoint: WorkbenchToolbarBreakpoint;
  density: WorkbenchToolbarDensity;
  placement: WorkbenchToolbarPlacement;
  anchorKind: WorkbenchToolbarAnchorKind;
  collapseStage: WorkbenchToolbarCollapseStage;
  hasPageTabs: boolean;
  isNarrow: boolean;
  isCompact: boolean;
  isWide: boolean;
  showInlineActions: boolean;
  showInlineStatus: boolean;
  showInlineSubtitle: boolean;
  showInlineIdentity: boolean;
  showOverflowTrigger: boolean;
}
