import { getContext, setContext } from 'svelte';

class WorkbenchPageToolbarRegistry {
	host = $state.raw<HTMLElement | null>(null);
}

const WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY = Symbol('agenter-workbench-page-toolbar');

export const setWorkbenchPageToolbarRegistry = (): WorkbenchPageToolbarRegistry => {
	return setContext(WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY, new WorkbenchPageToolbarRegistry());
};

export const getWorkbenchPageToolbarRegistry = (): WorkbenchPageToolbarRegistry | undefined => {
	return getContext(WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY);
};
