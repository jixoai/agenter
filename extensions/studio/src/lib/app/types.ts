import type {
	AuthActorCatalogEntry,
	AuthServiceInfoOutput,
	AuthSessionOutput,
	RuntimeClientState,
	RuntimeStore,
} from '@agenter/client-sdk';

export type AppAuthBootstrapState =
	| 'connecting'
	| 'checking-session'
	| 'auto-login'
	| 'authenticated'
	| 'needs-login'
	| 'error';

export interface AppController {
	readonly runtimeStore: RuntimeStore;
	runtimeState: RuntimeClientState;
	authService: AuthServiceInfoOutput | null;
	authSession: AuthSessionOutput | null;
	authBootstrapState: AppAuthBootstrapState;
	authActors: AuthActorCatalogEntry[];
	profiles: Array<{
		reference: string;
		label: string;
		profileId: string | null;
		iconUrl: string;
		metadata: {
			displayName?: string;
			nickname?: string;
		};
	}>;
	initializing: boolean;
	refreshing: boolean;
	authBusy: boolean;
	statusText: string;
	start: () => Promise<void>;
	stop: () => void;
	refreshBootstrap: () => Promise<void>;
	authenticateWithPrivateKey: (privateKey: string) => Promise<void>;
	storeAutoLoginKey: (privateKey?: string | null) => Promise<void>;
	signOut: () => Promise<void>;
}
