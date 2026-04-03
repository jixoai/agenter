<script lang="ts">
	import BadgeCheckIcon from '@lucide/svelte/icons/badge-check';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SaveIcon from '@lucide/svelte/icons/save';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { normalizePrivateKey } from '$lib/app/private-key-auth';
	import PanelShell from '$lib/components/panel-shell.svelte';
	import ScrollView from '$lib/components/scroll-view.svelte';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import PasswordInput from '$lib/components/ui/password-input.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	const controller = getAppControllerContext();

	let selectedProfileReference = $state('');
	let profileLoading = $state(false);
	let profileReference = $state('');
	let displayName = $state('');
	let nickname = $state('');
	let phone = $state('');
	let address = $state('');
	let extraJson = $state('{}');
	let privateKeyDraft = $state('');
	let saveBusy = $state(false);

	const currentProfile = $derived(
		controller.profiles.find((profile) => profile.reference === selectedProfileReference) ?? controller.profiles[0] ?? null,
	);

	const syncSelectedProfile = async (reference: string): Promise<void> => {
		profileLoading = true;
		try {
			const profile = await controller.runtimeStore.getProfile(reference);
			selectedProfileReference = reference;
			profileReference = reference;
			displayName = profile.metadata.displayName ?? '';
			nickname = profile.metadata.nickname ?? '';
			phone = profile.metadata.phone ?? '';
			address = profile.metadata.address ?? '';
			extraJson = JSON.stringify(profile.metadata.extra ?? {}, null, 2);
		} finally {
			profileLoading = false;
		}
	};

	const saveProfile = async (): Promise<void> => {
		if (!profileReference) {
			return;
		}
		saveBusy = true;
		try {
			await controller.runtimeStore.updateProfile({
				reference: profileReference,
				patch: {
					displayName: displayName.trim() || undefined,
					nickname: nickname.trim() || undefined,
					phone: phone.trim() || undefined,
					address: address.trim() || undefined,
					extra: JSON.parse(extraJson || '{}') as Record<string, unknown>,
				},
			});
			await controller.refreshBootstrap();
			await syncSelectedProfile(profileReference);
		} finally {
			saveBusy = false;
		}
	};

	$effect(() => {
		if (!controller.profiles.length) {
			return;
		}
		if (!selectedProfileReference || !controller.profiles.some((profile) => profile.reference === selectedProfileReference)) {
			void syncSelectedProfile(controller.profiles[0]!.reference);
		}
	});
</script>

<div class="grid h-full gap-4 p-4 md:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)] md:p-6">
	<div class="grid gap-4">
		<Card.Root>
			<Card.Header class="gap-2 border-b">
				<Card.Title>Superadmin session</Card.Title>
				<Card.Description>Root auth, browser token state, and backend-managed key entry all live here.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				<div class="flex items-center gap-3 rounded-2xl border bg-muted/30 p-4">
					<ProfileAvatar
						label={controller.authSession?.profile.metadata.displayName ?? controller.authSession?.claims.authId ?? 'Superadmin'}
						src={
							controller.authSession?.profile.profileId
								? controller.runtimeStore.profileIconUrl(controller.authSession.profile.profileId)
								: null
						}
						class="size-12"
					/>
					<div class="min-w-0">
						<div class="truncate text-sm font-semibold">
							{controller.authSession?.profile.metadata.displayName ?? controller.authSession?.claims.authId ?? 'Unauthenticated'}
						</div>
						<div class="truncate text-xs text-muted-foreground">
							{controller.authSession?.claims.superadmin ? 'Authenticated superadmin' : 'No browser auth token'}
						</div>
					</div>
				</div>

				<div class="grid gap-2 text-sm">
					<div class="rounded-xl border bg-card px-3 py-2">
						root auth id: {controller.authService?.rootAuthId ?? 'unavailable'}
					</div>
					<div class="rounded-xl border bg-card px-3 py-2">
						key path: {controller.authService?.rootAuthKeyPath ?? '~/.agenter/profile-service/root-auth.key'}
					</div>
				</div>

				<label class="grid gap-2 text-sm font-medium">
					<span>Root private key</span>
					<PasswordInput bind:value={privateKeyDraft} placeholder="0x-prefixed private key" />
				</label>

				<div class="flex flex-wrap gap-2">
					<Button
						variant="secondary"
						onclick={async () => {
							privateKeyDraft = await controller.revealManagedRootKey();
						}}
						disabled={controller.authBusy || !controller.authService?.canRevealRootAuthPrivateKey}
					>
						<KeyRoundIcon class="size-4" />
						Use backend-managed key
					</Button>
					<Button
						onclick={() => void controller.authenticateWithPrivateKey(privateKeyDraft)}
						disabled={controller.authBusy || !normalizePrivateKey(privateKeyDraft)}
					>
						<BadgeCheckIcon class="size-4" />
						Sign challenge
					</Button>
					<Button variant="outline" onclick={() => void controller.signOut()} disabled={!controller.authSession}>
						<LogOutIcon class="size-4" />
						Sign out
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<PanelShell bodyClass="h-full">
		{#snippet header()}
			<h2 class="text-base font-semibold">Profiles</h2>
			<p class="text-sm text-muted-foreground">Auth-system is the only truth for human identity, labels, and icons.</p>
		{/snippet}

		<ScrollView class="h-full" contentClass="grid gap-4 p-4">
				<div class="grid gap-2">
					<span class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Select profile</span>
					<NativeSelect.Root bind:value={selectedProfileReference} onchange={(event) => void syncSelectedProfile(event.currentTarget.value)}>
						{#each controller.profiles as profile (profile.reference)}
							<option value={profile.reference}>{profile.label}</option>
						{/each}
					</NativeSelect.Root>
				</div>

				{#if profileLoading}
					<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Loading profile…</div>
				{:else if currentProfile}
					<div class="grid gap-4 md:grid-cols-2">
						<label class="grid gap-2 text-sm font-medium">
							<span>Display name</span>
							<Input bind:value={displayName} />
						</label>
						<label class="grid gap-2 text-sm font-medium">
							<span>Nickname</span>
							<Input bind:value={nickname} />
						</label>
						<label class="grid gap-2 text-sm font-medium">
							<span>Phone</span>
							<Input bind:value={phone} />
						</label>
						<label class="grid gap-2 text-sm font-medium">
							<span>Address</span>
							<Input bind:value={address} />
						</label>
					</div>
					<label class="grid gap-2 text-sm font-medium">
						<span>Extra metadata JSON</span>
						<Textarea bind:value={extraJson} class="min-h-56 font-mono text-xs" />
					</label>
					<div class="flex justify-end">
						<Button onclick={() => void saveProfile()} disabled={saveBusy}>
							<SaveIcon class="size-4" />
							{saveBusy ? 'Saving…' : 'Save profile'}
						</Button>
					</div>
				{:else}
					<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No profiles available.</div>
				{/if}
		</ScrollView>
	</PanelShell>
</div>
