import { mount } from 'svelte';

import './routes/layout.css';
import WorkbenchToolbarPreviewPage from './lib/features/navigation/workbench-toolbar-preview-page.svelte';

mount(WorkbenchToolbarPreviewPage, {
	target: document.getElementById('app')!,
});
