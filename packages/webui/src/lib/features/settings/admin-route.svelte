<script lang="ts">
	import { Scaffold, SplitView } from '@agenter/svelte-components';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SaveIcon from '@lucide/svelte/icons/save';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { normalizePrivateKey } from '$lib/app/private-key-auth';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import PasswordInput from '$lib/components/ui/password-input.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
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
	const profileItems = $derived(
		controller.profiles.map((profile) => ({
			value: profile.reference,
			label: profile.label,
		})),
	);
	const selectedProfileLabel = $derived(
		profileItems.find((item) => item.value === selectedProfileReference)?.label ?? 'Select profile',
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

<Scaffold.Root class="h-full gap-4 p-4 md:p-6" data-testid="admin-route">
	<Scaffold.Header class="grid gap-3 rounded-[1.05rem] border border-border/55 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_8%)_0%,color-mix(in_srgb,var(--background),var(--card)_54%)_100%)] px-5 py-4 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_76%)]">
		<div class="grid gap-1">
			<div class="grid gap-1">
				<h1 class="text-sm font-semibold tracking-tight">Admin</h1>
				<p class="text-xs leading-5 text-muted-foreground">
					Manage the browser superadmin session and durable profile metadata without mixing it into workspace settings.
				</p>
			</div>
		</div>
	</Scaffold.Header>

	<Scaffold.Body>
		<SplitView.Root variant="sidebar-content">
			<SplitView.Sidebar>
				<Scaffold.Root class="rounded-xl border bg-card text-card-foreground shadow-sm">
					<Scaffold.Header class="grid gap-2 border-b px-6 py-4">
						<h2 class="text-base font-semibold">Superadmin session</h2>
					</Scaffold.Header>
					<Scaffold.ScrollBody contentClass="grid gap-4 p-4">
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
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-semibold">
									{controller.authSession?.profile.metadata.displayName ?? controller.authSession?.claims.authId ?? 'Unauthenticated'}
								</div>
								<div class="truncate text-xs text-muted-foreground">
									{controller.authSession?.claims.superadmin ? 'Authenticated superadmin' : 'No browser auth token'}
								</div>
							</div>
						</div>

						<div class="grid gap-2 text-sm">
							<div class="break-all rounded-xl border bg-card px-3 py-2">
								root auth id: {controller.authService?.rootAuthId ?? 'unavailable'}
							</div>
							<div class="break-all rounded-xl border bg-card px-3 py-2">
								auto login: {controller.authService?.browserAutoLoginKeyPath ?? '~/.agenter/local.env'}
							</div>
							<div class="break-all rounded-xl border bg-card px-3 py-2">
								daemon auto login: {controller.authService?.browserAutoLoginConfigured ? 'configured' : 'not configured'}
							</div>
						</div>

						<label class="grid gap-2 text-sm font-medium">
							<span>Root private key for daemon auto login</span>
							<PasswordInput bind:value={privateKeyDraft} placeholder="0x-prefixed private key" />
						</label>

						<div class="grid gap-2 sm:flex sm:flex-wrap">
							{#if controller.authService?.browserAutoLoginBootstrapAvailable}
								<Button
									variant="secondary"
									class="w-full sm:w-auto"
									onclick={() => void controller.storeAutoLoginKey()}
									disabled={controller.authBusy}
								>
									<KeyRoundIcon class="size-4" />
									{controller.authBusy ? 'Configuring…' : 'Bootstrap daemon auto login'}
								</Button>
							{/if}
							<Button
								class="w-full sm:w-auto"
								onclick={() => void controller.storeAutoLoginKey(privateKeyDraft)}
								disabled={controller.authBusy || !normalizePrivateKey(privateKeyDraft)}
							>
								<KeyRoundIcon class="size-4" />
								{controller.authBusy ? 'Configuring…' : 'Store key for daemon auto login'}
							</Button>
							<Button
								variant="outline"
								class="w-full sm:w-auto"
								onclick={() => void controller.signOut()}
								disabled={!controller.authSession}
							>
								<LogOutIcon class="size-4" />
								Sign out
							</Button>
						</div>
						<p class="text-xs text-muted-foreground">
							The browser session uses a short-lived token. Daemon auto login persists the root key machine-locally so
							future launches can authenticate before the protected shell hydrates.
						</p>
					</Scaffold.ScrollBody>
				</Scaffold.Root>
			</SplitView.Sidebar>

			<SplitView.Content>
				<Scaffold.Root class="rounded-xl border bg-card text-card-foreground shadow-sm">
					<Scaffold.Header class="grid gap-2 border-b px-6 py-4">
						<h2 class="text-base font-semibold">Profile metadata</h2>
						<p class="text-sm text-muted-foreground">
							Edit durable metadata on the selected profile without leaking that concern into workspace routes.
						</p>
					</Scaffold.Header>

					<Scaffold.ScrollBody contentClass="grid gap-4 p-4">
						<div class="grid gap-2">
							<span class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Select profile</span>
							<Select.Root
								type="single"
								items={profileItems}
								value={selectedProfileReference || undefined}
								onValueChange={(value) => {
									void syncSelectedProfile(value);
								}}
								disabled={profileItems.length === 0}
							>
								<Select.Trigger class="w-full">
									{selectedProfileLabel}
								</Select.Trigger>
								<Select.Content>
									{#each profileItems as item (item.value)}
										<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
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
					</Scaffold.ScrollBody>
				</Scaffold.Root>
			</SplitView.Content>
		</SplitView.Root>
	</Scaffold.Body>
</Scaffold.Root>
