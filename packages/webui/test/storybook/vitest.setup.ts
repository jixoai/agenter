import { setProjectAnnotations } from '@storybook/sveltekit';

import preview from '../../.storybook/preview';

if (typeof window !== 'undefined') {
	window.addEventListener('error', (event) => {
		if (event.message === 'ResizeObserver loop completed with undelivered notifications.') {
			event.preventDefault();
		}
	});
}

setProjectAnnotations(preview);
