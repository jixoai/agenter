<script lang="ts">
	import { onMount } from 'svelte';

	import { createAppController } from '$lib/app/app-controller.svelte';
	import { setAppControllerContext } from '$lib/app/controller-context';
	import SuperadminOnboardingDialog from '$lib/features/settings/superadmin-onboarding-dialog.svelte';
	import AppShell from '$lib/features/shell/app-shell.svelte';

	let { children } = $props();

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
