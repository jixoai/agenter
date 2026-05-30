import { describe, expect, test } from 'vitest';

import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';

import {
	buildTerminalCallAsOptions,
	buildTerminalSeatStates,
	resolveSelectedCallerToken,
} from './terminal-route.projection';

const actorDirectoryMap = new Map<string, ActorDirectoryEntry>([
	[
		'session:reviewer',
		{
			actorId: 'session:reviewer',
			actorKind: 'session',
			label: 'Reviewer Session',
			subtitle: '/repo/reviewer',
			iconUrl: null,
		},
	],
	[
		'auth:observer',
		{
			actorId: 'auth:observer',
			actorKind: 'auth',
			label: 'Observer',
			subtitle: 'auth:observer',
			iconUrl: null,
		},
	],
]);

const terminalFixture = {
	terminalId: 'term-1',
	access: {
		role: 'admin',
		accessToken: 'token:bootstrap',
		participantId: 'system:trusted-terminal-bootstrap',
		currentAdmin: true,
	},
	actors: [
		{
			actorId: 'session:reviewer',
			role: 'writer',
			label: 'Reviewer Session',
			currentAdmin: false,
			adminCandidateRank: 1,
			online: true,
			focused: false,
			invalidCredential: false,
		},
	],
} satisfies NonNullable<Parameters<typeof buildTerminalCallAsOptions>[0]['terminal']>;

const grantFixtures = [
	{
		grantId: 'grant-reviewer',
		participantId: 'session:reviewer',
		role: 'writer',
		label: 'Reviewer Session',
		accessToken: 'token:reviewer',
	},
	{
		grantId: 'grant-observer',
		participantId: 'auth:observer',
		role: 'readonly',
		label: undefined,
		accessToken: 'token:observer',
	},
	{
		grantId: 'grant-without-token',
		participantId: 'auth:observer',
		role: 'readonly',
		label: 'Observer',
		accessToken: '',
	},
] satisfies Parameters<typeof buildTerminalCallAsOptions>[0]['grants'];

describe('Feature: terminal route projection helpers', () => {
	test('Scenario: Given terminal access and grants When call-as options are built Then bootstrap and granted seats come from one authoritative projection', () => {
		const options = buildTerminalCallAsOptions({
			terminal: terminalFixture,
			grants: grantFixtures,
			actorDirectoryMap,
		});

		expect(options).toEqual([
			{
				accessToken: 'token:bootstrap',
				participantId: 'system:trusted-terminal-bootstrap',
				role: 'admin',
				label: 'Bootstrap admin',
				subtitle: 'system:trusted-terminal-bootstrap',
				iconUrl: null,
			},
			{
				accessToken: 'token:reviewer',
				participantId: 'session:reviewer',
				role: 'writer',
				label: 'Reviewer Session',
				subtitle: 'session:reviewer',
				iconUrl: null,
			},
			{
				accessToken: 'token:observer',
				participantId: 'auth:observer',
				role: 'readonly',
				label: 'Observer',
				subtitle: 'auth:observer',
				iconUrl: null,
			},
		]);
	});

	test('Scenario: Given a stale selected caller token When the route resolves the caller Then it falls back to the first live projection token', () => {
		const callAsOptions = buildTerminalCallAsOptions({
			terminal: terminalFixture,
			grants: grantFixtures,
			actorDirectoryMap,
		});

		const selectedCallerToken = resolveSelectedCallerToken({
			terminal: terminalFixture,
			selectedCallerTokenByTerminalId: {
				'term-1': 'token:stale-seat',
			},
			callAsOptions,
		});

		expect(selectedCallerToken).toBe('token:bootstrap');
	});

	test("Scenario: Given the operator already picked a live granted actor When projection refreshes Then the route preserves that selected caller token", () => {
		const callAsOptions = buildTerminalCallAsOptions({
			terminal: terminalFixture,
			grants: grantFixtures,
			actorDirectoryMap,
		});

		const selectedCallerToken = resolveSelectedCallerToken({
			terminal: terminalFixture,
			selectedCallerTokenByTerminalId: {
				'term-1': 'token:reviewer',
			},
			callAsOptions,
		});

		expect(selectedCallerToken).toBe('token:reviewer');
	});

	test('Scenario: Given terminal actors omit the bootstrap system seat When seat states are built Then the route does not fabricate a bootstrap row and only decorates authoritative actors', () => {
		const seatStates = buildTerminalSeatStates({
			terminal: terminalFixture,
			grants: grantFixtures,
			actorDirectoryMap,
		});

		expect(seatStates).toEqual([
			{
				actorId: 'session:reviewer',
				actorKind: 'session',
				label: 'Reviewer Session',
				subtitle: '/repo/reviewer',
				iconUrl: null,
				role: 'writer',
				currentAdmin: false,
				online: true,
				focused: false,
				invalidCredential: false,
				accessToken: 'token:reviewer',
				grantId: 'grant-reviewer',
				adminCandidateRank: 1,
				leaseExpiresAt: undefined,
			},
		]);
	});

	test('Scenario: Given a projected actor is missing from the actor directory When projection helpers build labels Then they fall back to deterministic actor-derived identity', () => {
		const fallbackTerminal = {
			terminalId: 'term-2',
			access: undefined,
			actors: [
				{
					actorId: 'auth:guest',
					role: 'readonly',
					label: undefined,
					currentAdmin: false,
					adminCandidateRank: 3,
					online: false,
					focused: false,
					invalidCredential: true,
				},
			],
		} satisfies NonNullable<Parameters<typeof buildTerminalSeatStates>[0]['terminal']>;
		const fallbackGrants = [
			{
				grantId: 'grant-guest',
				participantId: 'auth:guest',
				role: 'readonly',
				label: undefined,
				accessToken: 'token:guest',
			},
		] satisfies Parameters<typeof buildTerminalSeatStates>[0]['grants'];

		expect(
			buildTerminalCallAsOptions({
				terminal: fallbackTerminal,
				grants: fallbackGrants,
				actorDirectoryMap,
			}),
		).toEqual([
			{
				accessToken: 'token:guest',
				participantId: 'auth:guest',
				role: 'readonly',
				label: 'guest',
				subtitle: 'auth:guest',
				iconUrl: null,
			},
		]);
		expect(
			buildTerminalSeatStates({
				terminal: fallbackTerminal,
				grants: fallbackGrants,
				actorDirectoryMap,
			}),
		).toEqual([
			{
				actorId: 'auth:guest',
				actorKind: 'auth',
				label: 'guest',
				subtitle: 'auth:guest',
				iconUrl: null,
				role: 'readonly',
				currentAdmin: false,
				online: false,
				focused: false,
				invalidCredential: true,
				accessToken: 'token:guest',
				grantId: 'grant-guest',
				adminCandidateRank: 3,
				leaseExpiresAt: undefined,
			},
		]);
	});
});
