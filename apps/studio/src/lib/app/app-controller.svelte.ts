import { createAgenterClient, createRuntimeStore, type RuntimeStore } from '@agenter/client-sdk';

import { resolveWalletAuthIdentity, signWalletAuthChallenge } from './private-key-auth';
import {
	consumeSkipAutoLoginOnce,
	markSkipAutoLoginOnce,
	readStoredAuthToken,
	writeStoredAuthToken,
} from './auth-session-storage';
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
		heartbeatRecordsBySession: { ...state.heartbeatRecordsBySession },
		heartbeatRecordDetailsBySession: { ...state.heartbeatRecordDetailsBySession },
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
	let runtimeConnected = false;
	let unsubscribeRuntime: (() => void) | null = null;

	const controller = $state<AppController>({
		runtimeStore,
		runtimeState: runtimeClone(runtimeStore),
		authService: null,
		authSession: null,
		authBootstrapState: 'connecting',
		authActors: [],
		profiles: [],
		initializing: true,
		refreshing: false,
		authBusy: false,
		statusText: 'Connecting to agenter auth…',
		start: async () => {},
		stop: () => {},
		refreshBootstrap: async () => {},
		authenticateWithPrivateKey: async () => {},
		storeAutoLoginKey: async () => {},
		signOut: async () => {},
	});

	const syncRuntimeState = (): void => {
		controller.runtimeState = runtimeClone(runtimeStore);
	};

	const resetUnauthenticatedState = (statusText: string): void => {
		controller.authSession = null;
		controller.authActors = [];
		controller.profiles = [];
		controller.authBootstrapState = 'needs-login';
		controller.statusText = statusText;
		controller.initializing = false;
		syncRuntimeState();
	};

	const ensureRuntimeSubscription = (): void => {
		if (unsubscribeRuntime) {
			return;
		}
		unsubscribeRuntime = runtimeStore.subscribe(() => {
			syncRuntimeState();
		});
	};

	const ensureRuntimeConnection = async (): Promise<void> => {
		if (runtimeConnected) {
			return;
		}
		ensureRuntimeSubscription();
		runtimeConnected = true;
		await runtimeStore.connect();
		syncRuntimeState();
	};

	const hydrateAuthenticatedState = async (): Promise<void> => {
		await ensureRuntimeConnection();
		controller.authActors = await runtimeStore.listAuthActors();
		controller.profiles = (await runtimeStore.listProfiles()).items.map(toProfileReference);
		await runtimeStore.listAllWorkspaces();
		await runtimeStore.listRecentWorkspaces(32);
		syncRuntimeState();
	};

	const applyAuthenticatedSession = async (session: NonNullable<AppController['authSession']>): Promise<void> => {
		controller.authSession = session;
		controller.authBootstrapState = 'authenticated';
		await hydrateAuthenticatedState();
		controller.initializing = false;
		controller.statusText = `Connected as ${session.profile.metadata.displayName ?? session.profile.metadata.nickname ?? session.claims.authId}`;
	};

	const refreshBootstrap = async (): Promise<void> => {
		controller.refreshing = true;
		try {
			controller.authService = await runtimeStore.getAuthServiceDescriptor({ force: true });
			controller.authBootstrapState = 'checking-session';
			controller.statusText = 'Checking browser auth session…';
			const storedSession = await runtimeStore.getAuthSession();
			if (storedSession) {
				await applyAuthenticatedSession(storedSession);
				return;
			}

			runtimeStore.clearAuthToken();
			writeStoredAuthToken(null);
			controller.authSession = null;

			if (!consumeSkipAutoLoginOnce()) {
				controller.authBootstrapState = 'auto-login';
				controller.statusText = 'Attempting daemon auto login…';
				const autoLogin = await runtimeStore.autoLogin();
				if (autoLogin.ok) {
					runtimeStore.setAuthToken(autoLogin.session.token);
					writeStoredAuthToken(autoLogin.session.token);
					await applyAuthenticatedSession(autoLogin.session);
					return;
				}
				resetUnauthenticatedState(autoLogin.message || 'Sign in to continue.');
				return;
			}

			resetUnauthenticatedState('Sign in to continue.');
		} catch (error) {
			controller.authBootstrapState = 'error';
			controller.initializing = false;
			controller.statusText = error instanceof Error ? error.message : String(error);
		} finally {
			controller.refreshing = false;
		}
	};

	const start = async (): Promise<void> => {
		if (started) {
			return;
		}
		started = true;
		await refreshBootstrap();
	};

	const stop = (): void => {
		started = false;
		runtimeConnected = false;
		unsubscribeRuntime?.();
		unsubscribeRuntime = null;
		runtimeStore.disconnect();
	};

	const authenticateWithPrivateKey = async (privateKey: string): Promise<void> => {
		controller.authBusy = true;
		controller.statusText = 'Signing wallet challenge…';
		try {
			controller.authService = await runtimeStore.getAuthServiceDescriptor({ force: true });
			const identity = resolveWalletAuthIdentity(privateKey);
			const descriptor = await runtimeStore.startAuthChallenge(identity.authId);
			const signedChallenge = await signWalletAuthChallenge(privateKey, descriptor.challengeText);
			const verified = await runtimeStore.verifyAuthChallenge({
				challengeId: descriptor.challengeId,
				signature: signedChallenge.signature,
			});
			runtimeStore.setAuthToken(verified.token);
			writeStoredAuthToken(verified.token);
			await applyAuthenticatedSession(verified);
		} catch (error) {
			resetUnauthenticatedState(error instanceof Error ? error.message : String(error));
		} finally {
			controller.authBusy = false;
		}
	};

	const storeAutoLoginKey = async (privateKey?: string | null): Promise<void> => {
		controller.authBusy = true;
		controller.statusText = 'Configuring daemon auto login…';
		try {
			await runtimeStore.storeAutoLoginKey({
				privateKey: privateKey?.trim() ? privateKey.trim() : undefined,
			});
			controller.authService = await runtimeStore.getAuthServiceDescriptor({ force: true });
			if (!controller.authSession) {
				await refreshBootstrap();
				return;
			}
			controller.statusText = 'Daemon auto login is configured for this machine.';
		} catch (error) {
			controller.statusText = error instanceof Error ? error.message : String(error);
		} finally {
			controller.authBusy = false;
		}
	};

	const signOut = async (): Promise<void> => {
		runtimeStore.clearAuthToken();
		writeStoredAuthToken(null);
		markSkipAutoLoginOnce();
		if (typeof window !== 'undefined') {
			window.location.reload();
			return;
		}
		await refreshBootstrap();
	};

	controller.start = start;
	controller.stop = stop;
	controller.refreshBootstrap = refreshBootstrap;
	controller.authenticateWithPrivateKey = authenticateWithPrivateKey;
	controller.storeAutoLoginKey = storeAutoLoginKey;
	controller.signOut = signOut;

	return controller;
};
