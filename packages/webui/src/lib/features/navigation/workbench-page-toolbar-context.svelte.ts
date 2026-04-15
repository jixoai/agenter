import { getContext, setContext } from 'svelte';

export interface WorkbenchPageToolbarTakeover {
	kind: 'close-only';
	label?: string;
	onClose: () => void;
}

class WorkbenchPageToolbarRegistry {
	host = $state.raw<HTMLElement | null>(null);
	takeover = $state.raw<WorkbenchPageToolbarTakeover | null>(null);
}

const WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY = Symbol('agenter-workbench-page-toolbar');

export const setWorkbenchPageToolbarRegistry = (): WorkbenchPageToolbarRegistry => {
	return setContext(WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY, new WorkbenchPageToolbarRegistry());
};

export const getWorkbenchPageToolbarRegistry = (): WorkbenchPageToolbarRegistry | undefined => {
	return getContext(WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY);
};
