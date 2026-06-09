import { describe, expect, test } from 'vitest';

import {
	resolveAvatarDisplayName,
	resolveAvatarHandle,
	resolveAvatarHandleValue,
} from './avatar-identity-presentation';

describe('Feature: avatar identity presentation', () => {
	test('Scenario: Given one avatar has both displayName and principalId When rendering identity Then the display uses human name and the handle uses principal truth', () => {
		expect(
			resolveAvatarDisplayName({
				displayName: 'Default',
				nickname: 'default',
				avatarPrincipalId: '0xabc123',
			}),
		).toBe('Default');
		expect(
			resolveAvatarHandleValue({
				displayName: 'Default',
				nickname: 'default',
				avatarPrincipalId: '0xabc123',
			}),
		).toBe('0xabc123');
		expect(
			resolveAvatarHandle({
				displayName: 'Default',
				nickname: 'default',
				avatarPrincipalId: '0xabc123',
			}),
		).toBe('@0xabc123');
	});

	test('Scenario: Given one avatar has no principalId When rendering identity Then the handle falls back to nickname', () => {
		expect(
			resolveAvatarHandle({
				displayName: 'Reviewer',
				nickname: 'reviewer',
			}),
		).toBe('@reviewer');
	});
});
