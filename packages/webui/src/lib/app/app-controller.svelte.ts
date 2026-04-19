import { createAgenterClient, createRuntimeStore, type RuntimeStore } from '@agenter/client-sdk';

import { resolveWalletAuthIdentity, signWalletAuthChallenge } from './private-key-auth';
import { readStoredAuthToken, writeStoredAuthToken } from './auth-session-storage';
import { resolveAgenterWsUrl } from './ws-url';
import type { AppController } from './types';

const runtimeClone = (store: RuntimeStore) => {
	const state = store.getState();
	return {
		...state,
		runtimes: { ...state.runtimes },
		activityBySession: { ...state.activityBySession },
		terminalSnapshotsBySession: { ...state.terminalSnapshotsBySession },
		terminalReadsBySession: { ...state.terminalReadsBySession },
		chatsBySession: { ...state.chatsBySession },
		messageChannelsBySession: { ...state.messageChannelsBySession },
		chatCyclesBySession: { ...state.chatCyclesBySession },
		attentionBySession: { ...state.attentionBySession },
		tasksBySession: { ...state.tasksBySession },
		globalAvatarCatalog: state.globalAvatarCatalog,
		workspaceAvatarCatalogByPath: { ...state.workspaceAvatarCatalogByPath },
		globalRoomSnapshotsById: { ...state.globalRoomSnapshotsById },
		globalRoomGrantsById: { ...state.globalRoomGrantsById },
		globalTerminalGrantsById: { ...state.globalTerminalGrantsById },
		globalTerminalApprovalsById: { ...state.globalTerminalApprovalsById },
		globalTerminalActivityById: { ...state.globalTerminalActivityById },
		schedulerLogsBySession: { ...state.schedulerLogsBySession },
		observabilityTracesBySession: { ...state.observabilityTracesBySession },
		apiCallsBySession: { ...state.apiCallsBySession },
		heartbeatGroupsBySession: { ...state.heartbeatGroupsBySession },
		modelCallsBySession: { ...state.modelCallsBySession },
		requestAuxBySession: { ...state.requestAuxBySession },
		modelCallDeltasBySession: state.modelCallDeltasBySession ? { ...state.modelCallDeltasBySession } : undefined,
		terminalActivityBySession: { ...state.terminalActivityBySession },
		apiCallRecordingBySession: { ...state.apiCallRecordingBySession },
		unreadBySession: { ...state.unreadBySession },
		unreadByBucket: { ...state.unreadByBucket },
	};
};
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
	let started = false;
	let unsubscribeRuntime: (() => void) | null = null;

	const controller = $state<AppController>({
		runtimeStore,
		runtimeState: runtimeClone(runtimeStore),
		authService: null,
		authSession: null,
		authActors: [],
		profiles: [],
		initializing: true,
		refreshing: false,
		authBusy: false,
		statusText: 'Connecting to agenter runtime…',
		start: async () => {},
		stop: () => {},
		refreshBootstrap: async () => {},
		authenticateWithPrivateKey: async () => {},
		revealManagedRootKey: async () => '',
		signOut: async () => {},
	});

	const syncRuntimeState = (): void => {
		controller.runtimeState = runtimeClone(runtimeStore);
	};

	const refreshAuthState = async (): Promise<void> => {
		controller.authService = await runtimeStore.getAuthServiceDescriptor();
		const session = await runtimeStore.getAuthSession();
		controller.authSession = session;
		if (!session) {
			runtimeStore.clearAuthToken();
			writeStoredAuthToken(null);
		}
	};

	const refreshBootstrap = async (): Promise<void> => {
		controller.refreshing = true;
		controller.statusText = 'Refreshing runtime, auth, profiles, and workspace catalog…';
		try {
			await refreshAuthState();
			controller.authActors = await runtimeStore.listAuthActors();
			controller.profiles = (await runtimeStore.listProfiles()).items.map(toProfileReference);
			await runtimeStore.listAllWorkspaces();
			await runtimeStore.listRecentWorkspaces(32);
			syncRuntimeState();
			controller.statusText = controller.authSession
				? `Connected as ${controller.authSession.profile.metadata.displayName ?? controller.authSession.profile.metadata.nickname ?? controller.authSession.claims.authId}`
				: 'Connected. Superadmin key is not bound in this browser yet.';
		} finally {
			controller.refreshing = false;
			controller.initializing = false;
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
		controller.authBusy = true;
		controller.statusText = 'Signing wallet challenge…';
		try {
			controller.authService = await runtimeStore.getAuthServiceDescriptor();
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
			controller.authBusy = false;
		}
	};

	const revealManagedRootKey = async (): Promise<string> => {
		controller.authBusy = true;
		controller.statusText = 'Requesting backend-managed root private key…';
		try {
			const revealed = await runtimeStore.revealManagedRootAuthPrivateKey();
			controller.statusText = `Loaded backend-managed root key for ${revealed.authId}`;
			return revealed.privateKey;
		} finally {
			controller.authBusy = false;
		}
	};

	const signOut = async (): Promise<void> => {
		runtimeStore.clearAuthToken();
		writeStoredAuthToken(null);
		await refreshBootstrap();
	};

	controller.start = start;
	controller.stop = stop;
	controller.refreshBootstrap = refreshBootstrap;
	controller.authenticateWithPrivateKey = authenticateWithPrivateKey;
	controller.revealManagedRootKey = revealManagedRootKey;
	controller.signOut = signOut;

	return controller;
};
