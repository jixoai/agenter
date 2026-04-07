<script lang="ts">
	import { asset } from '$app/paths';
	import './layout.css';
	import { onMount } from 'svelte';

	import { createAppController } from '$lib/app/app-controller.svelte';
	import { setAppControllerContext } from '$lib/app/controller-context';
	import { normalizePrivateKey } from '$lib/app/private-key-auth';
	import AppShell from '$lib/features/shell/app-shell.svelte';
	import SuperadminOnboardingDialog from '$lib/features/settings/superadmin-onboarding-dialog.svelte';

	let { children } = $props();
	const faviconHref = asset('/favicon.ico');
	const favicon16Href = asset('/icons/favicon-16.png');
	const favicon32Href = asset('/icons/favicon-32.png');
	const appleTouchIconHref = asset('/icons/apple-touch-icon.png');
	const manifestHref = asset('/site.webmanifest');

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

<svelte:head>
	<link rel="icon" href={faviconHref} sizes="any" />
	<link rel="icon" type="image/png" sizes="16x16" href={favicon16Href} />
	<link rel="icon" type="image/png" sizes="32x32" href={favicon32Href} />
	<link rel="apple-touch-icon" sizes="180x180" href={appleTouchIconHref} />
	<link rel="manifest" href={manifestHref} />
	<meta name="theme-color" content="#0a1219" />
</svelte:head>

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
