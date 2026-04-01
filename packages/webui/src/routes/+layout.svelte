<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	import { createAppController } from '$lib/app/app-controller.svelte';
	import { setAppControllerContext } from '$lib/app/controller-context';
	import { normalizePrivateKey } from '$lib/app/private-key-auth';
	import AppShell from '$lib/features/shell/app-shell.svelte';
	import SuperadminOnboardingDialog from '$lib/features/settings/superadmin-onboarding-dialog.svelte';

	let { children } = $props();

	const controller = setAppControllerContext(createAppController());
	let onboardingPrivateKey = $state('');
	let onboardingDismissed = $state(false);

	const shouldPromptForSuperadmin = $derived(
		!onboardingDismissed && !controller.initializing && !controller.authSession && controller.authService !== null,
	);

	const canRevealManagedKey = $derived(Boolean(controller.authService?.canRevealRootAuthPrivateKey));

	onMount(() => {
		void controller.start();
		return () => {
			controller.stop();
		};
	});

	$effect(() => {
		if (controller.authSession) {
			onboardingDismissed = false;
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<AppShell {controller}>
	{@render children()}
</AppShell>

<SuperadminOnboardingDialog
	open={shouldPromptForSuperadmin}
	authService={controller.authService}
	authStatus={controller.statusText}
	bind:privateKeyDraft={onboardingPrivateKey}
	{canRevealManagedKey}
	managedKeyBusy={controller.authBusy}
	onRevealManagedKey={async () => {
		onboardingPrivateKey = await controller.revealManagedRootKey();
	}}
	onAuthenticate={async () => {
		if (!normalizePrivateKey(onboardingPrivateKey)) {
			controller.statusText = 'Root private key must be a 0x-prefixed 32-byte hex string.';
			return;
		}
		await controller.authenticateWithPrivateKey(onboardingPrivateKey);
	}}
	onDismiss={() => {
		onboardingDismissed = true;
		controller.statusText = 'Superadmin key binding deferred. Settings remains available for later binding.';
	}}
/>
