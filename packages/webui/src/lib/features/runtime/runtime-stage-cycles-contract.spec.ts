import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const cyclesStageSource = readFileSync(resolve(import.meta.dirname, 'runtime-stage-cycles.svelte'), 'utf8');

describe('Feature: Runtime cycles stage disclosure contract', () => {
	test('Scenario: Given the primary stage already owns the outer scaffold When reading the cycles stage source Then cycle history is rendered as compact items without a nested card shell', () => {
		expect(cyclesStageSource).not.toContain('<Card.Root>');
		expect(cyclesStageSource).not.toContain("import * as Card");
		expect(cyclesStageSource).toContain("import * as Item");
		expect(cyclesStageSource).toContain('<Item.Root');
	});

	test('Scenario: Given operators need to inspect a cycle inline When reading the cycles stage source Then each cycle item exposes disclosure semantics and durable detail fields', () => {
		expect(cyclesStageSource).toContain('aria-expanded={expanded}');
		expect(cyclesStageSource).toContain("toggleCycle(cycle.id)");
		expect(cyclesStageSource).toContain('Client messages');
		expect(cyclesStageSource).toContain('Model call');
		expect(cyclesStageSource).toContain('Live messages');
	});
});
