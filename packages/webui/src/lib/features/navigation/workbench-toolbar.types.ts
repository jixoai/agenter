export type WorkbenchToolbarBreakpoint = 'narrow' | 'compact' | 'wide';
export type WorkbenchToolbarDensity = 'dense' | 'regular' | 'relaxed';

export interface WorkbenchToolbarRenderState {
	width: number;
	breakpoint: WorkbenchToolbarBreakpoint;
	density: WorkbenchToolbarDensity;
	isNarrow: boolean;
	isCompact: boolean;
	isWide: boolean;
}
