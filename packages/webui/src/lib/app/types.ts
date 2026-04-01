import type {
	AuthActorCatalogEntry,
	AuthServiceInfoOutput,
	AuthSessionOutput,
	RuntimeClientState,
	RuntimeStore,
} from '@agenter/client-sdk';

export interface AppController {
	readonly runtimeStore: RuntimeStore;
	runtimeState: RuntimeClientState;
	authService: AuthServiceInfoOutput | null;
	authSession: AuthSessionOutput | null;
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
	revealManagedRootKey: () => Promise<string>;
	signOut: () => Promise<void>;
}
