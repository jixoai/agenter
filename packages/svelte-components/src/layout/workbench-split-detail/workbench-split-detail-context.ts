import { getContext, setContext } from "svelte";

export interface WorkbenchSplitDetailContext {
	compact: () => boolean;
	ratio: () => number;
}

const WORKBENCH_SPLIT_DETAIL_CONTEXT_KEY = Symbol("agenter-workbench-split-detail");

export const setWorkbenchSplitDetailContext = (
	value: WorkbenchSplitDetailContext,
): WorkbenchSplitDetailContext => {
	return setContext(WORKBENCH_SPLIT_DETAIL_CONTEXT_KEY, value);
};

export const getWorkbenchSplitDetailContext = (): WorkbenchSplitDetailContext | undefined => {
	return getContext(WORKBENCH_SPLIT_DETAIL_CONTEXT_KEY);
};
