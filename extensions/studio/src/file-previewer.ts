import { mount } from 'svelte';

import './routes/layout.css';
import FilePreviewerApp from './file-previewer-app/file-previewer-app.svelte';

mount(FilePreviewerApp, {
	target: document.getElementById('app')!,
});
