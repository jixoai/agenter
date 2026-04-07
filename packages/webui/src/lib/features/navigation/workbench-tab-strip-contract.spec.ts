import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const source = readFileSync(resolve(import.meta.dirname, 'workbench-tab-strip.svelte'), 'utf8');

describe('Feature: Workbench tab strip containment law', () => {
	test('Scenario: Given compact workbench chrome When reading the shared tab strip source Then outer chrome containment stays local to the strip instead of widening the document', () => {
		expect(source).toContain("class={cn('grid w-full min-w-0 gap-0 overflow-hidden', className)}");
		expect(source).toContain("'w-full min-w-0 overflow-hidden border border-border/65");
		expect(source).toContain('inline-size: 100%;');
		expect(source).toContain('overflow: hidden;');
	});
});
