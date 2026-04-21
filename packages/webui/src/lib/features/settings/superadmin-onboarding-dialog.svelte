<script lang="ts">
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';

	import { DialogScaffold } from '@agenter/svelte-components';
	import PasswordInput from '$lib/components/ui/password-input.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import type { AuthServiceInfoOutput } from '@agenter/client-sdk';

	let {
		open = $bindable(false),
		authService,
		authStatus,
		privateKeyDraft = $bindable(''),
		canStoreAutoLoginKey,
		autoLoginActionLabel = 'Enable daemon auto login',
		authBusy = false,
		allowDismiss = true,
		onStoreAutoLoginKey,
		onAuthenticate,
		onDismiss,
	}: {
		open?: boolean;
		authService: AuthServiceInfoOutput | null;
		authStatus: string;
		privateKeyDraft?: string;
		canStoreAutoLoginKey: boolean;
		autoLoginActionLabel?: string;
		authBusy?: boolean;
		allowDismiss?: boolean;
		onStoreAutoLoginKey: () => Promise<void> | void;
		onAuthenticate: () => Promise<void> | void;
		onDismiss: () => void;
	} = $props();

	const fallbackKeyPath = '~/.agenter/local.env';
</script>

<Dialog.Root
	open={open}
	onOpenChange={(nextOpen) => {
		if (!nextOpen && open) {
			onDismiss();
		}
	}}
>
	<Dialog.Content class="h-[calc(100dvh-2rem)] max-h-[48rem] gap-0 p-0 sm:max-w-2xl">
		<DialogScaffold.Root>
			<DialogScaffold.Header class="grid-cols-1 p-6">
			<Dialog.Title>Sign in to Agenter</Dialog.Title>
			<Dialog.Description>
				Finish superadmin auth bootstrap before entering the protected workbench shell. The browser stores a short-lived
				auth token, while daemon auto login is configured machine-locally.
			</Dialog.Description>
			</DialogScaffold.Header>

			<DialogScaffold.ScrollBody contentClass="space-y-4 p-6">
			<div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
				<div class="rounded-full border bg-muted px-3 py-1">{authService?.authMode ?? 'wallet_challenge_jwt'}</div>
				<div class="rounded-full border bg-muted px-3 py-1">{authService?.rootAuthId ?? 'root auth unavailable'}</div>
				<div class="rounded-full border bg-muted px-3 py-1">
					{authService?.rootAuthBootstrapMode ?? 'managed_local'}
				</div>
				<div class="rounded-full border bg-muted px-3 py-1">
					auto login: {authService?.browserAutoLoginKeyPath ?? fallbackKeyPath}
				</div>
			</div>

			<div class="rounded-2xl border bg-muted/50 p-4 text-sm text-muted-foreground">
				<div class="mb-2 flex items-center gap-2 font-medium text-foreground">
					<ShieldCheckIcon class="size-4" />
					<span>How this works</span>
				</div>
				<p>
					Use your root private key to sign one challenge and mint a browser auth session. If this machine supports
					daemon auto login, you can also store the root key for future automatic sign-in without revealing it back to
					the browser.
				</p>
			</div>

			{#if canStoreAutoLoginKey}
				<div class="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<p class="max-w-prose">
							Store the daemon auto-login key for this machine. Managed-local setups can bootstrap it without exposing
							the raw key to the browser, and manual setups can persist the key you paste below.
						</p>
						<Button variant="secondary" onclick={() => void onStoreAutoLoginKey()} disabled={authBusy}>
							<KeyRoundIcon class="size-4" />
							{authBusy ? 'Configuring…' : autoLoginActionLabel}
						</Button>
					</div>
				</div>
			{/if}

			<label class="grid gap-2 text-sm font-medium text-foreground">
				<span>Root private key</span>
				<PasswordInput bind:value={privateKeyDraft} placeholder="0x-prefixed private key" />
			</label>

			<p class="text-xs text-muted-foreground">
				The private key is only used locally to sign one challenge. The browser stores the short-lived auth token, not the
				private key.
			</p>

			<div class="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{authStatus}</div>
			</DialogScaffold.ScrollBody>

			<DialogScaffold.Footer class="p-6">
			{#if allowDismiss}
				<Button variant="ghost" onclick={onDismiss}>Later</Button>
			{/if}
			<Button onclick={() => void onAuthenticate()} disabled={!privateKeyDraft.trim() || authBusy}>
				<KeyRoundIcon class="size-4" />
				{authBusy ? 'Signing…' : 'Sign challenge'}
			</Button>
			</DialogScaffold.Footer>
		</DialogScaffold.Root>
	</Dialog.Content>
</Dialog.Root>
