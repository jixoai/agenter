import type { SessionEntry } from "@agenter/client-sdk";
import { describe, expect, test } from 'vitest';

import { buildActorDirectory, buildActorDirectoryMap, fallbackActorLabel } from './actor-directory';

const createSessionEntry = (input: {
	id: string;
	name: string;
	avatar?: string;
	avatarPrincipalId?: string;
	status?: SessionEntry["status"];
	storageState?: SessionEntry["storageState"];
	workspacePath?: string;
}): SessionEntry => ({
	id: input.id,
	name: input.name,
	cwd: input.workspacePath ?? `/repo/${input.id}`,
	workspacePath: input.workspacePath ?? `/repo/${input.id}`,
	avatar: input.avatar ?? "",
	createdAt: "2026-04-07T00:00:00.000Z",
	updatedAt: "2026-04-07T00:00:00.000Z",
	status: input.status ?? "running",
	storageState: input.storageState ?? "active",
	sessionRoot: `/tmp/sessions/${input.id}`,
	storeTarget: "global",
	avatarPrincipalId: input.avatarPrincipalId,
});

describe('Feature: collaboration actor directory', () => {
	test('Scenario: Given bootstrap system actors When building the actor directory Then shared UI surfaces resolve the canonical bootstrap label', () => {
		const directory = buildActorDirectory({
			sessions: [],
			authActors: [],
			profileIconUrl: () => null,
			sessionIconUrl: () => null,
		});
		const directoryMap = buildActorDirectoryMap(directory);

		expect(directoryMap.get('system:trusted-terminal-bootstrap')?.label).toBe('Bootstrap admin');
		expect(directoryMap.get('system:trusted-bootstrap')?.label).toBe('Bootstrap admin');
		expect(fallbackActorLabel('system:trusted-terminal-bootstrap')).toBe('Bootstrap admin');
	});

	test("Scenario: Given an active stopped avatar session with an opaque runtime name When building the actor directory Then shared UI surfaces still resolve the avatar label", () => {
		const directory = buildActorDirectory({
			sessions: [
				createSessionEntry({
					id: "775921bd-e52b-52d2-9ff3-7b46e742ec45",
					name: "775921bd-e52b-52d2-9ff3-7b46e742ec45",
					avatar: "jane",
					avatarPrincipalId: "0x775921bde52b52d29ff37b46e742ec4500000000",
					workspacePath: "/repo/jane",
					status: "stopped",
				}),
			],
			authActors: [],
			profileIconUrl: () => null,
			sessionIconUrl: () => null,
		});
		const directoryMap = buildActorDirectoryMap(directory);

		expect(directoryMap.get("0x775921bde52b52d29ff37b46e742ec4500000000")?.label).toBe("jane");
		expect(directoryMap.get("0x775921bde52b52d29ff37b46e742ec4500000000")?.subtitle).toBe("Avatar session");
		expect(directoryMap.get("0x775921bde52b52d29ff37b46e742ec4500000000")?.sessionId).toBe(
			"775921bd-e52b-52d2-9ff3-7b46e742ec45",
		);
	});

	test("Scenario: Given an avatar session is missing avatarPrincipalId When the global avatar catalog knows that avatar Then actor selectors use the Avatar principal icon", () => {
		const directory = buildActorDirectory({
			sessions: [
				createSessionEntry({
					id: "session-backend",
					name: "session-backend",
					avatar: "backend",
				}),
			],
			authActors: [],
			profileIconUrl: () => null,
			sessionIconUrl: (sessionId) => `https://profiles.test/media/sessions/${sessionId}/icon`,
			avatarIdentity: {
				resolveAvatarIconUrl: (principalId) => `https://profiles.test/media/avatars/${principalId}/icon`,
				resolveAvatarCatalogEntry: (avatarNickname) =>
					avatarNickname === "backend"
						? {
								avatarPrincipalId: "0x775921bde52b52d29ff37b46e742ec4500000000",
								iconUrl: "https://profiles.test/media/avatars/0x775921bde52b52d29ff37b46e742ec4500000000/icon",
							}
						: null,
			},
		});
		const directoryMap = buildActorDirectoryMap(directory);

		expect(directoryMap.get("session:session-backend")).toBeUndefined();
		expect(directoryMap.get("0x775921bde52b52d29ff37b46e742ec4500000000")).toMatchObject({
			label: "backend",
			iconUrl: "https://profiles.test/media/avatars/0x775921bde52b52d29ff37b46e742ec4500000000/icon",
			sessionId: "session-backend",
		});
	});

	test("Scenario: Given session avatarPrincipalId diverges from the canonical avatar catalog When building actor selectors Then catalog-backed Avatar identity wins", () => {
		const directory = buildActorDirectory({
			sessions: [
				createSessionEntry({
					id: "session-backend",
					name: "session-backend",
					avatar: "backend",
					avatarPrincipalId: "0x1111111111111111111111111111111111111111",
				}),
			],
			authActors: [],
			profileIconUrl: () => null,
			sessionIconUrl: (sessionId) => `https://profiles.test/media/sessions/${sessionId}/icon`,
			avatarIdentity: {
				resolveAvatarIconUrl: (principalId) => `https://profiles.test/media/avatars/${principalId}/icon`,
				resolveAvatarCatalogEntry: (avatarNickname) =>
					avatarNickname === "backend"
						? {
								avatarPrincipalId: "0x2222222222222222222222222222222222222222",
								iconUrl: "https://profiles.test/media/avatars/0x2222222222222222222222222222222222222222/icon",
							}
						: null,
			},
		});
		const directoryMap = buildActorDirectoryMap(directory);

		expect(directoryMap.get("0x1111111111111111111111111111111111111111")).toBeUndefined();
		expect(directoryMap.get("0x2222222222222222222222222222222222222222")).toMatchObject({
			label: "backend",
			iconUrl: "https://profiles.test/media/avatars/0x2222222222222222222222222222222222222222/icon",
			sessionId: "session-backend",
		});
	});

	test("Scenario: Given an active running session without an avatar label When building the actor directory Then the runtime name remains the primary label", () => {
		const directory = buildActorDirectory({
			sessions: [
				createSessionEntry({
					id: "session-helper",
					name: "helper-runtime",
					avatar: "",
				}),
			],
			authActors: [],
			profileIconUrl: () => null,
			sessionIconUrl: () => null,
		});
		const directoryMap = buildActorDirectoryMap(directory);

		expect(directoryMap.get("session:session-helper")?.label).toBe("helper-runtime");
		expect(directoryMap.get("session:session-helper")?.subtitle).toBe("Runtime session");
	});
});
