import { describe, expect, test } from 'vitest';

import {
	createNotePageKey,
	firstNotePageIdentity,
	flattenNoteCatalog,
	hasNoteCapability,
	mapNoteSearchRows,
	sameNotePageIdentity,
} from './notes-state';

const catalog = {
	avatar: {
		nickname: 'shell-assistant',
		principalId: 'auth:shell-assistant',
		avatarHome: ['/avatar/shell-assistant'],
	},
	capability: {
		available: true,
		readableRoots: ['/avatar/shell-assistant'],
		writableRoot: '/avatar/shell-assistant',
	},
	notebooks: [
		{
			notebook: 'ideas',
			sections: [
				{
					section: 'shell',
					pages: [
						{
							notebook: 'ideas',
							section: 'shell',
							page: 'note-system',
							path: '/avatar/shell-assistant/notes/ideas/shell/note-system.md',
							id: 'page_note_system',
							bookId: 'book_ideas',
							sectionId: 'section_shell',
							pageId: 'page_note_system',
							createdAt: '2026-05-31T15:30:00.000Z',
							updatedAt: '2026-05-31T15:31:00.000Z',
							mime: 'text/markdown',
							tags: [],
							tagIds: [],
							referenceCount: 0,
							preview: 'NoteSystem route.',
						},
					],
				},
			],
		},
	],
	totalPages: 1,
};

describe('Feature: Notes route state projection', () => {
	test('Scenario: Given no note capability When Notes route state is projected Then the no-capability state is explicit', () => {
		const emptyCatalog = {
			avatar: {
				nickname: 'missing',
				principalId: null,
				avatarHome: [],
			},
			capability: {
				available: false,
				readableRoots: [],
				writableRoot: null,
			},
			notebooks: [],
			totalPages: 0,
		};

		expect(hasNoteCapability(emptyCatalog)).toBe(false);
		expect(flattenNoteCatalog(emptyCatalog)).toEqual([]);
		expect(firstNotePageIdentity(emptyCatalog)).toBeNull();
	});

	test('Scenario: Given populated notes When Notes route state is projected Then grouping and selected identity stay stable', () => {
		const rows = flattenNoteCatalog(catalog);

		expect(hasNoteCapability(catalog)).toBe(true);
		expect(rows).toEqual([
			expect.objectContaining({
				key: 'ideas/shell/note-system',
				notebook: 'ideas',
				section: 'shell',
				page: 'note-system',
			}),
		]);
		expect(firstNotePageIdentity(catalog)).toEqual({
			notebook: 'ideas',
			section: 'shell',
			page: 'note-system',
		});
		expect(
			sameNotePageIdentity(firstNotePageIdentity(catalog), {
				notebook: 'ideas',
				section: 'shell',
				page: 'note-system',
			}),
		).toBe(true);
	});

	test('Scenario: Given search results When mapped for rendering Then result keys preserve notebook section and page identity', () => {
		expect(
			mapNoteSearchRows([
				{
					notebook: 'ideas',
					section: 'shell',
					page: 'note-system',
					id: 'page_note_system',
					bookId: 'book_ideas',
					sectionId: 'section_shell',
					pageId: 'page_note_system',
					path: '/avatar/shell-assistant/notes/ideas/shell/note-system.md',
					score: 1.25,
					snippet: 'NoteSystem route.',
					tags: [],
					references: [],
				},
			]),
		).toEqual([
			expect.objectContaining({
				key: createNotePageKey({
					notebook: 'ideas',
					section: 'shell',
					page: 'note-system',
				}),
				snippet: 'NoteSystem route.',
			}),
		]);
	});
});
