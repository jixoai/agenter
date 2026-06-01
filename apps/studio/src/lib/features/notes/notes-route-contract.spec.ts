import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../../../../..');
const readSource = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8');

describe('Feature: Studio Notes route contract', () => {
	test('Scenario: Given app shell navigation When notes is available Then the Notes item routes to /notes and owns active state through the shared nav list', () => {
		const appShellSource = readSource('apps/studio/src/lib/features/shell/app-shell.svelte');

		expect(appShellSource).toContain("import NotebookTextIcon from '@lucide/svelte/icons/notebook-text';");
		expect(appShellSource).toContain("{ href: '/notes', label: 'Notes', icon: NotebookTextIcon }");
		expect(appShellSource).toContain("page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`)");
		expect(existsSync(resolve(repoRoot, 'apps/studio/src/routes/(app)/notes/+page.svelte'))).toBe(true);
	});

	test('Scenario: Given Notes route source When reviewers inspect boundaries Then it consumes client runtime-store facades without app-server internals', () => {
		const routeSource = readSource('apps/studio/src/lib/features/notes/notes-route.svelte');
		const pageSource = readSource('apps/studio/src/routes/(app)/notes/+page.svelte');

		expect(pageSource).toContain("import NotesRoute from '$lib/features/notes/notes-route.svelte';");
		expect(routeSource).toContain('controller.runtimeStore.listNoteCatalog');
		expect(routeSource).toContain('controller.runtimeStore.readNotePage');
		expect(routeSource).toContain('controller.runtimeStore.searchNotes');
		expect(routeSource).toContain('controller.runtimeStore.listNoteTags');
		expect(routeSource).toContain('controller.runtimeStore.queryNotes');
		expect(routeSource).toContain('Read-only SQL');
		expect(routeSource).toContain('References');
		expect(routeSource).toContain('<ScrollView');
		expect(routeSource).toContain('No NoteSystem capability');
		expect(routeSource).not.toContain('@agenter/app-server');
		expect(routeSource).not.toContain('packages/app-server/src/note-system');
	});
});
