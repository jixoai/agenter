import { getContext, setContext } from 'svelte';
import type { Snippet } from 'svelte';

class WorkbenchPageToolbarRegistry {
	content = $state<Snippet | null>(null);

	set(content: Snippet | null): void {
		this.content = content;
	}

	clear(content?: Snippet | null): void {
		if (content && this.content !== content) {
			return;
		}
		this.content = null;
	}
}

const WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY = Symbol('agenter-workbench-page-toolbar');

export const setWorkbenchPageToolbarRegistry = (): WorkbenchPageToolbarRegistry => {
	return setContext(WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY, new WorkbenchPageToolbarRegistry());
};

export const getWorkbenchPageToolbarRegistry = (): WorkbenchPageToolbarRegistry | undefined => {
	return getContext(WORKBENCH_PAGE_TOOLBAR_CONTEXT_KEY);
};
