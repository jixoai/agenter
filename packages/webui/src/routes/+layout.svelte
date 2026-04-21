<script lang="ts">
	import { asset } from '$app/paths';
	import './layout.css';
	import { onMount } from 'svelte';

	import { createAppController } from '$lib/app/app-controller.svelte';
	import { setAppControllerContext } from '$lib/app/controller-context';
	import SuperadminOnboardingDialog from '$lib/features/settings/superadmin-onboarding-dialog.svelte';
	import AppShell from '$lib/features/shell/app-shell.svelte';

	let { children } = $props();
	const faviconHref = asset('/favicon.ico');
	const favicon16Href = asset('/icons/favicon-16.png');
	const favicon32Href = asset('/icons/favicon-32.png');
	const faviconLight16Href = asset('/icons/favicon-light-16.png');
	const faviconLight32Href = asset('/icons/favicon-light-32.png');
	const faviconDark16Href = asset('/icons/favicon-dark-16.png');
	const faviconDark32Href = asset('/icons/favicon-dark-32.png');
	const appleTouchIconHref = asset('/icons/apple-touch-icon.png');
	const manifestHref = asset('/site.webmanifest');

	const controller = setAppControllerContext(createAppController());
	let privateKeyDraft = $state('');
	const isAuthenticated = $derived(controller.authBootstrapState === 'authenticated' && Boolean(controller.authSession));
	const canStoreAutoLoginKey = $derived(
		Boolean(privateKeyDraft.trim()) || Boolean(controller.authService?.browserAutoLoginBootstrapAvailable),
	);
	const autoLoginActionLabel = $derived(
		privateKeyDraft.trim() ? 'Store key for daemon auto login' : 'Enable daemon auto login',
	);

	onMount(() => {
		void controller.start();
		return () => {
			controller.stop();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={faviconHref} sizes="any" />
	<link rel="icon" type="image/png" sizes="16x16" href={favicon16Href} />
	<link rel="icon" type="image/png" sizes="32x32" href={favicon32Href} />
	<link rel="icon" type="image/png" sizes="16x16" href={faviconLight16Href} media="(prefers-color-scheme: light)" />
	<link rel="icon" type="image/png" sizes="32x32" href={faviconLight32Href} media="(prefers-color-scheme: light)" />
	<link rel="icon" type="image/png" sizes="16x16" href={faviconDark16Href} media="(prefers-color-scheme: dark)" />
	<link rel="icon" type="image/png" sizes="32x32" href={faviconDark32Href} media="(prefers-color-scheme: dark)" />
	<link rel="apple-touch-icon" sizes="180x180" href={appleTouchIconHref} />
	<link rel="manifest" href={manifestHref} />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3f0ea" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#2d3239" />
</svelte:head>

{#if isAuthenticated}
	<AppShell {controller}>
		{@render children()}
	</AppShell>
{:else}
	<div class="flex min-h-svh items-center justify-center bg-background px-4 py-6">
		<SuperadminOnboardingDialog
			open={true}
			authService={controller.authService}
			authStatus={controller.statusText}
			bind:privateKeyDraft
			canStoreAutoLoginKey={canStoreAutoLoginKey}
			autoLoginActionLabel={autoLoginActionLabel}
			authBusy={controller.authBusy}
			allowDismiss={false}
			onStoreAutoLoginKey={() => controller.storeAutoLoginKey(privateKeyDraft)}
			onAuthenticate={() => controller.authenticateWithPrivateKey(privateKeyDraft)}
			onDismiss={() => {}}
		/>
	</div>
{/if}
