export type WorkbenchToolbarBreakpoint = "narrow" | "compact" | "wide";
export type WorkbenchToolbarDensity = "dense" | "regular" | "relaxed";
export type WorkbenchToolbarPlacement = "inline" | "overflow";
export type WorkbenchToolbarAnchorKind = "page-tabs" | "identity" | "none";
export type WorkbenchToolbarCollapseStage = "wide" | "overflow-secondary" | "overflow-subtitle" | "overflow-identity";

/**
 * Shared page-toolbar render state.
 *
 * Route code should declare page-local identity, status, and actions once through the shared
 * toolbar slots, then only branch on `placement` for small spacing differences between inline
 * chrome and the overflow panel. Breakpoint collapse belongs to the shared toolbar primitive,
 * so feature routes should not fork separate mobile-only toolbars around the same controls.
 */
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
