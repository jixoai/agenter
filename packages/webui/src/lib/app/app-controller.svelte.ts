import { createAgenterClient, createRuntimeStore, type RuntimeStore } from '@agenter/client-sdk';

import { resolveWalletAuthIdentity, signWalletAuthChallenge } from './private-key-auth';
import { readStoredAuthToken, writeStoredAuthToken } from './auth-session-storage';
import { resolveAgenterWsUrl } from './ws-url';
import type { AppController } from './types';

const runtimeClone = (store: RuntimeStore) => store.getState();
const toProfileReference = (profile: {
	profileId: string | null;
	identifiers: Array<{ kind: string; value: string }>;
	metadata: { displayName?: string; nickname?: string };
	iconUrl: string;
}) => {
	const identifier = profile.identifiers[0];
	const reference = profile.profileId ?? (identifier ? `${identifier.kind}:${identifier.value}` : 'unknown-profile');
	const label =
		profile.metadata.displayName ??
		profile.metadata.nickname ??
		identifier?.value ??
		reference;
	return {
		reference,
		label,
		profileId: profile.profileId,
		iconUrl: profile.iconUrl,
		metadata: profile.metadata,
	};
};

export const createAppController = (): AppController => {
	const client = createAgenterClient({
		wsUrl: resolveAgenterWsUrl(),
		initialAuthToken: readStoredAuthToken(),
	});
	const runtimeStore = createRuntimeStore(client);

	let runtimeState = $state(runtimeClone(runtimeStore));
	let authService = $state<Awaited<ReturnType<RuntimeStore['getAuthServiceDescriptor']>> | null>(null);
	let authSession = $state<Awaited<ReturnType<RuntimeStore['getAuthSession']>> | null>(null);
	let authActors = $state<Awaited<ReturnType<RuntimeStore['listAuthActors']>>>([]);
	let profiles = $state<AppController['profiles']>([]);
	let initializing = $state(true);
	let refreshing = $state(false);
	let authBusy = $state(false);
	let statusText = $state('Connecting to agenter runtime…');
	let started = false;
	let unsubscribeRuntime: (() => void) | null = null;

	const syncRuntimeState = (): void => {
		runtimeState = runtimeClone(runtimeStore);
	};

	const refreshAuthState = async (): Promise<void> => {
		authService = await runtimeStore.getAuthServiceDescriptor();
		const session = await runtimeStore.getAuthSession();
		authSession = session;
		if (!session) {
			runtimeStore.clearAuthToken();
			writeStoredAuthToken(null);
		}
	};

	const refreshBootstrap = async (): Promise<void> => {
		refreshing = true;
		statusText = 'Refreshing runtime, auth, profiles, and workspace catalog…';
		try {
			await refreshAuthState();
			authActors = await runtimeStore.listAuthActors();
			profiles = (await runtimeStore.listProfiles()).items.map(toProfileReference);
			await runtimeStore.listAllWorkspaces();
			await runtimeStore.listRecentWorkspaces(32);
			syncRuntimeState();
			statusText = authSession
				? `Connected as ${authSession.profile.metadata.displayName ?? authSession.profile.metadata.nickname ?? authSession.claims.authId}`
				: 'Connected. Superadmin key is not bound in this browser yet.';
		} finally {
			refreshing = false;
			initializing = false;
		}
	};

	const start = async (): Promise<void> => {
		if (started) {
			return;
		}
		started = true;
		unsubscribeRuntime = runtimeStore.subscribe(() => {
			syncRuntimeState();
		});
		await runtimeStore.connect();
		syncRuntimeState();
		await refreshBootstrap();
	};

	const stop = (): void => {
		started = false;
		unsubscribeRuntime?.();
		unsubscribeRuntime = null;
		runtimeStore.disconnect();
	};

	const authenticateWithPrivateKey = async (privateKey: string): Promise<void> => {
		authBusy = true;
		statusText = 'Signing wallet challenge…';
		try {
			authService = await runtimeStore.getAuthServiceDescriptor();
			const identity = resolveWalletAuthIdentity(privateKey);
			const descriptor = await runtimeStore.startAuthChallenge(identity.authId);
			const signedChallenge = await signWalletAuthChallenge(privateKey, descriptor.challengeText);
			const verified = await runtimeStore.verifyAuthChallenge({
				challengeId: descriptor.challengeId,
				signature: signedChallenge.signature,
			});
			runtimeStore.setAuthToken(verified.token);
			writeStoredAuthToken(verified.token);
			await refreshBootstrap();
		} finally {
			authBusy = false;
		}
	};

	const revealManagedRootKey = async (): Promise<string> => {
		authBusy = true;
		statusText = 'Requesting backend-managed root private key…';
		try {
			const revealed = await runtimeStore.revealManagedRootAuthPrivateKey();
			statusText = `Loaded backend-managed root key for ${revealed.authId}`;
			return revealed.privateKey;
		} finally {
			authBusy = false;
		}
	};

	const signOut = async (): Promise<void> => {
		runtimeStore.clearAuthToken();
		writeStoredAuthToken(null);
		await refreshBootstrap();
	};

	return {
		get runtimeStore() {
			return runtimeStore;
		},
		get runtimeState() {
			return runtimeState;
		},
		set runtimeState(value) {
			runtimeState = value;
		},
		get authService() {
			return authService;
		},
		set authService(value) {
			authService = value;
		},
		get authSession() {
			return authSession;
		},
		set authSession(value) {
			authSession = value;
		},
		get authActors() {
			return authActors;
		},
		set authActors(value) {
			authActors = value;
		},
		get profiles() {
			return profiles;
		},
		set profiles(value) {
			profiles = value;
		},
		get initializing() {
			return initializing;
		},
		set initializing(value) {
			initializing = value;
		},
		get refreshing() {
			return refreshing;
		},
		set refreshing(value) {
			refreshing = value;
		},
		get authBusy() {
			return authBusy;
		},
		set authBusy(value) {
			authBusy = value;
		},
		get statusText() {
			return statusText;
		},
		set statusText(value) {
			statusText = value;
		},
		start,
		stop,
		refreshBootstrap,
		authenticateWithPrivateKey,
		revealManagedRootKey,
		signOut,
	};
};
