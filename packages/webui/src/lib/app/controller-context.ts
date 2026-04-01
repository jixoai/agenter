import { getContext, setContext } from 'svelte';

import type { AppController } from './types';

const APP_CONTROLLER_CONTEXT_KEY = Symbol('agenter-app-controller');

export const setAppControllerContext = (controller: AppController): AppController => {
	setContext(APP_CONTROLLER_CONTEXT_KEY, controller);
	return controller;
};

export const getAppControllerContext = (): AppController => {
	return getContext<AppController>(APP_CONTROLLER_CONTEXT_KEY);
};
