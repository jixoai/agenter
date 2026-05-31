import type { NoteCatalogOutput, NotePageSummary, NoteSearchResult } from '@agenter/client-sdk';

export interface NotePageIdentity {
	notebook: string;
	section: string;
	page: string;
}

export interface NotePageRow extends NotePageSummary {
	key: string;
}

export interface NoteSearchRow extends NoteSearchResult {
	key: string;
}

export const createNotePageKey = (identity: NotePageIdentity): string =>
	`${identity.notebook}/${identity.section}/${identity.page}`;

export const sameNotePageIdentity = (left: NotePageIdentity | null, right: NotePageIdentity | null): boolean =>
	Boolean(
		left &&
			right &&
			left.notebook === right.notebook &&
			left.section === right.section &&
			left.page === right.page,
	);

export const flattenNoteCatalog = (catalog: NoteCatalogOutput | null): NotePageRow[] =>
	catalog
		? catalog.notebooks.flatMap((notebook) =>
				notebook.sections.flatMap((section) =>
					section.pages.map((page) => ({
						...page,
						key: createNotePageKey(page),
					})),
				),
			)
		: [];

export const mapNoteSearchRows = (results: readonly NoteSearchResult[]): NoteSearchRow[] =>
	results.map((result) => ({
		...result,
		key: createNotePageKey(result),
	}));

export const firstNotePageIdentity = (catalog: NoteCatalogOutput | null): NotePageIdentity | null => {
	const firstPage = catalog?.notebooks[0]?.sections[0]?.pages[0] ?? null;
	return firstPage
		? {
				notebook: firstPage.notebook,
				section: firstPage.section,
				page: firstPage.page,
			}
		: null;
};

export const hasNoteCapability = (catalog: NoteCatalogOutput | null): boolean =>
	catalog?.capability.available === true;
