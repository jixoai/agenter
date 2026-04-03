<script lang="ts">
	import RuntimeSecondaryRailDesktop from './runtime-secondary-rail-desktop.svelte';
	import RuntimeSecondaryRailMobile from './runtime-secondary-rail-mobile.svelte';
	import type { RuntimeSecondaryRailProps } from './runtime-secondary-rail.types';

	let props: RuntimeSecondaryRailProps = $props();
</script>

<div class="h-full" data-testid="runtime-secondary-rail">
	<div class="md:hidden">
		<RuntimeSecondaryRailMobile {...props} />
	</div>

	<div class="hidden h-full md:block">
		<RuntimeSecondaryRailDesktop {...props} />
	</div>
</div>
