import Root from "./workbench-split-detail-root.svelte";
import Main from "./workbench-split-detail-main.svelte";
import Handle from "./workbench-split-detail-handle.svelte";
import Detail from "./workbench-split-detail-detail.svelte";

export type {
	WorkbenchSplitDetailLayoutResolution,
	WorkbenchSplitDetailMathOptions,
	WorkbenchSplitDetailPointerRatioOptions,
	WorkbenchSplitDetailRatioShiftOptions,
} from "./workbench-split-detail-math.js";
export {
	clampWorkbenchSplitDetailRatio,
	resolveWorkbenchSplitDetailLayout,
	resolveWorkbenchSplitDetailMaxRatio,
	resolveWorkbenchSplitDetailMinRatio,
	resolveWorkbenchSplitDetailRatioFromPointer,
	resolveWorkbenchSplitDetailThreshold,
	shiftWorkbenchSplitDetailRatio,
} from "./workbench-split-detail-math.js";
export type {
	WorkbenchSplitDetailRatioPersistence,
	WorkbenchSplitDetailRatioSource,
} from "./workbench-split-detail-ratio-source.js";
export {
	getDefaultWorkbenchSplitDetailRatioSource,
	resolveWorkbenchSplitDetailRatioSource,
} from "./workbench-split-detail-ratio-source.js";
export {
	Root,
	Main,
	Handle,
	Detail,
	Root as WorkbenchSplitDetailRoot,
	Main as WorkbenchSplitDetailMain,
	Handle as WorkbenchSplitDetailHandle,
	Detail as WorkbenchSplitDetailDetail,
};
