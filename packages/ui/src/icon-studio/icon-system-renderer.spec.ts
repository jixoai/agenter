import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import type {
	IconBackgroundToken,
	IconPaletteToken,
	IconPreset,
	IconSlotKind,
	IconSlotPreset,
} from './icon-system-contract';
import { CUSTOM_SLOT_ID } from './icon-system-contract';
import { createRenderInput, parseGeometryFromSvg, renderIconSvg } from './icon-system-svg';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');
const loadJson = <TValue>(filePath: string): TValue => JSON.parse(readFileSync(filePath, 'utf8')) as TValue;

const geometry = parseGeometryFromSvg(readFileSync(resolve(nextDir, 'icon-bw.svg'), 'utf8'));
const backgrounds = loadJson<IconBackgroundToken[]>(resolve(nextDir, 'tokens', 'backgrounds.json'));
const palettes = loadJson<IconPaletteToken[]>(resolve(nextDir, 'tokens', 'palettes.json'));
const slotCatalog = loadJson<Record<IconSlotKind, IconSlotPreset[]>>(resolve(nextDir, 'tokens', 'slots.json'));
const presets = readdirSync(resolve(nextDir, 'presets'))
	.filter((filename: string) => filename.endsWith('.json'))
	.sort()
	.map((filename: string) => loadJson<IconPreset>(resolve(nextDir, 'presets', filename)));

describe('Feature: Canonical icon system renderer', () => {
	test('Scenario: Given the light brand preset When rendering the SVG Then the light canvas and metallic center system stay encoded in the output', () => {
		const preset = presets.find((entry: IconPreset) => entry.id === 'brand-light');
		expect(preset).not.toBeNull();

		const svg = renderIconSvg(
			createRenderInput({
				backgrounds,
				config: {
					backgroundToken: preset!.backgroundToken,
					family: preset!.family,
					paletteToken: preset!.paletteToken,
					slots: preset!.slots,
					theme: preset!.theme,
				},
				geometry,
				palettes,
				slotCatalog,
			}),
		);

		expect(svg).toContain('#f3f0ea');
		expect(svg).toContain('stroke="#c0c8cf"');
		expect(svg).toContain('clip-topLeft');
	});

	test('Scenario: Given a custom center slot When rendering the SVG Then the exported icon embeds the provided custom markup inside the slot clip', () => {
		const preset = presets.find((entry: IconPreset) => entry.id === 'brand-light');
		expect(preset).not.toBeNull();

		const svg = renderIconSvg(
			createRenderInput({
				backgrounds,
				config: {
					backgroundToken: preset!.backgroundToken,
					customSlots: {
						center: '<svg viewBox="0 0 100 100"><path d="M20 20h60v60H20z" fill="currentColor"/></svg>',
					},
					family: preset!.family,
					paletteToken: preset!.paletteToken,
					slots: { ...preset!.slots, center: CUSTOM_SLOT_ID },
					theme: preset!.theme,
				},
				geometry,
				palettes,
				slotCatalog,
			}),
		);

		expect(svg).toContain('clip-path="url(#clip-center)"');
		expect(svg).toContain('M20 20h60v60H20z');
	});
});
