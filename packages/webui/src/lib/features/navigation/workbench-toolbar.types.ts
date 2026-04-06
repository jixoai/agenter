export type WorkbenchToolbarBreakpoint = 'narrow' | 'compact' | 'wide';

export interface WorkbenchToolbarRenderState {
	width: number;
	breakpoint: WorkbenchToolbarBreakpoint;
	rows: 1 | 2;
	fixed: boolean;
	isNarrow: boolean;
	isCompact: boolean;
	isWide: boolean;
}
